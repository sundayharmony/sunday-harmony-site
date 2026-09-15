from __future__ import annotations

import json
import re
import uuid

from app.config import BUREAU_ADDRESSES_PATH
from app.models import (
    DisputePlanRequest,
    LetterItem,
    LetterPlan,
    LetterPlanResponse,
    LetterType,
    ParsedReport,
    Tradeline,
    TradelineSelection,
)
from app.parsers.identityiq import lookup_subscriber
from app.services.credit_health import (
    default_dispute_reason,
    is_clean_profile_removal_target,
    removal_sort_key,
)

LETTER_META: dict[str, tuple[str, str]] = {
    "bureau_equifax": ("FCRA §611 (15 U.S.C. §1681i)", "Equifax"),
    "bureau_experian": ("FCRA §611 (15 U.S.C. §1681i)", "Experian"),
    "bureau_transunion": ("FCRA §611 (15 U.S.C. §1681i)", "TransUnion"),
    "furnisher": ("FCRA §623 (15 U.S.C. §1681s-2)", "Furnisher"),
    "method_of_verification": (
        "FCRA §611(a)(6)–(7) (15 U.S.C. §1681i)",
        "Method of Verification",
    ),
    "warning_intent": ("FCRA §611 / §616–§617 (15 U.S.C. §1681i / §1681n–§1681o)", "Warning"),
    "reinvestigation": ("FCRA §611 (15 U.S.C. §1681i)", "Reinvestigation"),
    "debt_validation": ("FDCPA §809 (15 U.S.C. §1692g)", "Debt Validation"),
    "cfpb_complaint": ("Consumer Financial Protection Act / FCRA remedies", "CFPB Complaint"),
}


# In-progress statuses (pending / selected_for_round / disputed) are stamped as soon as
# Round 1 is planned. They must not switch the router onto per-item follow-up letters.
FOLLOW_UP_ITEM_STATUSES = frozenset({"verified", "no_response", "updated", "frivolous"})

# Max accounts in a single bureau or furnisher letter. Extra items create additional letters.
MAX_ITEMS_PER_LETTER = 7


def _is_follow_up_selection(sel: TradelineSelection | None) -> bool:
    if sel is None:
        return False
    if sel.preferred_letter_type:
        return True
    status = (sel.item_status or "").strip().lower()
    return status in FOLLOW_UP_ITEM_STATUSES


def suggest_letter_type(
    *,
    item_status: str | None = None,
    preferred: LetterType | None = None,
    is_collection: bool = False,
    round_number: int = 1,
) -> LetterType:
    """Map lifecycle outcome → follow-up letter type (staff may override)."""
    if preferred:
        return preferred
    status = (item_status or "").strip().lower()
    round_number = max(1, int(round_number or 1))
    if status == "verified":
        return "cfpb_complaint" if round_number >= 3 else "method_of_verification"
    if status == "no_response":
        return "cfpb_complaint" if round_number >= 3 else "warning_intent"
    if status == "updated":
        return "reinvestigation"
    if is_collection and round_number >= 2:
        return "debt_validation"
    if round_number >= 3 and status == "disputed":
        return "cfpb_complaint"
    return "bureau_transunion"


def build_plan(session_id: str, report: ParsedReport, request: DisputePlanRequest) -> LetterPlanResponse:
    selection_map = {s.id: s for s in request.selections}
    selected: list[tuple[Tradeline, str, TradelineSelection | None]] = []
    for tl in report.tradelines:
        sel = selection_map.get(tl.id)
        if sel and sel.selected:
            reason = _resolve_reason(tl, sel.dispute_reason)
            selected.append((tl, reason, sel))
        elif not selection_map and tl.selected:
            reason = _resolve_reason(tl, tl.dispute_reason)
            selected.append((tl, reason, None))

    selected.sort(key=lambda pair: removal_sort_key(pair[0]))

    round_number = max(1, int(request.round_number or 1))
    one_per_bureau = (
        request.force_one_item_per_bureau
        if request.force_one_item_per_bureau is not None
        else round_number >= 2
    )

    follow_up = any(_is_follow_up_selection(sel) for _, _, sel in selected)
    if follow_up or round_number >= 2:
        plans = _build_follow_up_plans(selected, report, request, round_number, one_per_bureau)
        if plans:
            return LetterPlanResponse(session_id=session_id, plans=plans)

    return LetterPlanResponse(
        session_id=session_id,
        plans=_build_round1_plans(selected, report, request, one_per_bureau),
    )


def chunk_items(items: list, size: int = MAX_ITEMS_PER_LETTER) -> list[list]:
    max_size = 1 if size < 1 else size
    if not items:
        return []
    return [items[i : i + max_size] for i in range(0, len(items), max_size)]


def _chunk_recipient_name(base: str, index: int, total: int) -> str:
    if total <= 1:
        return base
    return f"{base} (letter {index + 1} of {total})"


def _append_chunked_plans(
    plans: list[LetterPlan],
    *,
    items: list[LetterItem],
    letter_type: str,
    recipient_name: str,
    recipient_lines: list[str],
    statute: str,
    missing_address: bool = False,
) -> None:
    chunks = chunk_items(items)
    total = len(chunks)
    for index, chunk in enumerate(chunks):
        plans.append(
            LetterPlan(
                id=str(uuid.uuid4()),
                letter_type=letter_type,
                recipient_name=_chunk_recipient_name(recipient_name, index, total),
                recipient_lines=recipient_lines,
                statute=statute,
                items=chunk,
                missing_address=missing_address,
            )
        )


def _build_round1_plans(
    selected: list[tuple[Tradeline, str, TradelineSelection | None]],
    report: ParsedReport,
    request: DisputePlanRequest,
    one_per_bureau: bool,
) -> list[LetterPlan]:
    bureau_addrs = json.loads(BUREAU_ADDRESSES_PATH.read_text(encoding="utf-8"))
    plans: list[LetterPlan] = []

    for bureau_key, bureau_code, letter_type in [
        ("equifax", "EQF", "bureau_equifax"),
        ("experian", "EXP", "bureau_experian"),
        ("transunion", "TUC", "bureau_transunion"),
    ]:
        items: list[LetterItem] = []
        for tl, reason, _sel in selected:
            targets = tl.dispute_bureaus or tl.bureaus
            if bureau_code not in targets:
                continue
            acct = {"TUC": tl.account_tu, "EXP": tl.account_exp, "EQF": tl.account_eqf}[bureau_code]
            items.append(
                LetterItem(
                    tradeline_id=tl.id,
                    creditor=tl.creditor,
                    account_number=acct,
                    bureau=bureau_code,
                    status=tl.status,
                    balance=tl.balance,
                    dispute_reason=_prefer_deletion_reason(tl, reason),
                )
            )
            if one_per_bureau and items:
                break
        if items:
            addr = bureau_addrs[bureau_key]
            _append_chunked_plans(
                plans,
                items=items,
                letter_type=letter_type,
                recipient_name=addr["name"],
                recipient_lines=addr["lines"],
                statute="FCRA §611 (15 U.S.C. §1681i)",
            )

    by_creditor: dict[str, list[tuple[Tradeline, str]]] = {}
    for tl, reason, _sel in selected:
        if not tl.dispute_furnisher:
            continue
        key = _normalize_creditor(tl.creditor)
        by_creditor.setdefault(key, []).append((tl, reason))

    for _cred_key, group in by_creditor.items():
        sample_tl = group[0][0]
        override = request.furnisher_address_overrides.get(sample_tl.creditor)
        sub = lookup_subscriber(sample_tl.creditor, report.subscribers)
        lines = override or (sub.address_lines if sub else [])
        name = sub.name if sub else sample_tl.creditor
        items = [
            LetterItem(
                tradeline_id=tl.id,
                creditor=tl.creditor,
                account_number=tl.account_tu or tl.account_exp or tl.account_eqf,
                bureau=",".join(tl.bureaus),
                status=tl.status,
                balance=tl.balance,
                dispute_reason=_prefer_deletion_reason(tl, reason),
            )
            for tl, reason in (group[:1] if one_per_bureau else group)
        ]
        _append_chunked_plans(
            plans,
            items=items,
            letter_type="furnisher",
            recipient_name=name,
            recipient_lines=lines,
            statute="FCRA §623 (15 U.S.C. §1681s-2)",
            missing_address=not lines,
        )

    return plans


def _build_follow_up_plans(
    selected: list[tuple[Tradeline, str, TradelineSelection | None]],
    report: ParsedReport,
    request: DisputePlanRequest,
    round_number: int,
    one_per_bureau: bool,
) -> list[LetterPlan]:
    bureau_addrs = json.loads(BUREAU_ADDRESSES_PATH.read_text(encoding="utf-8"))
    plans: list[LetterPlan] = []
    used_bureau: set[str] = set()

    for tl, reason, sel in selected:
        letter_type = suggest_letter_type(
            item_status=sel.item_status if sel else None,
            preferred=sel.preferred_letter_type if sel else None,
            is_collection=bool(tl.is_collection),
            round_number=round_number,
        )
        statute, _label = LETTER_META.get(letter_type, ("FCRA §611 (15 U.S.C. §1681i)", letter_type))
        targets = list(tl.dispute_bureaus or tl.bureaus or ["TUC"])

        if letter_type in {
            "method_of_verification",
            "warning_intent",
            "reinvestigation",
            "bureau_equifax",
            "bureau_experian",
            "bureau_transunion",
        }:
            for bureau_code in targets:
                if one_per_bureau and bureau_code in used_bureau:
                    continue
                bureau_key = {"EQF": "equifax", "EXP": "experian", "TUC": "transunion"}.get(bureau_code)
                if not bureau_key:
                    continue
                addr = bureau_addrs[bureau_key]
                acct = {
                    "TUC": tl.account_tu,
                    "EXP": tl.account_exp,
                    "EQF": tl.account_eqf,
                }.get(bureau_code, "")
                typed: LetterType = letter_type
                if letter_type.startswith("bureau_"):
                    typed = {
                        "EQF": "bureau_equifax",
                        "EXP": "bureau_experian",
                        "TUC": "bureau_transunion",
                    }[bureau_code]  # type: ignore[assignment]
                plans.append(
                    LetterPlan(
                        id=str(uuid.uuid4()),
                        letter_type=typed,
                        recipient_name=addr["name"],
                        recipient_lines=addr["lines"],
                        statute=statute,
                        items=[
                            LetterItem(
                                tradeline_id=tl.id,
                                creditor=tl.creditor,
                                account_number=acct,
                                bureau=bureau_code,
                                status=tl.status,
                                balance=tl.balance,
                                dispute_reason=_prefer_deletion_reason(tl, reason),
                            )
                        ],
                    )
                )
                used_bureau.add(bureau_code)
                if one_per_bureau:
                    break
            continue

        if letter_type == "debt_validation":
            override = request.furnisher_address_overrides.get(tl.creditor)
            sub = lookup_subscriber(tl.creditor, report.subscribers)
            lines = override or (sub.address_lines if sub else [])
            name = sub.name if sub else tl.creditor
            plans.append(
                LetterPlan(
                    id=str(uuid.uuid4()),
                    letter_type="debt_validation",
                    recipient_name=name,
                    recipient_lines=lines,
                    statute=statute,
                    items=[
                        LetterItem(
                            tradeline_id=tl.id,
                            creditor=tl.creditor,
                            account_number=tl.account_tu or tl.account_exp or tl.account_eqf,
                            bureau=",".join(tl.bureaus),
                            status=tl.status,
                            balance=tl.balance,
                            dispute_reason=_prefer_deletion_reason(tl, reason),
                        )
                    ],
                    missing_address=not lines,
                )
            )
            continue

        if letter_type == "cfpb_complaint":
            plans.append(
                LetterPlan(
                    id=str(uuid.uuid4()),
                    letter_type="cfpb_complaint",
                    recipient_name="Consumer Financial Protection Bureau",
                    recipient_lines=[
                        "Consumer Financial Protection Bureau",
                        "P.O. Box 2900",
                        "Clinton, IA 52733-2900",
                    ],
                    statute=statute,
                    items=[
                        LetterItem(
                            tradeline_id=tl.id,
                            creditor=tl.creditor,
                            account_number=tl.account_tu or tl.account_exp or tl.account_eqf,
                            bureau=",".join(tl.bureaus),
                            status=tl.status,
                            balance=tl.balance,
                            dispute_reason=_prefer_deletion_reason(tl, reason),
                        )
                    ],
                )
            )

    return plans


def _resolve_reason(tl: Tradeline, selection_reason: str) -> str:
    return (
        (selection_reason or "").strip()
        or (tl.dispute_reason or "").strip()
        or (tl.suggested_dispute_reason or "").strip()
        or default_dispute_reason(tl)
    )


def _prefer_deletion_reason(tl: Tradeline, reason: str) -> str:
    """Ensure closed/obsolete negatives ask for deletion, not only field correction."""
    text = (reason or "").strip()
    if not is_clean_profile_removal_target(tl):
        return text
    lower = text.lower()
    if "delet" in lower or "remov" in lower:
        return text
    suffix = (
        " Because this account is closed, paid, or otherwise not useful to a clean credit profile, "
        "I specifically request deletion of the entire tradeline if it cannot be verified as accurate "
        "and complete."
    )
    return f"{text.rstrip('.')}." + suffix if text else suffix.strip()


def _normalize_creditor(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", name.upper())
