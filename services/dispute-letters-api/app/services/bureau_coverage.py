"""Detect which bureaus a credit report covers and compute per-bureau health counts."""

from __future__ import annotations

import re

from app.models import (
    BureauCode,
    BureauCoverage,
    ParsedReport,
    PerBureauHealth,
    Tradeline,
)
from app.services.credit_health import is_negative_tradeline

_BUREAU_ORDER: tuple[BureauCode, ...] = ("TUC", "EXP", "EQF")

_FILENAME_PATTERNS: list[tuple[BureauCode, re.Pattern[str]]] = [
    ("EXP", re.compile(r"experian|(?:^|[\s_\-./])exp(?:[\s_\-./]|$)", re.I)),
    (
        "TUC",
        re.compile(r"trans[\s_\-]*union|(?:^|[\s_\-./])tu(?:[\s_\-./]|$)|(?:^|[\s_\-./])tuc(?:[\s_\-./]|$)", re.I),
    ),
    (
        "EQF",
        re.compile(r"equifax|(?:^|[\s_\-./])eqf(?:[\s_\-./]|$)", re.I),
    ),
]
_TRI_MERGE_PATTERN = re.compile(
    r"3[\s_-]*bureau|tri[\s_-]*merge|all[\s_-]*three|credit[\s_-]*hero",
    re.I,
)


def _score_present(value: int | None) -> bool:
    return isinstance(value, int) and 300 <= value <= 850


def _account_for_bureau(tl: Tradeline, bureau: BureauCode) -> str:
    if bureau == "EXP":
        return (tl.account_exp or "").strip()
    if bureau == "TUC":
        return (tl.account_tu or "").strip()
    return (tl.account_eqf or "").strip()


def tradeline_covers_bureau(tl: Tradeline, bureau: BureauCode) -> bool:
    if bureau in (tl.bureaus or []):
        return True
    return bool(_account_for_bureau(tl, bureau))


def bureau_health_counts(report: ParsedReport, bureau: BureauCode) -> PerBureauHealth:
    tradelines = [tl for tl in report.tradelines if tradeline_covers_bureau(tl, bureau)]
    negative = sum(1 for tl in tradelines if is_negative_tradeline(tl))
    collections = sum(
        1 for tl in tradelines if tl.is_collection or (tl.item_category or "") == "collection"
    )
    return PerBureauHealth(
        total_accounts=len(tradelines),
        negative_count=negative,
        collection_count=collections,
    )


def filename_bureau_hint(file_name: str = "") -> list[BureauCode]:
    """Bureaus the filename suggests, used only when the report itself shows no evidence."""
    name = (file_name or "").strip()
    if not name:
        return []
    if _TRI_MERGE_PATTERN.search(name):
        return list(_BUREAU_ORDER)
    found = {bureau for bureau, pattern in _FILENAME_PATTERNS if pattern.search(name)}
    return [b for b in _BUREAU_ORDER if b in found]


def _bureaus_from_account_evidence(report: ParsedReport) -> list[BureauCode]:
    found: set[BureauCode] = set()
    for tl in report.tradelines or []:
        for bureau in _BUREAU_ORDER:
            if tradeline_covers_bureau(tl, bureau):
                found.add(bureau)
    if report.credit_health and report.credit_health.per_bureau:
        for bureau in _BUREAU_ORDER:
            row = report.credit_health.per_bureau.get(bureau)
            if row and (row.total_accounts or 0) > 0:
                found.add(bureau)
    return [b for b in _BUREAU_ORDER if b in found]


def _strip_untrusted_scores(report: ParsedReport, coverage: BureauCoverage) -> None:
    """Drop bureau scores that were stored without matching account evidence."""
    if not report.credit_health:
        return
    if not _bureaus_from_account_evidence(report):
        return
    scores = report.credit_health.scores
    allowed = list(coverage.bureaus or [])
    for bureau, attr in (("TUC", "tuc"), ("EXP", "exp"), ("EQF", "eqf")):
        value = getattr(scores, attr)
        if not _score_present(value):
            continue
        if any(tradeline_covers_bureau(tl, bureau) for tl in report.tradelines or []):
            continue
        row = (report.credit_health.per_bureau or {}).get(bureau)
        if row and (row.total_accounts or 0) > 0:
            continue
        if len(allowed) == 1 and allowed[0] == bureau:
            continue
        setattr(scores, attr, None)


def detect_bureau_coverage(report: ParsedReport, file_name: str = "") -> BureauCoverage:
    """Infer bureau coverage from tradelines first, then scores/filename when empty."""
    found: set[BureauCode] = set()
    confidence: str = "low"

    from_accounts = _bureaus_from_account_evidence(report)
    if from_accounts:
        found.update(from_accounts)
        confidence = "medium"
    else:
        scores = report.credit_health.scores if report.credit_health else None
        if scores:
            if _score_present(scores.tuc):
                found.add("TUC")
            if _score_present(scores.exp):
                found.add("EXP")
            if _score_present(scores.eqf):
                found.add("EQF")
            if found:
                confidence = "high"
        if not found:
            for bureau in filename_bureau_hint(file_name):
                found.add(bureau)
                if confidence == "low":
                    confidence = "medium"

    ordered = [b for b in _BUREAU_ORDER if b in found]
    if not ordered:
        # Unknown — treat as empty coverage with low confidence; UI can still show combined.
        return BureauCoverage(bureaus=[], coverage="single", confidence="low")

    n = len(ordered)
    coverage: str
    if n >= 3:
        coverage = "tri_merge"
    elif n == 2:
        coverage = "dual"
    else:
        coverage = "single"

    return BureauCoverage(bureaus=ordered, coverage=coverage, confidence=confidence)  # type: ignore[arg-type]


def apply_bureau_coverage(report: ParsedReport, file_name: str = "") -> ParsedReport:
    """Set bureau_coverage and credit_health.per_bureau on the report."""
    coverage = detect_bureau_coverage(report, file_name)
    report.bureau_coverage = coverage
    per_bureau: dict[str, PerBureauHealth] = {}
    for bureau in coverage.bureaus or list(_BUREAU_ORDER):
        per_bureau[bureau] = bureau_health_counts(report, bureau)
    # Always populate known bureaus that have tradeline evidence even if coverage empty.
    if not coverage.bureaus:
        for bureau in _BUREAU_ORDER:
            counts = bureau_health_counts(report, bureau)
            if counts.total_accounts > 0:
                per_bureau[bureau] = counts
    report.credit_health.per_bureau = per_bureau
    _strip_untrusted_scores(report, coverage)
    return report
