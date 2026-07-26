from __future__ import annotations

import re

from app.models import (
    CreditHealthSummary,
    ParsedReport,
    RepairPriority,
    Tradeline,
)

_PRIORITY_ORDER: dict[RepairPriority, int] = {
    "high": 0,
    "medium": 1,
    "low": 2,
    "none": 3,
}

_DEROG_PATTERN = re.compile(
    r"collection|charge.?off|delinquent|late|past due|derog|dispute|unpaid|foreclos|reposs",
    re.I,
)
_CLOSED_PATTERN = re.compile(
    r"\b(closed|paid\s*/\s*closed|paid\s+closed|paid\s+as\s+agreed|transferred|sold|inactive)\b",
    re.I,
)
_PAID_PATTERN = re.compile(r"\bpaid\b", re.I)
_ZERO_BALANCE_PATTERN = re.compile(
    r"^(?:\$?\s*0(?:\.00)?|0|zero|n/?a|none|not\s+reported|-|—)?\s*$",
    re.I,
)


def _blob(tl: Tradeline) -> str:
    return f"{tl.status} {tl.remarks} {tl.account_type} {tl.past_due} {' '.join(tl.legal_flags)}"


def is_closed_tradeline(tl: Tradeline) -> bool:
    return bool(_CLOSED_PATTERN.search(_blob(tl)))


def is_zero_or_blank_balance(tl: Tradeline) -> bool:
    bal = (tl.balance or "").strip()
    if not bal:
        return True
    return bool(_ZERO_BALANCE_PATTERN.match(bal))


def is_negative_tradeline(tl: Tradeline) -> bool:
    if tl.is_collection:
        return True
    if any(f in tl.legal_flags for f in ("collection", "charge_off", "late_payment_error")):
        return True
    return bool(_DEROG_PATTERN.search(_blob(tl)))


def is_clean_profile_removal_target(tl: Tradeline) -> bool:
    """
    True for accounts that typically clutter a clean credit profile and should
    be prioritized for deletion (not just correction): collections, charge-offs,
    and closed/paid accounts that still carry negative history.
    """
    category = classify_category(tl)
    if category in ("collection", "charge_off"):
        return True
    if "obsolete_negative" in tl.legal_flags or "closed_derogatory" in tl.legal_flags:
        return True
    closed = is_closed_tradeline(tl)
    if not closed:
        return False
    # Closed accounts with any derogatory reporting — late history, past due, etc.
    if is_negative_tradeline(tl):
        return True
    # Paid/closed with zero balance still showing as a negative-looking entry
    if _PAID_PATTERN.search(_blob(tl)) and is_zero_or_blank_balance(tl):
        # Only treat as removal target when there is something to challenge
        # (remarks, past-due, or analyst notes) — leave pristine positive closed alone.
        if tl.past_due or tl.remarks or tl.analysis_notes or tl.suggested_dispute_reason:
            return True
    return False


def classify_category(tl: Tradeline) -> str:
    blob = _blob(tl).lower()
    if tl.is_collection or "collection" in blob:
        return "collection"
    if "charge" in blob and "off" in blob:
        return "charge_off"
    if "inquir" in blob:
        return "inquiry"
    if is_closed_tradeline(tl) and is_negative_tradeline(tl):
        return "closed_derogatory"
    if "late" in blob or "delinquent" in blob:
        return "late_payment"
    if "balance_mismatch" in tl.legal_flags:
        return "bureau_mismatch"
    if "already_disputed" in tl.legal_flags:
        return "disputed"
    if is_negative_tradeline(tl):
        return "negative"
    if is_closed_tradeline(tl):
        return "closed"
    return "positive"


def score_priority(tl: Tradeline) -> RepairPriority:
    category = classify_category(tl)
    # Highest: collections, charge-offs, closed accounts with negative history,
    # and bureau mismatches — these are the fastest path to a cleaner profile.
    if category in ("collection", "charge_off", "closed_derogatory", "bureau_mismatch"):
        return "high"
    if is_clean_profile_removal_target(tl):
        return "high"
    if category in ("late_payment", "disputed", "negative"):
        return "medium"
    if category == "closed":
        # Closed with no clear derogatory mark — optional cleanup only
        return "low"
    if tl.analysis_notes or tl.suggested_dispute_reason:
        return "low"
    return "none"


def default_removal_dispute_reason(tl: Tradeline) -> str:
    """Deletion-focused reason for closed/obsolete negatives."""
    status = (tl.status or "this account").strip()
    if tl.is_collection or classify_category(tl) == "collection":
        return (
            f"This collection tradeline ({status}) does not belong on a clean credit profile. "
            "I dispute it as inaccurate and unverifiable and request deletion if it cannot be "
            "fully verified under FCRA §611 (15 U.S.C. §1681i)."
        )
    if is_closed_tradeline(tl):
        return (
            f"This account is reported as {status}. Because it is closed and no longer useful "
            "to a clean credit profile, I dispute the remaining negative or unverifiable history "
            "and request that the tradeline be deleted in full if the furnisher cannot verify "
            "every reported field under FCRA §611 (15 U.S.C. §1681i) and §623 (15 U.S.C. §1681s-2)."
        )
    return (
        "I dispute this tradeline as inaccurate and unverifiable and request deletion or "
        "correction of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i)."
    )


def enrich_tradeline(tl: Tradeline) -> Tradeline:
    tl.item_category = classify_category(tl)
    tl.repair_priority = score_priority(tl)

    flags = list(tl.legal_flags or [])
    if is_closed_tradeline(tl) and "closed_account" not in flags:
        flags.append("closed_account")
    if is_clean_profile_removal_target(tl) and "obsolete_negative" not in flags:
        flags.append("obsolete_negative")
    if is_closed_tradeline(tl) and is_negative_tradeline(tl) and "closed_derogatory" not in flags:
        flags.append("closed_derogatory")
    tl.legal_flags = flags

    if is_clean_profile_removal_target(tl):
        if not (tl.suggested_dispute_reason or "").strip():
            tl.suggested_dispute_reason = default_removal_dispute_reason(tl)
        if not (tl.dispute_reason or "").strip():
            tl.dispute_reason = tl.suggested_dispute_reason

    return tl


def _parse_score(value) -> int | None:
    if value is None:
        return None
    try:
        n = int(value)
        return n if 300 <= n <= 850 else None
    except (TypeError, ValueError):
        return None


def merge_agent_health(data: dict | None, summary: CreditHealthSummary) -> CreditHealthSummary:
    if not data:
        return summary
    scores = data.get("scores") or {}
    summary.scores.tuc = _parse_score(scores.get("tuc")) or summary.scores.tuc
    summary.scores.exp = _parse_score(scores.get("exp")) or summary.scores.exp
    summary.scores.eqf = _parse_score(scores.get("eqf")) or summary.scores.eqf
    if data.get("repair_summary"):
        summary.repair_summary = str(data["repair_summary"])
    actions = data.get("recommended_actions") or []
    if actions:
        summary.recommended_actions = [str(a) for a in actions]
    return summary


def build_health_summary(report: ParsedReport, agent_health: dict | None = None) -> CreditHealthSummary:
    tradelines = [enrich_tradeline(tl) for tl in report.tradelines]
    report.tradelines = tradelines

    negative = sum(1 for tl in tradelines if is_negative_tradeline(tl))
    collections = sum(1 for tl in tradelines if tl.is_collection or tl.item_category == "collection")
    high = sum(1 for tl in tradelines if tl.repair_priority == "high")
    removal = sum(1 for tl in tradelines if is_clean_profile_removal_target(tl))

    summary = CreditHealthSummary(
        total_accounts=len(tradelines),
        negative_count=negative,
        collection_count=collections,
        high_priority_count=high,
        repair_summary=report.analysis_summary,
        recommended_actions=_default_actions(tradelines, high, collections, removal),
    )
    return merge_agent_health(agent_health, summary)


def _default_actions(
    tradelines: list[Tradeline], high: int, collections: int, removal: int
) -> list[str]:
    actions: list[str] = []
    if removal:
        actions.append(
            f"Prioritize deleting {removal} closed, paid, or obsolete negative item(s) that do not "
            "support a clean credit profile."
        )
    if high:
        actions.append(f"Dispute {high} high-priority item(s) with bureaus and furnishers first.")
    if collections:
        actions.append("Validate collection accounts under FCRA §611 and FDCPA §809 where applicable.")
    if not actions and tradelines:
        actions.append("Review accounts marked for dispute and confirm letter targets before sending.")
    return actions


def removal_sort_key(tl: Tradeline) -> tuple:
    """Sort key: removal targets first, then by repair priority."""
    return (
        0 if is_clean_profile_removal_target(tl) else 1,
        _PRIORITY_ORDER.get(tl.repair_priority, 9),
        tl.creditor.lower(),
    )


def sort_by_priority(tradelines: list[Tradeline]) -> list[Tradeline]:
    return sorted(tradelines, key=removal_sort_key)


def apply_high_priority_selection(report: ParsedReport) -> ParsedReport:
    """Pre-select high-priority / clean-profile removal targets when none chosen yet."""
    if any(tl.selected for tl in report.tradelines):
        return report
    for tl in report.tradelines:
        if tl.repair_priority == "high" or is_clean_profile_removal_target(tl):
            tl.selected = True
            if not tl.dispute_reason:
                tl.dispute_reason = tl.suggested_dispute_reason or default_removal_dispute_reason(tl)
    return report
