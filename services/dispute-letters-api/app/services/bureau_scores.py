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
_CREDIT_HERO_RATING = r"(?:very\s+poor|poor|fair|good|excellent|great)"
# Credit Hero member PDF: three VantageScore gauges after "All bureaus" (TUC, EXP, EQF).
_CREDIT_HERO_ALL_BUREAUS = re.compile(
    rf"all\s+bureaus\s+(?:bureau\s+)?"
    rf"(\d{{3}})\s+{_CREDIT_HERO_RATING}\b"
    rf"[\s\S]{{0,120}}?"
    rf"(\d{{3}})\s+{_CREDIT_HERO_RATING}\b"
    rf"[\s\S]{{0,120}}?"
    rf"(\d{{3}})\s+{_CREDIT_HERO_RATING}\b",
    re.I,
)
# Newer Credit Hero "All bureaus" PDF: header TransUnion Equifax Experian, then
# "621 FAIR 631 FAIR 625 FAIR" (optional "Bureau" chrome between header and scores).
_CREDIT_HERO_INLINE_RATINGS = re.compile(
    rf"trans\s*union\s+equifax\s+experian\s+all\s+bureaus"
    rf"(?:\s+bureau)?"
    rf"\s+(\d{{3}})\s+{_CREDIT_HERO_RATING}"
    rf"\s+(\d{{3}})\s+{_CREDIT_HERO_RATING}"
    rf"\s+(\d{{3}})\s+{_CREDIT_HERO_RATING}\b",
    re.I,
)
# Any tri-bureau header order near three score+rating gauges.
_SCORE_RATING_TRIPLET = re.compile(
    rf"(\d{{3}})\s+{_CREDIT_HERO_RATING}\s+(\d{{3}})\s+{_CREDIT_HERO_RATING}\s+(\d{{3}})\s+{_CREDIT_HERO_RATING}\b",
    re.I,
)
_BUREAU_HEADER_ORDERS: tuple[tuple[re.Pattern[str], tuple[str, str, str]], ...] = (
    (re.compile(r"trans\s*union\s+equifax\s+experian", re.I), ("tuc", "eqf", "exp")),
    (re.compile(r"trans\s*union\s+experian\s+equifax", re.I), ("tuc", "exp", "eqf")),
    (re.compile(r"experian\s+equifax\s+trans\s*union", re.I), ("exp", "eqf", "tuc")),
    (re.compile(r"experian\s+trans\s*union\s+equifax", re.I), ("exp", "tuc", "eqf")),
    (re.compile(r"equifax\s+experian\s+trans\s*union", re.I), ("eqf", "exp", "tuc")),
    (re.compile(r"equifax\s+trans\s*union\s+experian", re.I), ("eqf", "tuc", "exp")),
)
_VANTAGE_DISCLAIMER = re.compile(
    r"your\s+vantagescore.*?from\s+transunion,\s*equifax,\s*and\s+experian\s+indicates",
    re.I | re.S,
)

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


def _token_is_plausible_score(text: str, start: int, end: int) -> bool:
    """Reject phone area codes, apartment/unit numbers, and other non-score digits."""
    window = text[max(0, start - 20) : min(len(text), end + 20)]
    if re.search(r"\(\d{3}\)\s*\d{3}", window):
        return False
    if re.search(r"\bunit\s+\d{3}\b", window, re.I):
        return False
    if re.search(r"\bapt\s+\d", window, re.I):
        return False
    if re.search(r"\bst\s+\d", window, re.I):
        return False
    return True


def _in_vantage_disclaimer(text: str, index: int) -> bool:
    """True when index falls inside the generic tri-bureau VantageScore disclaimer."""
    for match in _VANTAGE_DISCLAIMER.finditer(text):
        if match.start() <= index <= match.end():
            return True
    return False


# Member PDF: the gauge number sits above "based on Experian/Equifax/TransUnion data".
_BASED_ON_BUREAU = re.compile(
    r"(\d{3})[^\d]{0,40}?(?:very\s+poor|poor|fair|good|excellent)\b"
    r"[\s\S]{0,120}?based\s+on\s+(experian|equifax|trans\s*union)",
    re.I,
)
# Tri-merge PDF: TransUnion, Equifax, Experian scores on one line after the model version.
_CREDIT_HERO_GAUGE_ROW = re.compile(
    r"all\s+bureaus[\s\S]{0,220}?vantagescore[^\d]{0,24}\d\.\d\s+(\d{3})\s+(\d{3})\s+(\d{3})",
    re.I,
)
_SCORE_SCALE = re.compile(r"300\D{0,20}500\D{0,20}600\D{0,20}660\D{0,20}850")


def _in_score_scale(text: str, index: int) -> bool:
    for match in _SCORE_SCALE.finditer(text):
        if match.start() <= index <= match.end():
            return True
    return False


def _assign_hero_triplet(scores: BureauScores, tuc: int | None, eqf: int | None, exp: int | None) -> bool:
    if tuc is not None:
        scores.tuc = tuc
    if eqf is not None:
        scores.eqf = eqf
    if exp is not None:
        scores.exp = exp
    return not scores_missing(scores)


def _assign_by_attrs(scores: BureauScores, attrs: tuple[str, str, str], values: tuple[int | None, int | None, int | None]) -> bool:
    for attr, value in zip(attrs, values):
        if value is not None:
            setattr(scores, attr, value)
    return not scores_missing(scores)


def scores_look_cloned(scores: BureauScores | None) -> bool:
    """True when all three bureau scores are the same non-null value."""
    if scores is None or scores.tuc is None or scores.exp is None or scores.eqf is None:
        return False
    return scores.tuc == scores.exp == scores.eqf


def _tri_bureau_header_cluster(text: str, index: int, window: int = 80) -> bool:
    """True when index sits inside a compact tri-bureau column header.

    Separate lines like `TransUnion credit score 640` / `Experian credit score 655`
    are not a shared header and must still use the per-bureau fallback.
    """
    start = max(0, index - window)
    end = min(len(text), index + window)
    region = text[start:end]
    return any(pattern.search(region) for pattern, _ in _BUREAU_HEADER_ORDERS)


def _scores_from_header_rating_triplet(text: str, scores: BureauScores) -> bool:
    """Match NNN RATING ×3 near a labeled bureau header, in that header's column order."""
    for header_re, attrs in _BUREAU_HEADER_ORDERS:
        for header in header_re.finditer(text):
            window = text[header.start() : header.start() + 500]
            triplet = _SCORE_RATING_TRIPLET.search(window)
            if not triplet:
                continue
            abs_start = header.start() + triplet.start(1)
            if _in_score_scale(text, abs_start):
                continue
            values = tuple(parse_score_value(triplet.group(i)) for i in (1, 2, 3))
            if any(v is None for v in values):
                continue
            return _assign_by_attrs(scores, attrs, values)  # type: ignore[arg-type]
    return False


def _scores_from_credit_hero_all_bureaus(text: str, scores: BureauScores) -> bool:
    gauges = _CREDIT_HERO_GAUGE_ROW.search(text)
    if gauges:
        tuc, eqf, exp = (parse_score_value(gauges.group(i)) for i in (1, 2, 3))
        if not _in_score_scale(text, gauges.start(1)):
            return _assign_hero_triplet(scores, tuc, eqf, exp)
    # Prefer the labeled TransUnion / Equifax / Experian row when present.
    inline = _CREDIT_HERO_INLINE_RATINGS.search(text)
    if inline:
        tuc, eqf, exp = (parse_score_value(inline.group(i)) for i in (1, 2, 3))
        if not _in_score_scale(text, inline.start(1)):
            return _assign_hero_triplet(scores, tuc, eqf, exp)
    match = _CREDIT_HERO_ALL_BUREAUS.search(text)
    if not match:
        return False
    # Older export without a bureau header: score+rating gauges in TUC, EXP, EQF order.
    # When the TU/EQF/EXP header is nearby, treat the triplet as that column order instead.
    header_nearby = bool(
        re.search(
            r"trans\s*union\s+equifax\s+experian\s+all\s+bureaus",
            text[max(0, match.start() - 80) : match.start() + 40],
            re.I,
        )
    )
    if header_nearby:
        tuc, eqf, exp = (parse_score_value(match.group(i)) for i in (1, 2, 3))
        return _assign_hero_triplet(scores, tuc, eqf, exp)
    tuc, exp, eqf = (parse_score_value(match.group(i)) for i in (1, 2, 3))
    return _assign_hero_triplet(scores, tuc, eqf, exp)


def _scores_from_based_on_bureau(text: str, scores: BureauScores) -> bool:
    match = _BASED_ON_BUREAU.search(text)
    if not match:
        return False
    parsed = parse_score_value(match.group(1))
    if parsed is None or _in_score_scale(text, match.start(1)):
        return False
    bureau = re.sub(r"\s+", "", match.group(2).lower())
    attr = {"experian": "exp", "equifax": "eqf", "transunion": "tuc"}.get(bureau)
    if not attr:
        return False
    setattr(scores, attr, parsed)
    return True


def _first_score_from_patterns(text: str, patterns: tuple[re.Pattern[str], ...] = _SCORE_VALUE_PATTERNS) -> int | None:
    for pattern in patterns:
        match = pattern.search(text)
        if not match:
            continue
        parsed = parse_score_value(match.group(1))
        if parsed is not None:
            return parsed
    return None


def _find_score_near_bureau(
    text: str,
    match: re.Match[str],
    *,
    used_spans: set[tuple[int, int]],
) -> tuple[int, tuple[int, int]] | None:
    """Return (score, span) near a bureau label, skipping spans already claimed."""
    after = text[match.end() : match.end() + 120]
    before = text[max(0, match.start() - 120) : match.start()]
    if not _SCORE_CONTEXT.search(f"{before}{after}"):
        return None

    def from_patterns(region: str, region_start: int) -> tuple[int, tuple[int, int]] | None:
        for pattern in _SCORE_VALUE_PATTERNS:
            found = pattern.search(region)
            if not found:
                continue
            parsed = parse_score_value(found.group(1))
            if parsed is None:
                continue
            # group(1) is the score digits inside the pattern match.
            abs_start = region_start + found.start(1)
            abs_end = abs_start + len(found.group(1))
            span = (abs_start, abs_end)
            if span in used_spans or _in_score_scale(text, abs_start):
                continue
            if not _token_is_plausible_score(text, abs_start, abs_end):
                continue
            return parsed, span
        return None

    for region, region_start in (
        (after, match.end()),
        (before, max(0, match.start() - 120)),
    ):
        hit = from_patterns(region, region_start)
        if hit is not None:
            return hit

    for region, region_start in (
        (after, match.end()),
        (before, max(0, match.start() - 120)),
    ):
        for token in _SCORE_TOKEN.finditer(region):
            abs_start = region_start + token.start()
            abs_end = abs_start + len(token.group(1))
            span = (abs_start, abs_end)
            if span in used_spans:
                continue
            if not _token_is_plausible_score(text, abs_start, abs_end):
                continue
            if _in_score_scale(text, abs_start):
                continue
            parsed = parse_score_value(token.group(1))
            if parsed is not None:
                return parsed, span
    return None


def scores_from_text(text: str) -> BureauScores:
    scores = BureauScores()
    if not text:
        return scores
    # SmartCredit 3B header: TransUnion / Experian / Equifax then three scores.
    from app.parsers import smartcredit

    if smartcredit.can_parse_text(text):
        sc_scores = smartcredit.parse_scores(text)
        if not scores_missing(sc_scores):
            return sc_scores
    if _scores_from_credit_hero_all_bureaus(text, scores):
        return scores
    if _scores_from_header_rating_triplet(text, scores):
        return scores
    if _scores_from_based_on_bureau(text, scores):
        return scores

    used_spans: set[tuple[int, int]] = set()
    for attr, pattern in _BUREAU_PATTERNS:
        for match in pattern.finditer(text):
            if _in_vantage_disclaimer(text, match.start()):
                continue
            # Shared "TransUnion Equifax Experian" headers must use triplet extractors,
            # not stamp the first nearby gauge onto every bureau.
            if _tri_bureau_header_cluster(text, match.start()):
                continue
            hit = _find_score_near_bureau(text, match, used_spans=used_spans)
            if hit is None:
                continue
            parsed, span = hit
            setattr(scores, attr, parsed)
            used_spans.add(span)
            break

    if scores_missing(scores):
        _scores_from_header_row(text, scores)

    # Last resort: if we somehow still cloned from a broken path, prefer a distinct
    # header rating triplet when the PDF actually has three different gauges.
    if scores_look_cloned(scores):
        repaired = BureauScores()
        if _scores_from_header_rating_triplet(text, repaired) and not scores_look_cloned(repaired):
            return repaired
        if _scores_from_credit_hero_all_bureaus(text, repaired) and not scores_look_cloned(repaired):
            return repaired
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
