"""Extract and merge bureau credit scores from report HTML/text."""

from __future__ import annotations

import re

from app.models import BureauScores, ParsedReport

_SCORE_TOKEN = re.compile(r"\b([3-8]\d{2})\b")
_BUREAU_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("tuc", re.compile(r"trans\s*union|\btuc\b|\btu\b(?![a-z])", re.I)),
    ("exp", re.compile(r"experian|\bexp\b", re.I)),
    ("eqf", re.compile(r"equifax|\beqf\b", re.I)),
)
_SCORE_CONTEXT = re.compile(
    r"(?:credit\s+)?(?:fico\s*)?(?:vantage\s*)?score|vantagescore",
    re.I,
)


def parse_score_value(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        n = int(value)
        return n if 300 <= n <= 850 else None
    text = str(value).replace(",", "").strip()
    if not text or text in {"-", "—", "n/a", "na", "none"}:
        return None
    try:
        n = int(float(text))
        return n if 300 <= n <= 850 else None
    except (TypeError, ValueError):
        pass
    match = _SCORE_TOKEN.search(text)
    if not match:
        return None
    n = int(match.group(1))
    return n if 300 <= n <= 850 else None


def scores_missing(scores: BureauScores | None) -> bool:
    if scores is None:
        return True
    return scores.tuc is None and scores.exp is None and scores.eqf is None


def apply_scores_if_missing(target: BureauScores, incoming: BureauScores | None) -> BureauScores:
    if incoming is None:
        return target
    if target.tuc is None:
        target.tuc = incoming.tuc
    if target.exp is None:
        target.exp = incoming.exp
    if target.eqf is None:
        target.eqf = incoming.eqf
    return target


def scores_from_text(text: str) -> BureauScores:
    scores = BureauScores()
    if not text:
        return scores
    for attr, pattern in _BUREAU_PATTERNS:
        for match in pattern.finditer(text):
            ctx = text[max(0, match.start() - 100) : match.end() + 80]
            if not _SCORE_CONTEXT.search(ctx):
                continue
            token = _SCORE_TOKEN.search(text[match.end() : match.end() + 80])
            if not token:
                continue
            parsed = parse_score_value(token.group(1))
            if parsed is not None:
                setattr(scores, attr, parsed)
                break
    if scores_missing(scores):
        _scores_from_header_row(text, scores)
    return scores


def _scores_from_header_row(text: str, scores: BureauScores) -> None:
    """IdentityIQ-style: TransUnion Experian Equifax headers, then Credit Score: 721 698 705."""
    header = re.search(
        r"trans\s*union.{0,40}experian.{0,40}equifax.{0,200}?credit\s+score\s*:?\s*"
        r"(\d{3})\D+(\d{3})\D+(\d{3})",
        text,
        re.I | re.S,
    )
    if not header:
        header = re.search(
            r"credit\s+score\s*:?\s*(\d{3})\D+(\d{3})\D+(\d{3})",
            text,
            re.I,
        )
        # Only use unlabeled triples when nearby bureau names exist.
        if header and not re.search(r"trans\s*union.{0,400}experian.{0,400}equifax", text, re.I | re.S):
            return
    if not header:
        return
    tuc, exp, eqf = (parse_score_value(header.group(i)) for i in (1, 2, 3))
    if scores.tuc is None:
        scores.tuc = tuc
    if scores.exp is None:
        scores.exp = exp
    if scores.eqf is None:
        scores.eqf = eqf


def fill_missing_scores(report: ParsedReport, *, html: str = "", text: str = "") -> ParsedReport:
    if report.credit_health is None:
        from app.models import CreditHealthSummary

        report.credit_health = CreditHealthSummary()
    current = report.credit_health.scores
    if html:
        from app.parsers import identityiq

        if identityiq.can_parse(html):
            apply_scores_if_missing(current, identityiq.parse_scores(html))
        apply_scores_if_missing(current, scores_from_text(html))
    if text:
        apply_scores_if_missing(current, scores_from_text(text))
    return report
