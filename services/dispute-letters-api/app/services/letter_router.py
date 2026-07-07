from __future__ import annotations

import json
import re
import uuid
from difflib import SequenceMatcher

from app.config import BUREAU_ADDRESSES_PATH
from app.models import DisputePlanRequest, LetterItem, LetterPlan, LetterPlanResponse, ParsedReport, Tradeline
from app.parsers.identityiq import lookup_subscriber


def build_plan(session_id: str, report: ParsedReport, request: DisputePlanRequest) -> LetterPlanResponse:
    selection_map = {s.id: s for s in request.selections}
    selected: list[tuple[Tradeline, str]] = []
    for tl in report.tradelines:
        sel = selection_map.get(tl.id)
        if sel and sel.selected:
            reason = _resolve_reason(tl, sel.dispute_reason)
            if reason:
                selected.append((tl, reason))
        elif tl.selected:
            reason = _resolve_reason(tl, tl.dispute_reason)
            if reason:
                selected.append((tl, reason))

    bureau_addrs = json.loads(BUREAU_ADDRESSES_PATH.read_text(encoding="utf-8"))
    plans: list[LetterPlan] = []

    for bureau_key, bureau_code, letter_type in [
        ("equifax", "EQF", "bureau_equifax"),
        ("experian", "EXP", "bureau_experian"),
        ("transunion", "TUC", "bureau_transunion"),
    ]:
        items: list[LetterItem] = []
        for tl, reason in selected:
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
                    dispute_reason=reason,
                )
            )
        if items:
            addr = bureau_addrs[bureau_key]
            plans.append(
                LetterPlan(
                    id=str(uuid.uuid4()),
                    letter_type=letter_type,
                    recipient_name=addr["name"],
                    recipient_lines=addr["lines"],
                    statute="FCRA §611 (15 U.S.C. §1681i)",
                    items=items,
                )
            )

    by_creditor: dict[str, list[tuple[Tradeline, str]]] = {}
    for tl, reason in selected:
        if not tl.dispute_furnisher:
            continue
        key = _normalize_creditor(tl.creditor)
        by_creditor.setdefault(key, []).append((tl, reason))

    for cred_key, group in by_creditor.items():
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
                dispute_reason=reason,
            )
            for tl, reason in group
        ]
        plans.append(
            LetterPlan(
                id=str(uuid.uuid4()),
                letter_type="furnisher",
                recipient_name=name,
                recipient_lines=lines,
                statute="FCRA §623 (15 U.S.C. §1681s-2)",
                items=items,
                missing_address=not lines,
            )
        )

    return LetterPlanResponse(session_id=session_id, plans=plans)


def _resolve_reason(tl: Tradeline, selection_reason: str) -> str:
    return (
        selection_reason.strip()
        or tl.dispute_reason.strip()
        or tl.suggested_dispute_reason.strip()
    )


def _normalize_creditor(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", name.upper())
