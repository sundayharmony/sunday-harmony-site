from __future__ import annotations

from app.models import BureauScores, ConsumerInfo, CreditHealthSummary, ParsedReport, Tradeline
from app.parsers.identityiq import parse, parse_scores
from app.services.bureau_scores import fill_missing_scores, parse_score_value, scores_from_text
from app.services.credit_health import build_health_summary
from app.services.report_refresh import refresh_report_health


IDENTITYIQ_SCORE_HTML = """
<html><body>
  <div>IdentityIQ Credit Report</div>
  <div class="sub_header">Credit Score</div>
  <table class="rpt_content_table rpt_table4column">
    <tr>
      <th class="label"></th>
      <th class="headerTUC">TransUnion</th>
      <th class="headerEXP">Experian</th>
      <th class="headerEQF">Equifax</th>
    </tr>
    <tr>
      <td class="label">Credit Score:</td>
      <td class="info">721</td>
      <td class="info">698</td>
      <td class="info">705</td>
    </tr>
    <tr>
      <td class="label">Score Range:</td>
      <td class="info">300-850</td>
      <td class="info">300-850</td>
      <td class="info">300-850</td>
    </tr>
  </table>
  <div class="sub_header ng-binding">CITIZENS BANK</div>
  <table class="rpt_content_table rpt_table4column">
    <tr>
      <th class="label"></th>
      <th class="headerTUC">TransUnion</th>
      <th class="headerEXP">Experian</th>
      <th class="headerEQF">Equifax</th>
    </tr>
    <tr>
      <td class="label">Account #:</td>
      <td class="info">****4038</td>
      <td class="info">****4038</td>
      <td class="info">****4038</td>
    </tr>
    <tr>
      <td class="label">Account Status:</td>
      <td class="info">Closed</td>
      <td class="info">Closed</td>
      <td class="info">Closed</td>
    </tr>
  </table>
</body></html>
"""


def test_parse_score_value_accepts_common_formats():
    assert parse_score_value(721) == 721
    assert parse_score_value("698") == 698
    assert parse_score_value("705.0") == 705
    assert parse_score_value("N/A") is None
    assert parse_score_value("90") is None
    assert parse_score_value("Credit Score: 640") == 640


def test_identityiq_parse_scores_from_credit_score_table():
    scores = parse_scores(IDENTITYIQ_SCORE_HTML)
    assert scores.tuc == 721
    assert scores.exp == 698
    assert scores.eqf == 705


def test_identityiq_parse_does_not_treat_credit_score_as_tradeline():
    report = parse(IDENTITYIQ_SCORE_HTML)
    assert [tl.creditor for tl in report.tradelines] == ["CITIZENS BANK"]
    assert report.credit_health.scores.tuc == 721
    assert report.credit_health.scores.eqf == 705


def test_scores_from_text_labeled_bureaus():
    text = (
        "TransUnion credit score 640\n"
        "Experian credit score 655\n"
        "Equifax credit score 661\n"
        "CITIZENS BANK account 4038"
    )
    scores = scores_from_text(text)
    assert scores.tuc == 640
    assert scores.exp == 655
    assert scores.eqf == 661


def test_refresh_preserves_existing_bureau_scores():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(negative_count=99, total_accounts=1),
        tradelines=[
            Tradeline(id="open", creditor="Bank", status="Open", remarks="never late", bureaus=["EXP"], account_exp="1111"),
            Tradeline(id="coll", creditor="Coll", is_collection=True, status="Collection", bureaus=["EXP"], account_exp="2222"),
        ],
    )
    report.credit_health.scores.exp = 640
    refresh_report_health(report, "experian.pdf")
    assert report.credit_health.negative_count == 1
    assert report.credit_health.scores.exp == 640


def test_build_health_summary_keeps_scores_when_agent_omits_them():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(scores=BureauScores(tuc=701, exp=None, eqf=690)),
        tradelines=[],
    )
    summary = build_health_summary(report, {"scores": {"tuc": None, "exp": None, "eqf": None}})
    assert summary.scores.tuc == 701
    assert summary.scores.eqf == 690


def test_fill_missing_scores_from_identityiq_html():
    report = ParsedReport(consumer=ConsumerInfo(name="A"))
    fill_missing_scores(report, html=IDENTITYIQ_SCORE_HTML, text="")
    assert report.credit_health.scores.tuc == 721
    assert report.credit_health.scores.exp == 698


def test_single_bureau_pdf_filename_assigns_lone_score():
    report = ParsedReport(consumer=ConsumerInfo(name="A"))
    text = "Experian credit report\nYour FICO Score: 655\nCapital One account"
    fill_missing_scores(report, text=text, file_name="michael-experian-sep.pdf")
    assert report.credit_health.scores.exp == 655
    assert report.credit_health.scores.tuc is None


def test_fico_score_8_model_number_before_value():
    report = ParsedReport(consumer=ConsumerInfo(name="A"))
    text = (
        "Experian credit report\n"
        "FICO® Score 8\n"
        "655\n"
        "Score Range: 300-850\n"
        "CITIZENS BANK account"
    )
    fill_missing_scores(report, text=text, file_name="Mike Webb Experian 9-12-2026.pdf")
    assert report.credit_health.scores.exp == 655
    assert report.credit_health.scores.tuc is None


def test_vantage_score_model_number_before_value():
    report = ParsedReport(consumer=ConsumerInfo(name="A"))
    text = "TransUnion report\nVantageScore 3.0\n661\nCapital One"
    fill_missing_scores(report, text=text, file_name="mike-transunion.pdf")
    assert report.credit_health.scores.tuc == 661


def test_scores_from_text_does_not_pick_score_range():
    text = "Experian credit score\nScore Range: 300-850\nFICO Score 8\n655"
    scores = scores_from_text(text)
    assert scores.exp == 655
