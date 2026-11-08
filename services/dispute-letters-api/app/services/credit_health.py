from __future__ import annotations

import re

from app.models import (
    CreditHealthSummary,
    ParsedReport,
    RepairPriority,
    Tradeline,
)
from app.services.bureau_scores import parse_score_value

_PRIORITY_ORDER: dict[RepairPriority, int] = {
    "high": 0,
    "medium": 1,
    "low": 2,
    "none": 3,
}

# Strip positive payment-history phrasing before scanning for derogatories.
# Otherwise "never late" matches the substring "late" and inflates negative_count.
_POSITIVE_LATE_PATTERN = re.compile(
    r"never\s+late|no\s+late(?:\s+payments?)?|\bnot\s+late\b",
    re.I,
)
_RESOLVED_DISPUTE_PATTERN = re.compile(
    r"(?:previously\s+(?:in\s+)?)?dispute.{0,80}?(?:now\s+)?resolved",
    re.I | re.S,
)
_DEROG_PATTERN = re.compile(
    r"collection|charge.?off|delinquent|\bpast\s+due\b|\blate\b|derog|\bunpaid\b|"
    r"foreclos|reposs|\bin\s+dispute\b",
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
    return (
        f"{tl.status} {tl.remarks} {tl.account_type} {tl.past_due} "
        f"{tl.payment_history} {' '.join(tl.legal_flags)}"
    )


def _money_amount(value: str) -> float:
    """Parse a currency-ish string to a float; blank/unparseable → 0."""
    raw = (value or "").strip()
    if not raw:
        return 0.0
    match = re.search(r"-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?", raw)
    if not match:
        return 0.0
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return 0.0


def has_nonzero_past_due(tl: Tradeline) -> bool:
    return _money_amount(tl.past_due) > 0


def is_closed_tradeline(tl: Tradeline) -> bool:
    return bool(_CLOSED_PATTERN.search(_blob(tl)))


def is_zero_or_blank_balance(tl: Tradeline) -> bool:
    bal = (tl.balance or "").strip()
    if not bal:
        return True
    return bool(_ZERO_BALANCE_PATTERN.match(bal))


def is_negative_tradeline(tl: Tradeline) -> bool:
    if tl.is_collection or (tl.item_category or "") == "collection":
        return True
    if any(f in tl.legal_flags for f in ("collection", "charge_off", "late_payment_error")):
        return True
    # Past-due amount alone (e.g. "$250.00" with status "Open") is derogatory even
    # when the words "past due" never appear in the status/remarks blob.
    if has_nonzero_past_due(tl):
        return True
    blob = _POSITIVE_LATE_PATTERN.sub(" ", _blob(tl))
    blob = _RESOLVED_DISPUTE_PATTERN.sub(" ", blob)
    return bool(_DEROG_PATTERN.search(blob))


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


def default_inquiry_dispute_reason(tl: Tradeline) -> str:
    creditor = (tl.creditor or "this company").strip() or "this company"
    return (
        f"I did not authorize this hard inquiry from {creditor} and dispute it as an inquiry "
        "made without a permissible purpose under FCRA §604 (15 U.S.C. §1681b). "
        "If the inquiry cannot be verified as initiated by me, delete it from my file under "
        "FCRA §611 (15 U.S.C. §1681i)."
    )


def default_dispute_reason(tl: Tradeline) -> str:
    if classify_category(tl) == "inquiry":
        return default_inquiry_dispute_reason(tl)
    if is_clean_profile_removal_target(tl):
        return default_removal_dispute_reason(tl)
    return (
        "I dispute this item as inaccurate and unverifiable and request deletion or correction "
        "of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i)."
    )


_STALE_CLEAN_PROFILE_REASON = re.compile(
    r"clean credit profile|no longer useful to a clean|does not belong on a clean|"
    r"not useful to a clean credit profile",
    re.I,
)


def default_removal_dispute_reason(tl: Tradeline) -> str:
    """Deletion-focused reason for closed/obsolete negatives — FCRA grounds only."""
    status = (tl.status or "this account").strip()
    if tl.is_collection or classify_category(tl) == "collection":
        return (
            f"This collection tradeline is reported as {status}. I dispute the accuracy and "
            "completeness of this collection reporting and request that it be deleted if the "
            "furnisher cannot verify every reported field as accurate and complete under "
            "FCRA §611 (15 U.S.C. §1681i) and §623 (15 U.S.C. §1681s-2)."
        )
    if is_closed_tradeline(tl):
        late_bits: list[str] = []
        if re.search(r"late|delinquent|past\s+due|times\s+late", f"{tl.status} {tl.payment_history}", re.I):
            late_bits.append("reported late-payment / delinquency history")
        if has_nonzero_past_due(tl):
            late_bits.append(f"past-due amount of {tl.past_due.strip()}")
        focus = ", including " + " and ".join(late_bits) if late_bits else ""
        return (
            f"This account is reported as {status}. I dispute the accuracy and completeness of "
            f"the remaining negative information on this closed account{focus}. Under FCRA §611 "
            "(15 U.S.C. §1681i) and §623 (15 U.S.C. §1681s-2), please verify every reported field "
            "with the furnisher. If the status, balance, past-due amount, payment history, or any "
            "other field cannot be verified as accurate and complete, delete the tradeline in full."
        )
    return (
        "I dispute this tradeline as inaccurate and unverifiable and request deletion or "
        "correction of any information that cannot be verified under FCRA §611 (15 U.S.C. §1681i)."
    )


def reason_uses_stale_clean_profile_language(text: str) -> bool:
    return bool(_STALE_CLEAN_PROFILE_REASON.search(text or ""))


def enrich_tradeline(tl: Tradeline) -> Tradeline:
    from app.services.cross_bureau import (
        FLAG_CONSISTENT,
        FLAG_INCONSISTENT,
        apply_cross_bureau_enrichment,
        classify_mismatch_kind,
        consistent_inaccuracy_reason,
        inconsistent_reason,
    )

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

    tl = apply_cross_bureau_enrichment(tl)
    kind, _ = classify_mismatch_kind(tl)

    if not (tl.suggested_dispute_reason or "").strip():
        if kind == "cross_bureau_inconsistent" or FLAG_INCONSISTENT in (tl.legal_flags or []):
            tl.suggested_dispute_reason = inconsistent_reason(tl)
        elif kind == "consistent_inaccuracy" or FLAG_CONSISTENT in (tl.legal_flags or []):
            tl.suggested_dispute_reason = consistent_inaccuracy_reason(tl)
        elif classify_category(tl) == "inquiry" or is_clean_profile_removal_target(tl):
            tl.suggested_dispute_reason = default_dispute_reason(tl)
    elif reason_uses_stale_clean_profile_language(tl.suggested_dispute_reason):
        # Replace prior "clean credit profile" templates with FCRA verification language.
        tl.suggested_dispute_reason = default_dispute_reason(tl)

    if not (tl.dispute_reason or "").strip() and (tl.suggested_dispute_reason or "").strip():
        tl.dispute_reason = tl.suggested_dispute_reason
    elif not (tl.dispute_reason or "").strip() and (
        is_clean_profile_removal_target(tl) or classify_category(tl) == "inquiry"
    ):
        tl.dispute_reason = tl.suggested_dispute_reason or default_dispute_reason(tl)
    elif reason_uses_stale_clean_profile_language(tl.dispute_reason or ""):
        tl.dispute_reason = tl.suggested_dispute_reason or default_dispute_reason(tl)

    return tl


def merge_agent_health(data: dict | None, summary: CreditHealthSummary) -> CreditHealthSummary:
    if not data:
        return summary
    scores = data.get("scores") or {}
    summary.scores.tuc = parse_score_value(scores.get("tuc")) or summary.scores.tuc
    summary.scores.exp = parse_score_value(scores.get("exp")) or summary.scores.exp
    summary.scores.eqf = parse_score_value(scores.get("eqf")) or summary.scores.eqf
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
        scores=report.credit_health.scores.model_copy(),
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
    from app.services.cross_bureau import FLAG_INCONSISTENT

    actions: list[str] = []
    inconsistent = sum(1 for tl in tradelines if FLAG_INCONSISTENT in (tl.legal_flags or []))
    if inconsistent:
        actions.append(
            f"Prioritize {inconsistent} cross-bureau inconsistency item(s) in Round 1 "
            "(all three bureau letters, ≤7 items each). Absent reporting alone is not an error."
        )
    if removal:
        actions.append(
            f"Prioritize deleting {removal} closed, paid, or obsolete item(s) that still report "
            "negative or unverifiable history."
        )
    if high:
        actions.append(f"Dispute {high} high-priority item(s) with bureaus and furnishers first.")
    if collections:
        actions.append("Validate collection accounts under FCRA §611 and FDCPA §809 where applicable.")
    if not actions and tradelines:
        actions.append("Review accounts marked for dispute and confirm letter targets before sending.")
    return actions


def removal_sort_key(tl: Tradeline) -> tuple:
    """Sort key: cross-bureau inconsistencies first, then removal targets, then priority."""
    from app.services.cross_bureau import mismatch_sort_key

    mismatch_rank, creditor, _tid = mismatch_sort_key(tl)
    return (
        mismatch_rank,
        0 if is_clean_profile_removal_target(tl) else 1,
        _PRIORITY_ORDER.get(tl.repair_priority, 9),
        creditor,
    )


def sort_by_priority(tradelines: list[Tradeline]) -> list[Tradeline]:
    return sorted(tradelines, key=removal_sort_key)


def is_recommended_dispute(tl: Tradeline) -> bool:
    """Accounts staff should dispute: high/medium priority or clean-profile removal."""
    if tl.repair_priority in ("high", "medium"):
        return True
    return is_clean_profile_removal_target(tl)


def apply_high_priority_selection(report: ParsedReport) -> ParsedReport:
    """Pre-select recommended disputes when none chosen yet. Never uncheck existing selections."""
    if any(tl.selected for tl in report.tradelines):
        return report
    for tl in report.tradelines:
        if is_recommended_dispute(tl):
            tl.selected = True
            if not tl.dispute_reason:
                tl.dispute_reason = tl.suggested_dispute_reason or default_removal_dispute_reason(tl)
    return report
