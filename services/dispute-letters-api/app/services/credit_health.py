from __future__ import annotations

import re
from typing import Literal

from app.models import (
    BureauScores,
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


def is_negative_tradeline(tl: Tradeline) -> bool:
    if tl.is_collection:
        return True
    if any(f in tl.legal_flags for f in ("collection", "charge_off", "late_payment_error")):
        return True
    blob = f"{tl.status} {tl.remarks} {tl.account_type}"
    return bool(_DEROG_PATTERN.search(blob))


def classify_category(tl: Tradeline) -> str:
    blob = f"{tl.account_type} {tl.status} {tl.remarks} {' '.join(tl.legal_flags)}".lower()
    if tl.is_collection or "collection" in blob:
        return "collection"
    if "charge" in blob and "off" in blob:
        return "charge_off"
    if "inquir" in blob:
        return "inquiry"
    if "late" in blob or "delinquent" in blob:
        return "late_payment"
    if "balance_mismatch" in tl.legal_flags:
        return "bureau_mismatch"
    if "already_disputed" in tl.legal_flags:
        return "disputed"
    if is_negative_tradeline(tl):
        return "negative"
    return "positive"


def score_priority(tl: Tradeline) -> RepairPriority:
    category = classify_category(tl)
    if category in ("collection", "charge_off", "bureau_mismatch"):
        return "high"
    if category in ("late_payment", "disputed", "negative"):
        return "medium"
    if tl.analysis_notes or tl.suggested_dispute_reason:
        return "low"
    return "none"


def enrich_tradeline(tl: Tradeline) -> Tradeline:
    tl.item_category = classify_category(tl)
    tl.repair_priority = score_priority(tl)
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

    summary = CreditHealthSummary(
        total_accounts=len(tradelines),
        negative_count=negative,
        collection_count=collections,
        high_priority_count=high,
        repair_summary=report.analysis_summary,
        recommended_actions=_default_actions(tradelines, high, collections),
    )
    return merge_agent_health(agent_health, summary)


def _default_actions(tradelines: list[Tradeline], high: int, collections: int) -> list[str]:
    actions: list[str] = []
    if high:
        actions.append(f"Dispute {high} high-priority item(s) with bureaus and furnishers first.")
    if collections:
        actions.append("Validate collection accounts under FCRA §611 and FDCPA §809 where applicable.")
    if not actions and tradelines:
        actions.append("Review accounts marked for dispute and confirm letter targets before sending.")
    return actions


def sort_by_priority(tradelines: list[Tradeline]) -> list[Tradeline]:
    return sorted(
        tradelines,
        key=lambda tl: (_PRIORITY_ORDER.get(tl.repair_priority, 9), tl.creditor.lower()),
    )


def apply_high_priority_selection(report: ParsedReport) -> ParsedReport:
    """Pre-select high-priority tradelines when user has not chosen any yet."""
    if any(tl.selected for tl in report.tradelines):
        return report
    for tl in report.tradelines:
        if tl.repair_priority == "high":
            tl.selected = True
            if not tl.dispute_reason:
                tl.dispute_reason = tl.suggested_dispute_reason
    return report
