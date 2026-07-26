"""
Credit Intelligence Engine — factor analysis, funding readiness, and recommendations.

Synthesizes educational concepts from CFPB, FTC, myFICO, bureau education, and
FCRA reporting/dispute rules into original analysis. Does not compute a FICO
score or guarantee lender outcomes.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from app.models import (
    CreditIntelligenceReport,
    FactorAnalysis,
    FundingContext,
    FundingReadinessAssessment,
    OverallCreditHealth,
    Recommendation,
    ParsedReport,
    Tradeline,
)
from app.services.credit_health import (
    classify_category,
    enrich_tradeline,
    is_closed_tradeline,
    is_negative_tradeline,
)
from app.services.money_parse import months_between, parse_date, parse_money

# Educational utilization thresholds (CFPB / industry guidance framing)
_UTIL_EXCELLENT = 0.10
_UTIL_GOOD = 0.30
_UTIL_HIGH = 0.50
_UTIL_CRITICAL = 0.70

# FCRA obsolescence heuristics (15 U.S.C. §1681c) — months
_OBSOLETE_STANDARD_MONTHS = 84  # 7 years
_OBSOLETE_COLLECTION_MONTHS = 90  # ~7 years + 180 days
_BANKRUPTCY_MONTHS = 120  # 10 years

import re

_REVOLVING_RE = re.compile(
    r"revolving|credit\s*card|charge\s*card|\bc\s*/\s*c\b|\bcard\b|line\s*of\s*credit|\bloc\b",
    re.I,
)
_INSTALLMENT_RE = re.compile(
    r"installment|auto|vehicle|mortgage|home|student|personal\s*loan|installment\s*loan|\bloan\b",
    re.I,
)
_MORTGAGE_RE = re.compile(r"mortgage|home\s*loan|real\s*estate|heloc|home\s*equity", re.I)
_AUTO_RE = re.compile(r"\bauto\b|vehicle|car\s*loan|motor", re.I)
_STUDENT_RE = re.compile(r"student|education\s*loan|\bedu\b", re.I)
_INQUIRY_RE = re.compile(r"inquir", re.I)
_PUBLIC_RE = re.compile(r"bankrupt|judgment|lien|public\s*record|foreclos", re.I)


def _today() -> date:
    return date.today()


def _account_blob(tl: Tradeline) -> str:
    return f"{tl.account_type} {tl.status} {tl.remarks} {tl.creditor}"


def is_revolving(tl: Tradeline) -> bool:
    return bool(_REVOLVING_RE.search(_account_blob(tl))) and not bool(
        _MORTGAGE_RE.search(_account_blob(tl))
    )


def is_installment(tl: Tradeline) -> bool:
    blob = _account_blob(tl)
    if is_revolving(tl):
        return False
    return bool(_INSTALLMENT_RE.search(blob))


def mix_bucket(tl: Tradeline) -> str:
    blob = _account_blob(tl)
    if _MORTGAGE_RE.search(blob):
        return "mortgage"
    if _AUTO_RE.search(blob):
        return "auto"
    if _STUDENT_RE.search(blob):
        return "student"
    if is_revolving(tl):
        return "revolving"
    if "personal" in blob.lower() or is_installment(tl):
        return "installment"
    if tl.is_collection or classify_category(tl) == "collection":
        return "collection"
    if _INQUIRY_RE.search(blob) or classify_category(tl) == "inquiry":
        return "inquiry"
    if _PUBLIC_RE.search(blob):
        return "public_record"
    return "other"


def _dofd(tl: Tradeline) -> date | None:
    return (
        parse_date(tl.date_of_first_delinquency)
        or parse_date(tl.date_opened)
        or parse_date(tl.last_reported)
    )


def _age_months(tl: Tradeline, as_of: date) -> int | None:
    opened = parse_date(tl.date_opened)
    if not opened:
        return None
    return max(0, months_between(as_of, opened))


def _utilization(balance: float | None, limit: float | None) -> float | None:
    if balance is None or limit is None or limit <= 0:
        return None
    return max(0.0, balance) / limit


def _impact_label(util: float | None) -> str:
    if util is None:
        return "unknown"
    if util <= _UTIL_EXCELLENT:
        return "low"
    if util <= _UTIL_GOOD:
        return "moderate"
    if util <= _UTIL_HIGH:
        return "elevated"
    if util <= _UTIL_CRITICAL:
        return "high"
    return "severe"


def _confidence(has_limits: bool, has_dates: bool, extraction_quality: str) -> float:
    base = {"high": 0.85, "medium": 0.65, "low": 0.4}.get(extraction_quality, 0.6)
    if has_limits:
        base += 0.08
    if has_dates:
        base += 0.07
    return round(min(0.95, base), 2)


def analyze_payment_history(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    late = []
    positive = 0
    for tl in tradelines:
        cat = classify_category(tl)
        if cat in ("late_payment", "collection", "charge_off", "closed_derogatory", "negative"):
            dofd = _dofd(tl)
            age_m = months_between(as_of, dofd) if dofd else None
            late.append(
                {
                    "tradeline_id": tl.id,
                    "creditor": tl.creditor,
                    "category": cat,
                    "status": tl.status,
                    "age_months": age_m,
                    "severity": (
                        "severe"
                        if cat in ("collection", "charge_off")
                        else "moderate"
                        if cat == "late_payment"
                        else "elevated"
                    ),
                }
            )
        elif not is_negative_tradeline(tl) and not is_closed_tradeline(tl):
            positive += 1
        elif not is_negative_tradeline(tl):
            positive += 1

    recent = [x for x in late if x.get("age_months") is not None and x["age_months"] < 24]
    strength = "strong" if not late and positive else "mixed" if late and positive else "weak"
    summary = (
        f"{len(late)} derogatory payment signal(s); {positive} account(s) without clear negatives. "
        f"{len(recent)} appear within the last 24 months (when dates were available)."
    )
    return FactorAnalysis(
        factor="payment_history",
        weight_hint=0.35,
        summary=summary,
        score_band=strength,
        findings=late[:40],
        strengths=(["Consistent non-derogatory open accounts support payment history."] if positive and not late else []),
        weaknesses=(
            [f"{len(late)} late/derogatory item(s) weigh heavily on payment history (~35% factor)."]
            if late
            else []
        ),
    )


def analyze_revolving(tradelines: list[Tradeline], extraction_quality: str) -> FactorAnalysis:
    revolving = [tl for tl in tradelines if is_revolving(tl) and not tl.is_collection]
    balances: list[float] = []
    limits: list[float] = []
    per_account: list[dict[str, Any]] = []
    missing_limits = 0

    for tl in revolving:
        bal = parse_money(tl.balance)
        lim = parse_money(tl.credit_limit)
        util = _utilization(bal, lim)
        if lim is None:
            missing_limits += 1
        if bal is not None:
            balances.append(bal)
        if lim is not None and lim > 0:
            limits.append(lim)
        per_account.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "balance": bal,
                "credit_limit": lim,
                "utilization": round(util, 3) if util is not None else None,
                "impact": _impact_label(util),
            }
        )

    total_bal = sum(balances) if balances else None
    total_lim = sum(limits) if limits else None
    overall_util = _utilization(total_bal, total_lim)
    available = (total_lim - total_bal) if total_lim is not None and total_bal is not None else None

    band = _impact_label(overall_util)
    if overall_util is None:
        band = "unknown"

    strategies: list[str] = []
    if overall_util is not None and overall_util > _UTIL_GOOD:
        strategies.append(
            "Reduce revolving balances toward under ~30% of aggregate limits before new credit applications."
        )
        # Suggest paying highest-util cards first for optics
        high = sorted(
            [a for a in per_account if a.get("utilization") is not None],
            key=lambda a: a["utilization"],
            reverse=True,
        )
        for a in high[:3]:
            if a["utilization"] and a["utilization"] > _UTIL_GOOD:
                strategies.append(
                    f"Prioritize paying down {a['creditor']} (≈{int(a['utilization'] * 100)}% utilization)."
                )
        strategies.append(
            "Where appropriate, request a credit-limit increase on clean accounts without opening new lines."
        )
    elif overall_util is not None and overall_util <= _UTIL_GOOD:
        strategies.append("Maintain revolving utilization at or below current healthy levels.")

    if missing_limits:
        strategies.append(
            f"{missing_limits} revolving account(s) lack credit limits in the extract — confirm limits for accurate utilization math."
        )

    summary = (
        f"{len(revolving)} revolving account(s). "
        + (
            f"Aggregate utilization ≈ {int(overall_util * 100)}% "
            f"(${total_bal:,.0f} of ${total_lim:,.0f})."
            if overall_util is not None and total_bal is not None and total_lim is not None
            else "Aggregate utilization could not be computed (missing balances or limits)."
        )
    )
    if available is not None:
        summary += f" Estimated available revolving credit ≈ ${available:,.0f}."

    return FactorAnalysis(
        factor="revolving_utilization",
        weight_hint=0.30,
        summary=summary,
        score_band=band,
        findings=per_account,
        metrics={
            "revolving_count": len(revolving),
            "aggregate_balance": total_bal,
            "aggregate_limit": total_lim,
            "aggregate_utilization": round(overall_util, 4) if overall_util is not None else None,
            "available_credit": available,
            "missing_limits": missing_limits,
            "confidence": _confidence(total_lim is not None, False, extraction_quality),
        },
        strengths=(
            ["Revolving utilization appears within commonly cited healthy ranges."]
            if overall_util is not None and overall_util <= _UTIL_GOOD
            else []
        ),
        weaknesses=(
            ["Elevated revolving utilization may pressure score and funding optics."]
            if overall_util is not None and overall_util > _UTIL_GOOD
            else []
        ),
        recommendations=strategies,
    )


def analyze_installment(tradelines: list[Tradeline]) -> FactorAnalysis:
    installment = [
        tl
        for tl in tradelines
        if mix_bucket(tl) in ("installment", "auto", "mortgage", "student")
        or (is_installment(tl) and not is_revolving(tl))
    ]
    findings = []
    for tl in installment:
        findings.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "bucket": mix_bucket(tl),
                "balance": parse_money(tl.balance),
                "status": tl.status,
                "negative": is_negative_tradeline(tl),
                "mix_effect": "hurts" if is_negative_tradeline(tl) else "helps",
            }
        )
    healthy = sum(1 for f in findings if not f["negative"])
    summary = (
        f"{len(installment)} installment-style account(s); {healthy} without clear negatives. "
        "Healthy installment tradelines can support credit-mix diversity."
    )
    return FactorAnalysis(
        factor="installment_loans",
        weight_hint=0.10,
        summary=summary,
        score_band="strong" if healthy and not any(f["negative"] for f in findings) else "mixed",
        findings=findings,
        strengths=(["Installment diversity present."] if healthy else []),
        weaknesses=(
            ["Negative installment history present."]
            if any(f["negative"] for f in findings)
            else []
        ),
    )


def analyze_collections(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    cols = [
        tl
        for tl in tradelines
        if tl.is_collection or classify_category(tl) == "collection"
    ]
    findings = []
    for tl in cols:
        dofd = _dofd(tl)
        age_m = months_between(as_of, dofd) if dofd else None
        possibly_obsolete = age_m is not None and age_m >= _OBSOLETE_COLLECTION_MONTHS
        findings.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "balance": parse_money(tl.balance),
                "status": tl.status,
                "last_reported": tl.last_reported,
                "age_months": age_m,
                "possibly_obsolete": possibly_obsolete,
                "estimated_impact": "high",
                "strategy": (
                    "Screen for obsolete reporting under FCRA §605 timing rules; "
                    "dispute inaccurate/unverifiable data under §611 / furnisher duties under §623."
                    if possibly_obsolete
                    else "Validate ownership, balance accuracy, and reporting consistency; "
                    "consider dispute and/or resolution strategy based on facts and goals."
                ),
            }
        )
    summary = (
        f"{len(cols)} collection tradeline(s). "
        + (
            f"{sum(1 for f in findings if f['possibly_obsolete'])} may be past typical reporting windows when dates are reliable."
            if cols
            else "No collections identified in the extract."
        )
    )
    return FactorAnalysis(
        factor="collections",
        weight_hint=0.35,
        summary=summary,
        score_band="weak" if cols else "strong",
        findings=findings,
        weaknesses=([f"{len(cols)} collection(s) are high-priority profile risks."] if cols else []),
        strengths=(["No collections identified."] if not cols else []),
    )


def analyze_charge_offs(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    cos = [tl for tl in tradelines if classify_category(tl) == "charge_off"]
    findings = []
    for tl in cos:
        dofd = _dofd(tl)
        age_m = months_between(as_of, dofd) if dofd else None
        findings.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "balance": parse_money(tl.balance),
                "status": tl.status,
                "age_months": age_m,
                "possibly_obsolete": age_m is not None and age_m >= _OBSOLETE_COLLECTION_MONTHS,
                "checks": [
                    "Reporting accuracy of status and balance",
                    "Date consistency (opened / DOFD / last reported)",
                    "Update frequency and duplicate reporting risk",
                ],
            }
        )
    return FactorAnalysis(
        factor="charge_offs",
        weight_hint=0.35,
        summary=f"{len(cos)} charge-off account(s) identified.",
        score_band="weak" if cos else "strong",
        findings=findings,
        weaknesses=([f"{len(cos)} charge-off(s) remain on file."] if cos else []),
        strengths=(["No charge-offs identified."] if not cos else []),
    )


def analyze_inquiries(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    inqs = [
        tl
        for tl in tradelines
        if classify_category(tl) == "inquiry" or _INQUIRY_RE.search(_account_blob(tl))
    ]
    # Also catch inquiry-like rows that parsers may store sparsely
    findings = []
    recent = 0
    for tl in inqs:
        opened = parse_date(tl.date_opened) or parse_date(tl.last_reported)
        age_m = months_between(as_of, opened) if opened else None
        if age_m is not None and age_m <= 12:
            recent += 1
        findings.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "bureaus": tl.bureaus,
                "age_months": age_m,
                "potential_impact": "elevated" if age_m is not None and age_m <= 12 else "fading",
            }
        )
    summary = (
        f"{len(inqs)} hard-inquiry-like item(s); {recent} appear within ~12 months when dated."
    )
    recs = []
    if recent >= 3:
        recs.append(
            "Pause non-essential credit applications; inquiry clusters can pressure new-credit scoring and underwriting optics."
        )
    return FactorAnalysis(
        factor="hard_inquiries",
        weight_hint=0.10,
        summary=summary,
        score_band="weak" if recent >= 4 else "mixed" if recent >= 2 else "strong",
        findings=findings,
        recommendations=recs,
        weaknesses=(
            [f"{recent} recent inquiry signal(s) may affect new-credit evaluation."]
            if recent >= 2
            else []
        ),
        strengths=(["Inquiry activity appears limited."] if recent < 2 else []),
    )


def analyze_public_records(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    pubs = [
        tl
        for tl in tradelines
        if _PUBLIC_RE.search(_account_blob(tl)) or "bankruptcy" in " ".join(tl.legal_flags).lower()
    ]
    findings = []
    for tl in pubs:
        filed = parse_date(tl.date_opened) or _dofd(tl)
        age_m = months_between(as_of, filed) if filed else None
        is_bk = bool(re.search(r"bankrupt", _account_blob(tl), re.I))
        findings.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor or tl.account_type or "Public record",
                "type": "bankruptcy" if is_bk else "public_record",
                "age_months": age_m,
                "possibly_obsolete": (
                    age_m is not None
                    and (
                        age_m >= _BANKRUPTCY_MONTHS
                        if is_bk
                        else age_m >= _OBSOLETE_STANDARD_MONTHS
                    )
                ),
                "effect": (
                    "Bankruptcy records can remain reportable for an extended period and often "
                    "weigh heavily with lenders until aged and accompanied by rebuilt history."
                    if is_bk
                    else "Public-record negatives can materially affect funding and credit optics."
                ),
            }
        )
    return FactorAnalysis(
        factor="public_records",
        weight_hint=0.35,
        summary=f"{len(pubs)} public-record-like item(s) identified.",
        score_band="weak" if pubs else "strong",
        findings=findings,
        weaknesses=([f"{len(pubs)} public record signal(s) present."] if pubs else []),
        strengths=(["No public records identified in the extract."] if not pubs else []),
    )


def analyze_credit_mix(tradelines: list[Tradeline]) -> FactorAnalysis:
    buckets: dict[str, int] = {}
    for tl in tradelines:
        if classify_category(tl) == "inquiry":
            continue
        b = mix_bucket(tl)
        buckets[b] = buckets.get(b, 0) + 1
    variety = sum(1 for k, v in buckets.items() if v > 0 and k not in ("inquiry", "collection", "other"))
    summary = (
        f"Mix snapshot: {', '.join(f'{k}={v}' for k, v in sorted(buckets.items())) or 'none'}. "
        f"Distinct healthy mix categories ≈ {variety}."
    )
    strengths = []
    weaknesses = []
    if buckets.get("revolving") and (
        buckets.get("installment") or buckets.get("auto") or buckets.get("mortgage")
    ):
        strengths.append("Both revolving and installment-style accounts are present.")
    else:
        weaknesses.append("Limited credit-mix diversity — profile may look thin or one-dimensional to some lenders.")
    if buckets.get("collection"):
        weaknesses.append("Collection tradelines undermine mix quality.")
    return FactorAnalysis(
        factor="credit_mix",
        weight_hint=0.10,
        summary=summary,
        score_band="strong" if variety >= 2 and not buckets.get("collection") else "mixed",
        findings=[{"buckets": buckets, "variety_score": variety}],
        metrics={"buckets": buckets, "variety": variety},
        strengths=strengths,
        weaknesses=weaknesses,
    )


def analyze_account_age(tradelines: list[Tradeline], as_of: date) -> FactorAnalysis:
    ages = []
    for tl in tradelines:
        if classify_category(tl) == "inquiry":
            continue
        m = _age_months(tl, as_of)
        if m is not None:
            ages.append({"tradeline_id": tl.id, "creditor": tl.creditor, "age_months": m})
    if not ages:
        return FactorAnalysis(
            factor="account_age",
            weight_hint=0.15,
            summary="Account open dates were not reliably extracted; age analysis is limited.",
            score_band="unknown",
            findings=[],
            recommendations=["Confirm oldest/newest account dates on the source report for length-of-history review."],
        )
    months = [a["age_months"] for a in ages]
    avg = sum(months) / len(months)
    oldest = max(months)
    newest = min(months)
    band = "strong" if avg >= 72 else "mixed" if avg >= 36 else "weak"
    return FactorAnalysis(
        factor="account_age",
        weight_hint=0.15,
        summary=(
            f"Average age ≈ {avg / 12:.1f} years; oldest ≈ {oldest / 12:.1f} years; "
            f"newest ≈ {newest / 12:.1f} years (from {len(ages)} dated accounts)."
        ),
        score_band=band,
        findings=ages,
        metrics={
            "average_months": round(avg, 1),
            "oldest_months": oldest,
            "newest_months": newest,
            "dated_accounts": len(ages),
        },
        strengths=(["Length of history appears established."] if avg >= 72 else []),
        weaknesses=(["Shorter average account age may limit length-of-history contribution."] if avg < 36 else []),
        recommendations=(
            ["Avoid closing the oldest clean accounts solely for cleanup — age and available credit can suffer."]
            if oldest >= 60
            else []
        ),
    )


def build_overall_health(
    factors: dict[str, FactorAnalysis],
    tradelines: list[Tradeline],
    scores: dict[str, int | None],
) -> OverallCreditHealth:
    strengths: list[str] = []
    weaknesses: list[str] = []
    risks: list[str] = []
    for f in factors.values():
        strengths.extend(f.strengths)
        weaknesses.extend(f.weaknesses)

    neg = sum(1 for tl in tradelines if is_negative_tradeline(tl))
    if neg:
        risks.append(f"{neg} derogatory tradeline(s) remain on the file.")
    util = factors.get("revolving_utilization")
    if util and util.metrics.get("aggregate_utilization"):
        u = util.metrics["aggregate_utilization"]
        if u and u > _UTIL_HIGH:
            risks.append("High revolving utilization is a near-term score and underwriting risk.")

    available_scores = [s for s in scores.values() if isinstance(s, int)]
    if available_scores:
        avg_score = sum(available_scores) / len(available_scores)
        if avg_score < 580:
            band = "poor"
        elif avg_score < 670:
            band = "fair"
        elif avg_score < 740:
            band = "good"
        elif avg_score < 800:
            band = "very_good"
        else:
            band = "exceptional"
    else:
        band = "unscored"
        avg_score = None

    priorities = []
    if factors.get("collections") and factors["collections"].findings:
        priorities.append("Address collections (dispute accuracy/obsolescence or resolve where appropriate).")
    if util and util.metrics.get("aggregate_utilization") and util.metrics["aggregate_utilization"] > _UTIL_GOOD:
        priorities.append("Lower revolving utilization before pursuing additional credit.")
    if factors.get("hard_inquiries") and factors["hard_inquiries"].recommendations:
        priorities.append("Limit new hard inquiries while rebuilding.")
    if not priorities:
        priorities.append("Maintain on-time payments and monitor bureau updates.")

    narrative = (
        f"Overall profile band: {band.replace('_', ' ')}"
        + (f" (avg reported score ≈ {int(avg_score)})." if avg_score is not None else ".")
        + " Assessment uses educational factor framing; it is not a FICO Score calculation or approval prediction."
    )
    return OverallCreditHealth(
        band=band,
        narrative=narrative,
        strengths=list(dict.fromkeys(strengths))[:12],
        weaknesses=list(dict.fromkeys(weaknesses))[:12],
        risk_factors=list(dict.fromkeys(risks))[:10],
        improvement_priorities=priorities[:8],
        average_score=int(avg_score) if avg_score is not None else None,
    )


def assess_funding_readiness(
    factors: dict[str, FactorAnalysis],
    overall: OverallCreditHealth,
    funding: FundingContext | None,
    tradelines: list[Tradeline],
) -> FundingReadinessAssessment:
    blockers: list[str] = []
    supports: list[str] = []
    steps: list[str] = []
    score = 55  # neutral baseline 0-100 indicator

    util = (factors.get("revolving_utilization") or FactorAnalysis(factor="x")).metrics.get(
        "aggregate_utilization"
    )
    if util is not None:
        if util > _UTIL_CRITICAL:
            blockers.append("Very high revolving utilization may impede revolving/unsecured financing.")
            score -= 20
        elif util > _UTIL_GOOD:
            blockers.append("Elevated revolving utilization may reduce financing flexibility.")
            score -= 10
        else:
            supports.append("Revolving utilization appears within a commonly acceptable educational range.")
            score += 8

    cols = factors.get("collections")
    if cols and cols.findings:
        blockers.append("Open collections are a common underwriting red flag.")
        score -= 15
        steps.append("Clear or dispute inaccurate collections before packaging funding applications.")

    cos = factors.get("charge_offs")
    if cos and cos.findings:
        blockers.append("Charge-offs signal prior severe delinquency.")
        score -= 12

    inq = factors.get("hard_inquiries")
    recent_inq = 0
    if inq:
        recent_inq = sum(
            1
            for f in inq.findings
            if isinstance(f.get("age_months"), int) and f["age_months"] <= 12
        )
        if recent_inq >= 4:
            blockers.append("Recent inquiry clustering may look like elevated credit-seeking.")
            score -= 8
            steps.append("Wait before applying for additional credit unless strategically necessary.")

    thin = len([tl for tl in tradelines if classify_category(tl) != "inquiry"]) < 3
    if thin:
        blockers.append("Thin credit file — few tradelines for lenders to evaluate.")
        score -= 10
        steps.append("Where appropriate, preserve positive tradelines and consider responsible credit-building options.")

    pay = factors.get("payment_history")
    if pay and pay.score_band == "strong":
        supports.append("Payment history shows limited derogatory signals in the extract.")
        score += 10
    elif pay and pay.score_band == "weak":
        blockers.append("Recent or material payment issues may delay financing readiness.")
        score -= 12

    if overall.band in ("good", "very_good", "exceptional"):
        supports.append(f"Reported score band ({overall.band.replace('_', ' ')}) is relatively supportive.")
        score += 10
    elif overall.band in ("poor", "fair"):
        blockers.append(f"Reported score band ({overall.band}) may limit program options or pricing.")
        score -= 8

    if funding:
        if funding.self_reported_bankruptcy:
            blockers.append("Self-reported bankruptcy history — verify public-record aging and rebuild progress.")
            score -= 10
        if funding.business_year_established:
            try:
                year = int(re.sub(r"\D", "", funding.business_year_established)[:4])
                age_years = _today().year - year
                if age_years < 1:
                    blockers.append("Very new business history may constrain business-financing options.")
                    score -= 8
                elif age_years >= 2:
                    supports.append(f"Business age (~{age_years} years) can support some funding programs.")
                    score += 5
            except ValueError:
                pass
        if funding.annual_revenue:
            rev = parse_money(funding.annual_revenue)
            if rev is not None and rev < 50000:
                blockers.append("Self-reported revenue appears modest for many business-funding products.")
                score -= 5
            elif rev is not None and rev >= 150000:
                supports.append("Self-reported revenue level may support a broader program set.")
                score += 5
        if funding.monthly_income and funding.funding_amount:
            income = parse_money(funding.monthly_income)
            ask = parse_money(funding.funding_amount)
            if income and ask and income > 0:
                # crude affordability optic — not DTI
                if ask > income * 24:
                    blockers.append("Requested funding is large relative to stated monthly income.")
                    score -= 6
        for goal in funding.credit_goals or []:
            if "funding" in goal.lower() or "business" in goal.lower():
                steps.append(f"Align credit cleanup sequencing with stated goal: {goal}.")

    score = max(5, min(95, score))
    if score >= 75:
        level = "strong"
    elif score >= 55:
        level = "moderate"
    elif score >= 35:
        level = "developing"
    else:
        level = "limited"

    if not steps:
        steps.append("Continue on-time payments and re-check reports after any bureau updates.")
    steps.append(
        "These readiness notes are educational indicators only — they do not predict lender decisions or guarantee approvals."
    )

    return FundingReadinessAssessment(
        level=level,
        score_0_to_100=score,
        summary=(
            f"Funding readiness indicator: {level} ({score}/100). "
            "Combines report factors with intake context when available."
        ),
        blockers=list(dict.fromkeys(blockers))[:10],
        supportive_signals=list(dict.fromkeys(supports))[:10],
        practical_steps=list(dict.fromkeys(steps))[:12],
    )


def build_recommendations(
    factors: dict[str, FactorAnalysis],
    overall: OverallCreditHealth,
    funding: FundingReadinessAssessment,
    tradelines: list[Tradeline],
    extraction_quality: str,
) -> list[Recommendation]:
    recs: list[Recommendation] = []

    def add(
        title: str,
        rationale: str,
        *,
        category: str,
        impact: float,
        confidence: float,
        actions: list[str] | None = None,
        tradeline_ids: list[str] | None = None,
        legal_basis: str = "",
    ) -> None:
        recs.append(
            Recommendation(
                id=f"rec_{len(recs) + 1}",
                title=title,
                category=category,
                rationale=rationale,
                estimated_impact=round(impact, 2),
                confidence=round(confidence, 2),
                priority_score=round(impact * confidence, 3),
                suggested_actions=actions or [],
                related_tradeline_ids=tradeline_ids or [],
                legal_basis=legal_basis,
            )
        )

    util_factor = factors.get("revolving_utilization")
    if util_factor:
        u = util_factor.metrics.get("aggregate_utilization")
        conf = float(util_factor.metrics.get("confidence") or 0.5)
        if u is not None and u > _UTIL_GOOD:
            high_ids = [
                f["tradeline_id"]
                for f in util_factor.findings
                if f.get("utilization") and f["utilization"] > _UTIL_GOOD
            ]
            add(
                "Reduce revolving utilization",
                f"Aggregate revolving utilization is ≈{int(u * 100)}%. Amounts-owed factors are a major educational score driver; lower utilization often improves both score optics and funding readiness.",
                category="utilization",
                impact=0.9 if u > _UTIL_HIGH else 0.75,
                confidence=conf,
                actions=util_factor.recommendations[:5],
                tradeline_ids=high_ids[:8],
            )
            add(
                "Consider credit-limit increase on clean revolving accounts",
                "Raising limits on well-managed cards can lower utilization without a new hard pull in some issuer workflows — verify issuer policy first.",
                category="utilization",
                impact=0.55,
                confidence=0.5,
                actions=["Identify clean open revolving accounts", "Request CLI where issuer allows"],
            )

    cols = factors.get("collections")
    if cols and cols.findings:
        obsolete_ids = [f["tradeline_id"] for f in cols.findings if f.get("possibly_obsolete")]
        other_ids = [f["tradeline_id"] for f in cols.findings if not f.get("possibly_obsolete")]
        if obsolete_ids:
            add(
                "Review potentially outdated collection reporting",
                "One or more collections may exceed typical FCRA reporting windows when DOFD/dates are reliable. Obsolete items should not remain on consumer reports.",
                category="dispute",
                impact=0.95,
                confidence=_confidence(False, True, extraction_quality),
                actions=["Verify DOFD on source report", "Dispute obsolete/inaccurate reporting with CRA and furnisher"],
                tradeline_ids=obsolete_ids,
                legal_basis="FCRA §605 (15 U.S.C. §1681c); FCRA §611 (15 U.S.C. §1681i)",
            )
        if other_ids:
            add(
                "Validate and dispute inaccurate collection entries",
                "Collections often warrant verification of ownership, balance, and status. Dispute incomplete or unverifiable data; consider resolution strategy when accurate.",
                category="dispute",
                impact=0.88,
                confidence=0.7,
                actions=["Gather supporting documents", "Generate bureau and furnisher dispute letters"],
                tradeline_ids=other_ids,
                legal_basis="FCRA §611 (15 U.S.C. §1681i); FCRA §623 (15 U.S.C. §1681s-2)",
            )

    cos = factors.get("charge_offs")
    if cos and cos.findings:
        add(
            "Audit charge-off reporting accuracy",
            "Charge-offs are severe negatives. Review date consistency, balances, and whether reporting remains within permissible periods.",
            category="dispute",
            impact=0.85,
            confidence=0.65,
            actions=["Compare bureau-to-bureau fields", "Dispute inconsistencies"],
            tradeline_ids=[f["tradeline_id"] for f in cos.findings],
            legal_basis="FCRA §611 (15 U.S.C. §1681i)",
        )

    inq = factors.get("hard_inquiries")
    if inq and any("Pause" in r or "inquiry" in r.lower() for r in inq.recommendations):
        add(
            "Wait before applying for additional credit",
            "Recent inquiry activity can pressure the new-credit factor and some underwriting models. Sequence funding apps after stabilizing the file when possible.",
            category="new_credit",
            impact=0.6,
            confidence=0.7,
            actions=inq.recommendations,
        )

    age = factors.get("account_age")
    if age and age.recommendations:
        add(
            "Protect account age and available credit",
            "Length of history and utilization both suffer when older clean accounts are closed carelessly.",
            category="account_age",
            impact=0.5,
            confidence=0.65,
            actions=age.recommendations,
        )

    mix = factors.get("credit_mix")
    if mix and mix.weaknesses:
        add(
            "Improve credit mix where appropriate",
            "Profiles dominated by a single account type may look less resilient. Only add accounts when affordable and aligned with goals.",
            category="credit_mix",
            impact=0.45,
            confidence=0.55,
            actions=["Avoid unnecessary new accounts", "Preserve healthy installment and revolving tradelines"],
        )

    add(
        "Continue on-time payments",
        "Payment history is the largest educational score factor. Staying current prevents new derogatories while other strategies work.",
        category="payment_history",
        impact=0.8,
        confidence=0.9,
        actions=["Autopay minimums", "Calendar due dates", "Get current on any past-due balances"],
    )

    if funding.level in ("limited", "developing"):
        add(
            "Sequence repair work ahead of aggressive funding outreach",
            "Current readiness indicators suggest addressing utilization and derogatories before broad lender submissions.",
            category="funding",
            impact=0.7,
            confidence=0.75,
            actions=funding.practical_steps[:4],
        )
    elif funding.level == "strong":
        add(
            "Package funding review with clean supporting docs",
            "Readiness indicators are relatively supportive. Confirm documentation, revenue story, and inquiry timing before applications.",
            category="funding",
            impact=0.55,
            confidence=0.7,
            actions=["Finalize business docs", "Avoid unnecessary hard pulls", "Align ask amount with capacity"],
        )

    # Closed derogatory cleanup
    closed_neg = [
        tl.id
        for tl in tradelines
        if classify_category(tl) in ("closed_derogatory", "collection", "charge_off")
        or "obsolete_negative" in (tl.legal_flags or [])
    ]
    if closed_neg:
        add(
            "Review potentially inaccurate or unverifiable negative reporting",
            "Closed or obsolete negatives often do not support a clean profile. Challenge inaccurate, incomplete, or unverifiable fields with supporting documentation.",
            category="dispute",
            impact=0.82,
            confidence=0.68,
            actions=["Select accounts in dispute workflow", "Attach proof documents", "Send CRA + furnisher letters"],
            tradeline_ids=closed_neg[:15],
            legal_basis="FCRA §611 (15 U.S.C. §1681i); FCRA §623 (15 U.S.C. §1681s-2)",
        )

    recs.sort(key=lambda r: (-r.priority_score, -r.estimated_impact))
    # re-number after sort
    for i, r in enumerate(recs, start=1):
        r.id = f"rec_{i}"
    return recs


def build_account_dispute_insights(tradelines: list[Tradeline], as_of: date) -> list[dict[str, Any]]:
    insights = []
    for tl in tradelines:
        enrich_tradeline(tl)
        cat = classify_category(tl)
        if cat in ("positive", "closed") and not is_negative_tradeline(tl):
            continue
        dofd = _dofd(tl)
        age_m = months_between(as_of, dofd) if dofd else None
        obsolete = False
        if cat in ("collection", "charge_off") and age_m is not None:
            obsolete = age_m >= _OBSOLETE_COLLECTION_MONTHS
        elif is_negative_tradeline(tl) and age_m is not None:
            obsolete = age_m >= _OBSOLETE_STANDARD_MONTHS

        reasons = []
        if obsolete:
            reasons.append("Possibly outside typical FCRA reporting period — verify dates on source report.")
        if "balance_mismatch" in (tl.legal_flags or []):
            reasons.append("Bureau field mismatch flagged during extraction.")
        if cat in ("collection", "charge_off"):
            reasons.append("Severe derogatory — validate accuracy and completeness.")
        if not reasons and is_negative_tradeline(tl):
            reasons.append("Derogatory reporting may warrant accuracy review.")

        insights.append(
            {
                "tradeline_id": tl.id,
                "creditor": tl.creditor,
                "category": cat,
                "repair_priority": tl.repair_priority,
                "dispute_recommended": tl.repair_priority in ("high", "medium") or obsolete,
                "rationale": " ".join(reasons) or tl.analysis_notes or "Review for accuracy.",
                "suggested_dispute_reason": tl.suggested_dispute_reason or tl.dispute_reason,
                "supporting_facts": {
                    "status": tl.status,
                    "balance": tl.balance,
                    "credit_limit": tl.credit_limit,
                    "date_opened": tl.date_opened,
                    "date_of_first_delinquency": tl.date_of_first_delinquency,
                    "last_reported": tl.last_reported,
                    "bureaus": tl.bureaus,
                    "legal_flags": tl.legal_flags,
                },
                "legal_citations": (
                    ["FCRA §605 (15 U.S.C. §1681c)", "FCRA §611 (15 U.S.C. §1681i)"]
                    if obsolete
                    else ["FCRA §611 (15 U.S.C. §1681i)", "FCRA §623 (15 U.S.C. §1681s-2)"]
                    if tl.repair_priority in ("high", "medium")
                    else []
                ),
            }
        )
    return insights


def build_credit_intelligence(
    report: ParsedReport,
    funding: FundingContext | None = None,
) -> CreditIntelligenceReport:
    as_of = parse_date(report.report_date) or _today()
    tradelines = [enrich_tradeline(tl) for tl in report.tradelines]
    report.tradelines = tradelines
    quality = report.extraction_quality or "medium"

    factors_list = [
        analyze_payment_history(tradelines, as_of),
        analyze_revolving(tradelines, quality),
        analyze_installment(tradelines),
        analyze_collections(tradelines, as_of),
        analyze_charge_offs(tradelines, as_of),
        analyze_inquiries(tradelines, as_of),
        analyze_public_records(tradelines, as_of),
        analyze_credit_mix(tradelines),
        analyze_account_age(tradelines, as_of),
    ]
    factors = {f.factor: f for f in factors_list}

    scores = {
        "tuc": report.credit_health.scores.tuc,
        "exp": report.credit_health.scores.exp,
        "eqf": report.credit_health.scores.eqf,
    }
    overall = build_overall_health(factors, tradelines, scores)
    funding_ready = assess_funding_readiness(factors, overall, funding, tradelines)
    recommendations = build_recommendations(
        factors, overall, funding_ready, tradelines, quality
    )
    account_insights = build_account_dispute_insights(tradelines, as_of)

    next_steps = (
        overall.improvement_priorities[:3]
        + funding_ready.practical_steps[:2]
        + [r.title for r in recommendations[:3]]
    )
    # dedupe preserve order
    seen: set[str] = set()
    ordered_steps: list[str] = []
    for s in next_steps:
        if s not in seen:
            seen.add(s)
            ordered_steps.append(s)

    return CreditIntelligenceReport(
        version="1.0",
        analyzed_at=datetime_isoformat(),
        report_date=report.report_date,
        consumer_name=report.consumer.name,
        factors=factors_list,
        overall=overall,
        funding_readiness=funding_ready,
        recommendations=recommendations,
        account_dispute_insights=account_insights,
        recommended_next_steps=ordered_steps[:10],
        disclaimer=(
            "Educational analysis only. Not a FICO Score, credit counseling substitute, "
            "or legal advice. Does not guarantee score changes, deletions, or financing approval."
        ),
    )


def datetime_isoformat() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def funding_context_from_dict(data: dict[str, Any] | None) -> FundingContext | None:
    if not data:
        return None
    return FundingContext(
        credit_goals=list(data.get("credit_goals") or []),
        funding_goals=str(data.get("funding_goals") or ""),
        funding_amount=str(data.get("funding_amount") or ""),
        funding_timeframe=str(data.get("funding_timeframe") or ""),
        monthly_income=str(data.get("monthly_income") or ""),
        annual_income=str(data.get("annual_income") or ""),
        annual_revenue=str(data.get("annual_revenue") or ""),
        business_year_established=str(data.get("business_year_established") or ""),
        self_reported_score=str(data.get("self_reported_score") or ""),
        self_reported_collections=bool(data.get("self_reported_collections")),
        self_reported_charge_offs=bool(data.get("self_reported_charge_offs")),
        self_reported_bankruptcy=bool(data.get("self_reported_bankruptcy")),
        self_reported_late_payments=bool(data.get("self_reported_late_payments")),
        self_reported_inquiries=str(data.get("self_reported_inquiries") or ""),
        document_types=list(data.get("document_types") or []),
    )
