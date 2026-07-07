from __future__ import annotations

import re
import uuid
from difflib import SequenceMatcher

from bs4 import BeautifulSoup

from app.models import BureauCode, ConsumerInfo, ParsedReport, Subscriber, Tradeline


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _cell_text(td) -> str:
    if td is None:
        return ""
    return _clean(td.get_text(" ", strip=True))


def _normalize_creditor(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", name.upper())


def _match_subscriber(creditor: str, subscribers: list[Subscriber]) -> Subscriber | None:
    cred_norm = _normalize_creditor(creditor)
    best: Subscriber | None = None
    best_score = 0.0
    for sub in subscribers:
        score = SequenceMatcher(None, cred_norm, _normalize_creditor(sub.name)).ratio()
        if score > best_score:
            best_score = score
            best = sub
    return best if best_score >= 0.55 else None


def can_parse(html: str) -> bool:
    lower = html.lower()
    return "identityiq" in lower or "credit report - identityiq" in lower


def parse(html: str, file_type: str = "html", ocr_used: bool = False, quality: str = "high") -> ParsedReport:
    soup = BeautifulSoup(html, "lxml")
    reference = ""
    report_date = ""
    for block in soup.select(".re-data > div"):
        h3 = block.select_one("h3")
        if not h3:
            continue
        label = _clean(h3.get_text())
        p = block.select_one("p")
        val = _clean(p.get_text()) if p else ""
        if "Reference" in label:
            reference = val
        elif "Report Date" in label:
            report_date = val

    consumer = _parse_consumer(soup)
    subscribers = _parse_subscribers(soup)
    tradelines = _parse_tradelines(soup)

    return ParsedReport(
        source="identityiq",
        reference=reference,
        report_date=report_date,
        consumer=consumer,
        tradelines=tradelines,
        subscribers=subscribers,
        file_type=file_type,
        ocr_used=ocr_used,
        extraction_quality=quality,
    )


def _parse_consumer(soup: BeautifulSoup) -> ConsumerInfo:
    consumer = ConsumerInfo()
    wrapper = None
    for div in soup.select(".rpt_content_wrapper"):
        header = div.select_one(".rpt_fullReport_header")
        if header and "Personal Information" in header.get_text():
            wrapper = div
            break
    if not wrapper:
        return consumer

    rows = wrapper.select("table tr")
    for row in rows:
        label = row.select_one(".label")
        if not label:
            continue
        label_text = _clean(label.get_text())
        cells = row.select(".info")
        if label_text == "Name:" and cells:
            consumer.name = _cell_text(cells[0])
        elif label_text == "Date of Birth:" and cells:
            consumer.dob = _cell_text(cells[0])
        elif label_text == "Social Security Number:" and cells:
            ssn = _cell_text(cells[0])
            consumer.ssn_last4 = ssn[-4:] if len(ssn) >= 4 else ssn
        elif label_text.startswith("Current Address") and cells:
            addr = _cell_text(cells[0])
            if addr and addr != "-":
                consumer.addresses.append(addr)
    return consumer


def _parse_subscribers(soup: BeautifulSoup) -> list[Subscriber]:
    subscribers: list[Subscriber] = []
    for row in soup.select("tr[ng-repeat*='subsr in subscribers']"):
        cells = row.select("td.info")
        if len(cells) < 2:
            continue
        name = _cell_text(cells[0])
        if not name:
            continue
        addr_html = cells[1].decode_contents() if hasattr(cells[1], "decode_contents") else str(cells[1])
        addr_text = re.sub(r"<[^>]+>", "\n", addr_html)
        lines = [_clean(l) for l in addr_text.split("\n") if _clean(l)]
        phone = _cell_text(cells[2]) if len(cells) > 2 else ""
        subscribers.append(Subscriber(name=name, address_lines=lines, phone=phone))
    return subscribers


def _parse_tradelines(soup: BeautifulSoup) -> list[Tradeline]:
    tradelines: list[Tradeline] = []
    for header in soup.select("div.sub_header.ng-binding, div.sub_header.ng-scope"):
        creditor = _clean(header.get_text())
        if not creditor or creditor in ("Credit Score",):
            continue
        table = header.find_next("table", class_=lambda c: c and "rpt_table4column" in c)
        if not table:
            continue
        data = _parse_tradeline_table(table, creditor)
        if data:
            tradelines.append(data)
    return tradelines


def _parse_tradeline_table(table, creditor: str) -> Tradeline | None:
    bureau_cols: dict[str, int] = {}
    header_row = table.select_one("tr")
    if header_row:
        for i, th in enumerate(header_row.find_all("th")):
            cls = " ".join(th.get("class", []))
            if "headerTUC" in cls:
                bureau_cols["TUC"] = i
            elif "headerEXP" in cls:
                bureau_cols["EXP"] = i
            elif "headerEQF" in cls:
                bureau_cols["EQF"] = i

    fields: dict[str, dict[str, str]] = {"TUC": {}, "EXP": {}, "EQF": {}}
    for row in table.select("tr"):
        label_el = row.select_one(".label")
        if not label_el:
            continue
        label = _clean(label_el.get_text()).rstrip(":")
        cells = row.select(".info")
        for bureau, idx in bureau_cols.items():
            if idx < len(cells):
                fields[bureau][label] = _cell_text(cells[idx])

    account_tu = fields["TUC"].get("Account #", "")
    account_exp = fields["EXP"].get("Account #", "")
    account_eqf = fields["EQF"].get("Account #", "")
    if account_tu == "-" and account_exp == "-" and account_eqf == "-":
        return None

    bureaus: list[BureauCode] = []
    if account_tu and account_tu != "-":
        bureaus.append("TUC")
    if account_exp and account_exp != "-":
        bureaus.append("EXP")
    if account_eqf and account_eqf != "-":
        bureaus.append("EQF")

    status = fields["TUC"].get("Account Status") or fields["EXP"].get("Account Status") or fields["EQF"].get("Account Status", "")
    balance = fields["TUC"].get("Balance") or fields["EXP"].get("Balance") or fields["EQF"].get("Balance", "")
    past_due = fields["TUC"].get("Past Due") or fields["EXP"].get("Past Due") or fields["EQF"].get("Past Due", "")
    remarks = fields["TUC"].get("Comments") or fields["EXP"].get("Comments") or fields["EQF"].get("Comments", "")
    account_type = fields["TUC"].get("Account Type - Detail") or fields["EXP"].get("Account Type - Detail") or fields["EQF"].get("Account Type - Detail", "")
    is_collection = "collection" in account_type.lower()

    return Tradeline(
        id=str(uuid.uuid4()),
        creditor=creditor,
        account_tu=account_tu if account_tu != "-" else "",
        account_exp=account_exp if account_exp != "-" else "",
        account_eqf=account_eqf if account_eqf != "-" else "",
        account_type=account_type,
        status=status if status != "-" else "",
        balance=balance if balance != "-" else "",
        past_due=past_due if past_due != "-" else "",
        remarks=remarks if remarks != "-" else "",
        bureaus=bureaus,
        is_collection=is_collection,
    )


def lookup_subscriber(creditor: str, subscribers: list[Subscriber]) -> Subscriber | None:
    return _match_subscriber(creditor, subscribers)
