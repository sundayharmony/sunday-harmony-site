"""Evidence-grounded cross-bureau inconsistency classification.

Absent reporting on another bureau is NOT treated as an error.
Staff may override via legal_flags / mismatch_summary on the tradeline.
"""

from __future__ import annotations

import re
from typing import Literal

from app.models import Tradeline

MismatchKind = Literal["cross_bureau_inconsistent", "consistent_inaccuracy", "other"]

FLAG_INCONSISTENT = "cross_bureau_inconsistent"
FLAG_CONSISTENT = "consistent_inaccuracy"
STAFF_OVERRIDE_FLAGS = frozenset({FLAG_INCONSISTENT, FLAG_CONSISTENT})

_BUREAUS = ("EQF", "EXP", "TUC")
_MARK_RE = re.compile(
    r"\b(EQF|EXP|TUC)\s*[:=]\s*(OK|C|0|30|60|90|120|CO|COL|RPO|FC|VS)(?:\s*[:=/-]\s*(\d{4}-\d{2}|\d{1,2}/\d{4}))?",
    re.I,
)


def parse_bureau_marks(text: str) -> dict[str, tuple[str, str]]:
    """Parse marks like EQF:30:2020-02;EXP:OK;TUC:OK → {EQF: (30, 2020-02), ...}."""
    out: dict[str, tuple[str, str]] = {}
    for match in _MARK_RE.finditer(text or ""):
        bureau = match.group(1).upper()
        code = match.group(2).upper()
        if code in {"C", "0"}:
            code = "OK"
        month = (match.group(3) or "").strip()
        out[bureau] = (code, month)
    return out


def _negative_mark(code: str) -> bool:
    return code.upper() not in {"OK", "C", "0", ""}


def classify_mismatch_kind(tl: Tradeline) -> tuple[MismatchKind, str]:
    """Return (kind, evidence summary). Staff flags win when explicitly set."""
    flags = {f.lower() for f in (tl.legal_flags or [])}
    summary = (getattr(tl, "mismatch_summary", None) or "").strip()

    if FLAG_INCONSISTENT in flags:
        return "cross_bureau_inconsistent", summary or _fallback_inconsistent_summary(tl)
    if FLAG_CONSISTENT in flags:
        return "consistent_inaccuracy", summary or _fallback_consistent_summary(tl)

    bureaus = [b.upper() for b in (tl.bureaus or []) if b]
    # Absent reporting is not proof of error.
    if len(set(bureaus)) < 2:
        return "other", ""

    blob = f"{tl.payment_history or ''}\n{tl.analysis_notes or ''}"
    marks = parse_bureau_marks(blob)
    reporting = [b for b in _BUREAUS if b in marks and b in set(bureaus)]
    if len(reporting) >= 2:
        values = {marks[b][0].upper() for b in reporting}
        months = {marks[b][1] for b in reporting if marks[b][1]}
        if len(values) > 1 or (months and len(months) > 1 and len(values) > 1):
            parts = [f"{b}={marks[b][0]}" + (f"@{marks[b][1]}" if marks[b][1] else "") for b in reporting]
            return "cross_bureau_inconsistent", "Payment history differs across reporting bureaus: " + "; ".join(parts)
        if all(_negative_mark(marks[b][0]) for b in reporting):
            code = marks[reporting[0]][0]
            month = marks[reporting[0]][1]
            detail = f"{code}" + (f" in {month}" if month else "")
            return (
                "consistent_inaccuracy",
                f"Same payment-history defect ({detail}) on all reporting bureaus ({', '.join(reporting)}).",
            )

    # Same late language + listed on 2+ bureaus without structured conflict → consistent pool.
    late_blob = f"{tl.status} {tl.remarks} {tl.payment_history} {tl.analysis_notes}".lower()
    if ("late" in late_blob or "delinquent" in late_blob) and len(set(bureaus)) >= 2:
        return (
            "consistent_inaccuracy",
            f"Late/delinquent reporting appears on {', '.join(sorted(set(bureaus)))} without a documented cross-bureau conflict.",
        )

    return "other", ""


def apply_cross_bureau_enrichment(tl: Tradeline) -> Tradeline:
    kind, summary = classify_mismatch_kind(tl)
    flags = list(tl.legal_flags or [])
    # Clear auto flags then re-apply (preserve other flags).
    flags = [f for f in flags if f not in STAFF_OVERRIDE_FLAGS]
    if kind == "cross_bureau_inconsistent":
        flags.append(FLAG_INCONSISTENT)
        tl.repair_priority = "high" if tl.repair_priority in ("none", "low", "medium") else tl.repair_priority
    elif kind == "consistent_inaccuracy":
        flags.append(FLAG_CONSISTENT)
        if tl.repair_priority == "none":
            tl.repair_priority = "medium"
    tl.legal_flags = flags
    if summary and not (getattr(tl, "mismatch_summary", None) or "").strip():
        tl.mismatch_summary = summary
    elif summary and kind != "other":
        # Keep staff-provided summary if present; otherwise set.
        if not (tl.mismatch_summary or "").strip():
            tl.mismatch_summary = summary
    return tl


def mismatch_sort_key(tl: Tradeline) -> tuple:
    """Round 1: inconsistencies first, then other high-priority, then consistent inaccuracies."""
    kind, _ = classify_mismatch_kind(tl)
    kind_order = {
        "cross_bureau_inconsistent": 0,
        "other": 1,
        "consistent_inaccuracy": 2,
    }[kind]
    return (kind_order, (tl.creditor or "").lower(), tl.id)


def select_for_round(
    tradelines: list[Tradeline],
    *,
    round_number: int,
    max_items: int = 7,
) -> list[Tradeline]:
    """Pick tradelines for a dispute round following the locked strategy."""
    round_number = max(1, int(round_number or 1))
    enriched = [apply_cross_bureau_enrichment(tl.model_copy(deep=True)) for tl in tradelines]
    if round_number <= 1:
        pool = sorted(enriched, key=mismatch_sort_key)
        # Prefer inconsistent; still allow other high/medium to fill ≤ max_items.
        preferred = [tl for tl in pool if FLAG_INCONSISTENT in (tl.legal_flags or [])]
        fillers = [
            tl
            for tl in pool
            if tl not in preferred and (tl.repair_priority in ("high", "medium") or FLAG_CONSISTENT in (tl.legal_flags or []))
        ]
        ordered = preferred + fillers
        return ordered[: max(1, max_items) * 3]  # multi-bureau letters share the pool; router chunks per bureau
    # Round 2+: consistent inaccuracies after mismatches are the focus.
    consistent = [tl for tl in enriched if FLAG_CONSISTENT in (tl.legal_flags or [])]
    consistent.sort(key=lambda t: (t.creditor or "").lower())
    return consistent[: max(1, max_items) * 3]


def inconsistent_reason(tl: Tradeline) -> str:
    summary = (tl.mismatch_summary or "").strip() or _fallback_inconsistent_summary(tl)
    return (
        f"{summary} This is an inaccurate and inconsistent reporting of my payment history across "
        "credit bureaus that report this account. Under FCRA §611 (15 U.S.C. §1681i), please "
        "reinvestigate and update or delete any payment-history information that cannot be verified "
        "as accurate and complete. Absence of the account on another bureau is not my claim — only "
        "conflicting information among bureaus that already report this account."
    )


def consistent_inaccuracy_reason(tl: Tradeline) -> str:
    summary = (tl.mismatch_summary or "").strip() or _fallback_consistent_summary(tl)
    return (
        f"{summary} I dispute this information as inaccurate and unverifiable as reported. "
        "Under FCRA §611 (15 U.S.C. §1681i), please reinvestigate and delete or correct any "
        "information that cannot be verified."
    )


def _fallback_inconsistent_summary(tl: Tradeline) -> str:
    return (
        f"Payment history / status for {tl.creditor or 'this account'} is reported inconsistently "
        "across the bureaus that list this account."
    )


def _fallback_consistent_summary(tl: Tradeline) -> str:
    return (
        f"The same inaccurate or unverifiable information for {tl.creditor or 'this account'} "
        "appears on the bureaus that report it."
    )
