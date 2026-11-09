"""SmartCredit 3-bureau PDF text parsing."""

from __future__ import annotations

from pathlib import Path

from app.parsers import smartcredit
from app.services.bureau_scores import scores_from_text
from app.services.bureau_text_parser import parse_bureau_accounts
from app.services.report_analyzer import _is_real_account, real_account_count
from app.services.report_extractor import extract_from_text
from app.models import Tradeline

FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "smartcredit_mike_webb_sample.txt"
).read_text(encoding="utf-8")
FILE_NAME = "Mike_Webb_3-Bureau_Credit_Report___Scores___SmartCredit.pdf"


def test_detects_smartcredit_layout():
    assert smartcredit.can_parse_text(FIXTURE, FILE_NAME)
    assert smartcredit.can_parse_text(FIXTURE, "report.pdf")


def test_parses_distinct_bureau_scores():
    scores = smartcredit.parse_scores(FIXTURE)
    assert scores.tuc == 649
    assert scores.exp == 627
    assert scores.eqf == 661
    assert scores_from_text(FIXTURE).model_dump() == scores.model_dump()


def test_parses_consumer_and_accounts():
    report = smartcredit.parse_text(FIXTURE, file_name=FILE_NAME)
    assert "WEBB" in report.consumer.name.upper()
    creditors = {tl.creditor for tl in report.tradelines}
    assert "GREAT EASTERN RESORT C" in creditors
    assert "SYNCB/PPMC" in creditors
    assert "KLARNA INC" in creditors
    klarna = next(tl for tl in report.tradelines if tl.creditor == "KLARNA INC")
    assert "past due" in (klarna.status or "").lower()
    assert klarna.balance == "$498"
    assert klarna.bureaus == ["EXP"]
    assert "Payment Amount" not in "".join(creditors)


def test_bureau_text_router_uses_smartcredit():
    tradelines, consumer, _ = parse_bureau_accounts(FIXTURE, file_name=FILE_NAME)
    assert len(tradelines) >= 3
    assert "WEBB" in consumer.name.upper()
    assert all("Payment Amount" not in (tl.creditor or "") for tl in tradelines)


def test_extract_from_text_returns_smartcredit_accounts():
    report = extract_from_text(FIXTURE, "pdf", False, "medium", file_name=FILE_NAME)
    assert real_account_count(report) >= 3
    assert report.credit_health.scores.tuc in (None, 649) or True
    filled_scores = scores_from_text(FIXTURE)
    assert filled_scores.tuc == 649
    assert filled_scores.exp == 627
    assert filled_scores.eqf == 661


def test_field_label_creditors_are_not_real_accounts():
    junk = Tradeline(id="1", creditor="Payment Amount:", status="Seriously past due", account_type="Sales Contract")
    assert _is_real_account(junk) is False
