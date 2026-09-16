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
# FICO Score 8 / VantageScore 3.0 put a model digit between "score" and the 3-digit value.
_SCORE_VALUE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"fico(?:\s*®)?\s*score\s*[\d.]+[^\d]{0,60}(\d{3})", re.I),
    re.compile(r"vantage\s*score\s*[\d.]+[^\d]{0,60}(\d{3})", re.I),
    re.compile(r"(?:credit\s+)?score(?!\s*range)[:\s]+(\d{3})(?!\s*[-–])", re.I),
    re.compile(r"your\s+(?:fico\s+)?score(?:\s+is)?[^\d]{0,30}(\d{3})", re.I),
    re.compile(r"\b(\d{3})\b[^\d]{0,50}fico", re.I),
    re.compile(r"fico[^\d]{0,80}?(\d{3})\b", re.I),
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


def _first_score_from_patterns(text: str, patterns: tuple[re.Pattern[str], ...] = _SCORE_VALUE_PATTERNS) -> int | None:
    for pattern in patterns:
        match = pattern.search(text)
        if not match:
            continue
        parsed = parse_score_value(match.group(1))
        if parsed is not None:
            return parsed
    return None


def scores_from_text(text: str) -> BureauScores:
    scores = BureauScores()
    if not text:
        return scores
    for attr, pattern in _BUREAU_PATTERNS:
        for match in pattern.finditer(text):
            after = text[match.end() : match.end() + 120]
            before = text[max(0, match.start() - 120) : match.start()]
            if not _SCORE_CONTEXT.search(f"{before}{after}"):
                continue
            parsed = _first_score_from_patterns(after)
            if parsed is None:
                parsed = _first_score_from_patterns(before)
            if parsed is None:
                token = _SCORE_TOKEN.search(after)
                if not token:
                    token = _SCORE_TOKEN.search(before)
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


_FILENAME_BUREAU_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("exp", re.compile(r"experian|(?:^|[\s_\-./])exp(?:[\s_\-./]|$)", re.I)),
    (
        "tuc",
        re.compile(r"trans[\s_\-]*union|(?:^|[\s_\-./])tu(?:[\s_\-./]|$)|(?:^|[\s_\-./])tuc(?:[\s_\-./]|$)", re.I),
    ),
    ("eqf", re.compile(r"equifax|(?:^|[\s_\-./])eqf(?:[\s_\-./]|$)", re.I)),
)


def infer_bureau_key_from_filename(file_name: str) -> str | None:
    name = (file_name or "").strip()
    if not name:
        return None
    if re.search(r"3[\s_-]*bureau|tri[\s_-]*merge|credit[\s_-]*hero", name, re.I):
        return None
    for attr, pattern in _FILENAME_BUREAU_PATTERNS:
        if pattern.search(name):
            return attr
    return None


def scores_from_single_bureau_document(text: str, file_name: str = "") -> BureauScores:
    """Assign a lone credit score to the bureau implied by the upload filename."""
    bureau_key = infer_bureau_key_from_filename(file_name)
    if not bureau_key or not text:
        return BureauScores()
    scores = scores_from_text(text)
    if not scores_missing(scores):
        return scores
    parsed = _first_score_from_patterns(text)
    if parsed is not None:
        out = BureauScores()
        setattr(out, bureau_key, parsed)
        return out
    return BureauScores()


def fill_missing_scores(
    report: ParsedReport,
    *,
    html: str = "",
    text: str = "",
    file_name: str = "",
) -> ParsedReport:
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
    combined = f"{html}\n{text}".strip()
    if file_name and combined:
        apply_scores_if_missing(current, scores_from_single_bureau_document(combined, file_name))
    return report
