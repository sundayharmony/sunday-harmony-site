"""Credit Hero "All bureaus" PDFs read by word position.

Text extraction flattens the TransUnion, Equifax and Experian columns into one stream, so
the parser cannot tell which bureau holds an account or an inquiry. Here each column is read
on its own, and cards that line up across columns become one tradeline with per-bureau data.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from functools import lru_cache

from app.models import Tradeline

# Column order printed by Credit Hero.
BUREAUS = ("TUC", "EQF", "EXP")


@dataclass
class Line:
    page: int
    top: float
    text: str
    x0: float
    solo: bool = False  # gutter label with nothing beside it in the columns


@dataclass
class Layout:
    """Everything read from the page geometry."""

    origins: list[float] = field(default_factory=list)
    gutter: list[Line] = field(default_factory=list)  # row labels left of column 1
    columns: list[list[Line]] = field(default_factory=lambda: [[], [], []])


_CHROME = re.compile(
    r"(?i)^(?:\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}.*|https?://\S+.*|\d{1,3}\s*/\s*\d{1,3}|"
    r"credit hero score\s*\|.*)$"
)


def read_layout(path: str) -> Layout | None:
    import pdfplumber

    pages_words = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages_words.append(page.extract_words(x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False))
    origins = _column_origins(pages_words)
    if not origins:
        return None
    layout = Layout(origins=origins)
    edges = [o - 8 for o in origins] + [10_000.0]
    for pno, words in enumerate(pages_words):
        rows: dict[int, list] = {}
        for w in words:
            rows.setdefault(round(w["top"] / 2), []).append(w)
        for key in sorted(rows):
            ws = sorted(rows[key], key=lambda w: w["x0"])
            # Split the row into the gutter and the three columns.
            cells: list[list] = [[], [], [], []]
            for w in ws:
                if w["x0"] < edges[0]:
                    cells[0].append(w)
                else:
                    ci = max(i for i in range(3) if w["x0"] >= edges[i])
                    cells[ci + 1].append(w)
            if _CHROME.match(" ".join(w["text"] for w in ws)):
                continue
            for ci, cell in enumerate(cells):
                if not cell:
                    continue
                # This font prints the "ff" in "Charge Off" as "!".
                text = " ".join({"O!": "Off", "o!": "off"}.get(w["text"], w["text"]) for w in cell)
                ln = Line(pno, cell[0]["top"], text, cell[0]["x0"])
                if ci == 0:
                    layout.gutter.append(ln)
                else:
                    layout.columns[ci - 1].append(ln)
    tops = {(c_line.page, round(c_line.top)) for col in layout.columns for c_line in col}
    for g in layout.gutter:
        g.solo = not any((g.page, round(g.top) + d) in tops for d in range(-5, 6))
    return layout


def _column_origins(pages_words: list[list[dict]]) -> list[float]:
    """x of the three column starts, from the first "Total accounts/count" row."""
    for words in pages_words:
        for w in words:
            if w["text"] == "Total":
                row = sorted(
                    (x for x in words if abs(x["top"] - w["top"]) < 3 and x["x0"] > 100),
                    key=lambda x: x["x0"],
                )
                if len(row) >= 3 and all(re.fullmatch(r"\d+", x["text"]) for x in row[:3]):
                    return [x["x0"] for x in row[:3]]
    return []


# --- sections -------------------------------------------------------------------------------

_SECTION_NAMES = {
    "credit cards": "accounts",
    "real estate": "accounts",
    "real estate loans": "accounts",
    "auto loans": "accounts",
    "student loans": "accounts",
    "other": "accounts",
    "personal loans": "accounts",
    "installment loans": "accounts",
    "hard inquiries": "inquiries",
    "collections": "collections",
    "public records": "public",
    "creditors": "creditors",
}
_MONEY = re.compile(r"\$[\d,]+(?:\.\d{2})?")
_DATE = re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, ?\d{4}\b")


def _section_marks(layout: Layout) -> list[tuple[int, float, str, str]]:
    marks = []
    for g in layout.gutter:
        name = g.text.strip().lower()
        if name in _SECTION_NAMES and g.solo:
            marks.append((g.page, g.top, name, _SECTION_NAMES[name]))
    marks.sort()
    # The summary table also has a "Collections" row; real sections start after the first account heading.
    first = next((i for i, m in enumerate(marks) if m[3] == "accounts"), None)
    return marks[first:] if first is not None else []


def _section_at(marks, page: int, top: float) -> tuple[str, str]:
    current = ("", "")
    for mpage, mtop, name, kind in marks:
        if (mpage, mtop) <= (page, top):
            current = (name, kind)
    return current


# --- account cards --------------------------------------------------------------------------

_HASH = re.compile(r"^[0-9a-f]{20,}$")
_DATE_ONLY = re.compile(rf"^{_DATE.pattern}$")
_MONEY_ONLY = re.compile(r"^\$[\d,]+(?:\.\d{2})?$")
_LABEL_ONLY = {"Total count", "Hide Details", "Show Details", "Bureau"}


@dataclass
class Card:
    column: int
    page: int
    top: float  # of the amount line that opens the card
    lines: list[Line]
    section: str = ""

    @property
    def text(self) -> str:
        return "\n".join(ln.text for ln in self.lines)


def _partition(layout: Layout, marks) -> list[list[tuple[str, Line]]]:
    """Each column's lines tagged with their section kind."""
    out = []
    for col in layout.columns:
        out.append([(_section_at(marks, ln.page, ln.top)[1], ln) for ln in col])
    return out


_CARD_HEAD = re.compile(rf"^(?:\$[\d,]+\.\d{{2}}|{_DATE.pattern}\s+\$[\d,]+\.\d{{2}}|\$[\d,]+\.\d{{2}}\s+{_DATE.pattern})$")


def _account_cards(column: int, tagged: list[tuple[str, Line]], marks) -> list[Card]:
    """A card starts at its amount line ("$1,916.00" over the date and standing) and runs to the next one."""
    lines = [ln for kind, ln in tagged if kind == "accounts"]
    heads = [i for i, ln in enumerate(lines) if _CARD_HEAD.match(ln.text.strip()) and _has_date_near(lines, i)]
    cards = []
    for n, i in enumerate(heads):
        end = heads[n + 1] if n + 1 < len(heads) else len(lines)
        # Creditor information of the previous card trails right up to the next amount; keep lines of this card only.
        card = Card(column, lines[i].page, lines[i].top, lines[i:end])
        card.section = _section_at(marks, lines[i].page, lines[i].top)[0]
        cards.append(card)
    return cards


def _has_date_near(lines: list[Line], i: int) -> bool:
    return bool(_DATE.search(lines[i].text)) or any(
        j < len(lines) and _DATE.search(lines[j].text) and abs(lines[j].top - lines[i].top) < 16 for j in (i + 1, i + 2)
    )


def _first(pattern: str, text: str, flags: int = re.I | re.M) -> str:
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else ""


def _card_fields(card: Card) -> dict[str, str]:
    text = "\n" + card.text
    head, _, body = text.partition("\nOverview")
    fields: dict[str, str] = {}
    head_lines = []
    for ln in card.lines:
        if ln.text == "Overview" or ln.top - card.top > 30 or ln.page != card.page:
            break
        head_lines.append(ln.text)
    fields["reported"] = next((d.group(0) for h in head_lines for d in [_DATE.search(h)] if d), "")
    standing = [
        h
        for h in head_lines
        if not _MONEY_ONLY.match(h.strip()) and not _DATE.search(h) and not _HASH.match(h.strip())
    ]
    fields["standing"] = re.sub(r"\s+", " ", " ".join(standing)).strip()
    head_money = next((m.group(0) for h in head_lines for m in [_MONEY.search(h)] if m), "")
    fields["header_balance"] = head_money
    # Balance and limit: labels on one line, amounts on the next ("Balance: Credit limit:" / "$1 $2").
    ov = re.search(r"(?s)Balance:(.*?)Account details", body)
    if ov:
        seg = ov.group(1)
        labels = re.findall(r"(Credit limit|Highest balance)\s*:", seg, re.I)
        monies = _MONEY.findall(seg)
        if monies:
            fields["balance"] = monies[0]
        if len(monies) > 1 and labels:
            key = "limit" if labels[0].lower().startswith("credit") else "highest"
            fields[key] = monies[1]
    number = _first(r"^Account Number[ \t]+(\S+)", body)
    if not number:
        number = _first(r"^Account\n(\S+)\nNumber$", body)
    fields["number"] = number
    for key, label in (
        ("status", "Account Status"),
        ("opened", "Open Date"),
        ("activity", "Last Activity"),
        ("type", "Type"),
        ("responsibility", "Responsibility"),
        ("months", "Month's Reviewed"),
    ):
        fields[key] = _first(rf"^{re.escape(label)}[ \t]+(.+)$", body)
    fields["late"] = _first(r"Times 30/60/90 Days Late\s+(\d+\s*/\s*\d+\s*/\s*\d+)", body).replace(" ", "")
    for key, label in (("high_balance", "High Balance"), ("high_credit", "High Credit"), ("monthly", "Monthly Payment"), ("past_due", "Amount Past Due")):
        fields[key] = _first(rf"^{label}[ \t]+(\$[\d,]+(?:\.\d{{2}})?)", body)
    # "Current Payment Status" wraps in narrow columns; its label words and value interleave.
    pay = re.search(r"(?ms)^Current\b(.*?)^Amount Past Due", body)
    if pay:
        # Label words never belong to a value; a label printed twice leaves its value twice too.
        tokens = [t for t in pay.group(1).split() if t not in ("Current", "Payment", "Status")]
        tokens = [t for i, t in enumerate(tokens) if i == 0 or t != tokens[i - 1]]
        joined = ""
        for tok in tokens:
            joined += tok if joined.endswith("-") else f" {tok}"
        fields["payment_status"] = joined.strip()
    rem = re.search(r"(?s)^Remarks\s*(.*?)\nTimes 30/60/90", body, re.M)
    fields["remarks"] = re.sub(r"\s+", " ", rem.group(1)).strip() if rem else ""
    info = re.search(r"(?s)Creditor information\n(.*?)(?:\nAccount ID|\Z)", body)
    fields["info_name"] = info.group(1).splitlines()[0].strip() if info and info.group(1).strip() else ""
    fields["grid_lates"] = _grid_lates(body)
    return fields


def _grid_lates(body: str) -> str:
    """Late marks in the month grid: the lines between "Payment history" and the legend."""
    start = body.find("Payment history")
    if start < 0:
        return ""
    grid = body[start:]
    legend = re.search(r"^Paid on time", grid, re.M)
    if legend:
        grid = grid[: legend.start()]
    counts: dict[str, int] = {}
    for line in grid.splitlines()[1:]:
        if re.search(r"[A-Za-z]{4,}|%", line) and not re.search(r"^(?:\d{4}\s+)?(?:Jan|Jul)\b", line):
            continue
        for mark in re.findall(r"(?<![\w$,.%])(30|60|90|120|150)(?![\w,.%])", line):
            counts[mark] = counts.get(mark, 0) + 1
    return ", ".join(f"{m} days x{n}" for m, n in sorted(counts.items(), key=lambda kv: int(kv[0])))


# --- rows -> tradelines ---------------------------------------------------------------------

_NOT_A_NAME = re.compile(r"(?i)^(?:total count|hide details|show details|bureau|n/a)$")


_SECTION_TYPE = {
    "credit cards": "Credit Card",
    "auto loans": "Auto Loan",
    "student loans": "Educational",
    "real estate loans": "Mortgage",
    "real estate": "Mortgage",
}


def _row_label(layout: Layout, page: int, top: float) -> str:
    """The furnisher name in the left gutter beside a card (names can wrap onto two lines)."""
    near = [
        g
        for g in layout.gutter
        if g.page == page and top - 8 <= g.top <= top + 40 and not _NOT_A_NAME.match(g.text) and g.text.strip().lower() not in _SECTION_NAMES
    ]
    if not near:
        return ""
    near.sort(key=lambda g: g.top)
    # Keep the group of lines closest to the card; wrapped lines sit within ~16pt of each other.
    group = [near[-1]]
    for g in reversed(near[:-1]):
        if group[0].top - g.top <= 16:
            group.insert(0, g)
        else:
            break
    return re.sub(r"\s+", " ", " ".join(g.text for g in group)).strip()


def _severity(fields: dict[str, str]) -> int:
    blob = f"{fields.get('payment_status', '')} {fields.get('standing', '')} {fields.get('status', '')}".lower()
    if re.search(r"collection|charge|repossess|foreclos", blob):
        return 3
    if re.search(r"late|past due|delinq", blob) or _money_value(fields.get("past_due", "")) > 0:
        return 2
    return 0


def _money_value(text: str) -> float:
    try:
        return float(re.sub(r"[^\d.]", "", text or "") or 0)
    except ValueError:
        return 0.0


def _clean_standing(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _compose_status(fields: dict[str, str]) -> str:
    state = fields.get("status", "")
    pay = fields.get("payment_status", "") or ""
    standing = fields.get("standing", "")
    if not pay and re.search(r"(?i)past due|late", standing):
        pay = standing
    if standing and re.search(r"(?i)past due", standing) and not re.search(r"(?i)late|past due|collection|charge", pay):
        pay = f"{pay}; Past due".strip("; ")
    if state.lower() in ("charge off", "collection") and re.search(r"(?i)collection|charge", pay):
        state = ""
    if state and pay and state.lower() not in pay.lower():
        text = f"{state}. {pay}"
    else:
        text = pay or state or standing
    # The card header says Closed even when the account status reads "Charge Off".
    if re.match(r"(?i)closed", standing) and not re.search(r"(?i)closed", f"{state} {pay}"):
        text = f"Closed. {text}" if text and text.lower() != "closed" else "Closed"
    return text


def _times_late(cards: dict[int, dict[str, str]]) -> str:
    per = {c: f["late"] for c, f in cards.items() if f.get("late") and any(b != "0" for b in f["late"].split("/"))}
    if not per:
        return ""
    if len(set(per.values())) == 1:
        return f"Times late 30/60/90: {next(iter(per.values()))}"
    names = {0: "TU", 1: "EQ", 2: "EX"}
    return "Times late 30/60/90: " + ", ".join(f"{names[c]} {v}" for c, v in sorted(per.items()))


def _account_rows(layout: Layout, tagged, marks) -> list[Tradeline]:
    from app.models import Tradeline

    cards = [c for ci, t in enumerate(tagged) for c in _account_cards(ci, t, marks)]
    rows: list[list[Card]] = []
    for card in sorted(cards, key=lambda c: (c.page, c.top, c.column)):
        for row in rows:
            if row[0].page == card.page and abs(row[0].top - card.top) < 8 and all(r.column != card.column for r in row):
                row.append(card)
                break
        else:
            rows.append([card])
    out: list[Tradeline] = []
    for row in rows:
        fields = {c.column: _card_fields(c) for c in row}
        order = sorted(fields, key=lambda c: (-_severity(fields[c]), c))
        worst = fields[order[0]]

        def pick(key: str) -> str:
            for c in sorted(fields):
                if fields[c].get(key):
                    return fields[c][key]
            return ""

        name = _row_label(layout, row[0].page, row[0].top) or next(
            (f["info_name"] for f in fields.values() if f.get("info_name")), ""
        )
        if not name:
            continue
        late = _times_late(fields)
        status = _compose_status(worst)
        if late and late not in status:
            status = f"{status}; {late}".strip("; ")
        grid = {c: f["grid_lates"] for c, f in fields.items() if f.get("grid_lates")}
        history = late
        if grid:
            history = "; ".join(
                x for x in (history, "Late payments in history: " + ", ".join(f"{('TU', 'EQ', 'EX')[c]} {g}" for c, g in sorted(grid.items()))) if x
            )
        numbers = {c: fields[c].get("number", "") for c in fields}
        present = [BUREAUS[c] for c in sorted(fields)]
        out.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=name,
                account_tu=numbers.get(0, ""),
                account_eqf=numbers.get(1, ""),
                account_exp=numbers.get(2, ""),
                account_type=pick("type") or _SECTION_TYPE.get(row[0].section, ""),
                status=status,
                balance=pick("balance") or pick("header_balance"),
                past_due=max((f.get("past_due", "") for f in fields.values()), key=_money_value, default=""),
                credit_limit=pick("limit"),
                high_credit=pick("high_credit") or pick("high_balance") or pick("highest"),
                date_opened=pick("opened"),
                last_reported=pick("reported"),
                payment_history=history,
                monthly_payment=pick("monthly"),
                remarks="; ".join(x for x in (f"Responsibility: {pick('responsibility')}" if pick("responsibility") else "", pick("remarks")) if x),
                bureaus=present,  # type: ignore[arg-type]
                dispute_bureaus=list(present),  # type: ignore[arg-type]
                is_collection=bool(re.search(r"(?i)collection", f"{pick('type')} {status}")),
            )
        )
    return out


# --- inquiries, collections, public records ---------------------------------------------------

def _section_lines(tagged_col: list[tuple[str, Line]], kind: str) -> list[Line]:
    return [ln for k, ln in tagged_col if k == kind]


def _inquiries(tagged) -> list[Tradeline]:
    out: list[Tradeline] = []
    for ci, col in enumerate(tagged):
        lines = _section_lines(col, "inquiries")
        for i, ln in enumerate(lines):
            if ln.text != "Creditor information" or i + 1 >= len(lines):
                continue
            name = lines[i + 1].text.strip()
            date = ""
            business = ""
            for back in range(1, 4):
                if i - back < 0:
                    break
                prev = lines[i - back]
                if ln.top - prev.top > 40:
                    break
                found = _DATE.search(prev.text)
                if found:
                    date = found.group(0)
                    after = lines[i - back + 1].text if back > 1 else ""
                    if back > 1 and not _DATE.search(after) and after != name and len(after.split()) <= 3:
                        business = after
                    break
            if not date:
                continue
            out.append(
                Tradeline(
                    id=str(uuid.uuid4()),
                    creditor=name,
                    account_type="Hard Inquiry",
                    remarks=business,
                    date_opened=date,
                    last_reported=date,
                    bureaus=[BUREAUS[ci]],  # type: ignore[list-item]
                    dispute_bureaus=[BUREAUS[ci]],  # type: ignore[list-item]
                )
            )
    return out


def _detail(block: str, label: str, money: bool = False) -> str:
    pat = r"\$[\d,]+(?:\.\d{2})?" if money else r".+?"
    return _first(rf"^{re.escape(label)}[ \t]+({pat})[ \t]*$", block)


def _collection_starts(lines: list[Line], idx: list[int]) -> list[int]:
    """Where each collection card begins: the amount/date header above its "Account details"."""
    starts = []
    for n, i in enumerate(idx):
        floor = idx[n - 1] + 1 if n else 0
        ad = max((k for k in range(floor, i) if lines[k].text == "Account details"), default=i)
        j = ad
        while j - 1 >= floor:
            prev = lines[j - 1]
            if prev.page != lines[ad].page or lines[ad].top - prev.top > 40 or prev.text.startswith("Account ID") or _HASH.match(prev.text):
                break
            j -= 1
        starts.append(j)
    return starts


def _collections(tagged) -> list[Tradeline]:
    found: list[Tradeline] = []
    number_attr = ("account_tu", "account_eqf", "account_exp")
    for ci, col in enumerate(tagged):
        lines = _section_lines(col, "collections")
        idx = [i for i, ln in enumerate(lines) if ln.text.startswith("Account Number")]
        starts = _collection_starts(lines, idx)
        for n, i in enumerate(idx):
            end = starts[n + 1] if n + 1 < len(starts) else len(lines)
            block = "\n".join(ln.text for ln in lines[i:end])
            head = "\n".join(ln.text for ln in lines[starts[n] : i])
            account = _first(r"^Account Number\s+(\S+)", block)
            original = _detail(block, "Original Creditor")
            agency = _first(r"^Collection agency\n(.+)$", block)
            if agency.startswith("Account ID"):
                agency = ""
            balance = _detail(block, "Unpaid Balance", True)
            date_in_head = _DATE.search(head)
            reported = date_in_head.group(0) if date_in_head else ""
            name = agency or _first(r"^([A-Z][A-Z0-9 &/.'-]{2,40})$", head, re.M)
            # The same collection prints in each bureau's column, often under another agency name.
            # Match on the account number, then the amount; the same agency can hold two accounts.
            same = [
                r
                for r in found
                if BUREAUS[ci] not in r.bureaus
                and (
                    (account and account in (r.account_tu, r.account_eqf, r.account_exp))
                    or (balance and r.balance == balance and r.date_opened == _detail(block, "Date Opened"))
                )
            ]
            row = next((r for r in same if r.balance == balance), None) or (same[0] if len(same) == 1 else None)
            if row is not None and name and row.creditor.startswith("Unnamed"):
                row.creditor = name
            status = _detail(block, "Status")
            if row is None:
                row = Tradeline(
                    id=str(uuid.uuid4()),
                    creditor=name or f"Unnamed · Collection {account}".strip(),
                    account_type="Collection",
                    status="Collection" + (f"; {status}" if status and status.lower() != "refinanced" else ""),
                    balance=balance,
                    past_due=balance,
                    high_credit=_detail(block, "High Balance", True),
                    monthly_payment=_detail(block, "Monthly Payment", True),
                    date_opened=_detail(block, "Date Opened"),
                    last_reported=reported,
                    remarks=f"Original creditor: {original}" if original else "",
                    is_collection=True,
                )
                found.append(row)
            if BUREAUS[ci] not in row.bureaus:
                row.bureaus.append(BUREAUS[ci])  # type: ignore[arg-type]
                row.dispute_bureaus.append(BUREAUS[ci])  # type: ignore[arg-type]
            setattr(row, number_attr[ci], account)
    return found


def _public_records(tagged) -> list[Tradeline]:
    out: list[Tradeline] = []
    for ci, col in enumerate(tagged):
        lines = _section_lines(col, "public")
        idx = [i for i, ln in enumerate(lines) if ln.text == "Account details"]
        for n, i in enumerate(idx):
            hi = idx[n + 1] if n + 1 < len(idx) else len(lines)
            block = "\n".join(ln.text for ln in lines[i:hi])
            kind = _detail(block, "Type")
            if not kind:
                continue
            filed = _detail(block, "Date Filed")
            out.append(
                Tradeline(
                    id=str(uuid.uuid4()),
                    creditor=kind,
                    account_tu=_detail(block, "Docket Identifier") if ci == 0 else "",
                    account_eqf=_detail(block, "Docket Identifier") if ci == 1 else "",
                    account_exp=_detail(block, "Docket Identifier") if ci == 2 else "",
                    account_type="Public Record",
                    status=_detail(block, "Status"),
                    date_opened=filed,
                    last_reported=_detail(block, "Disposition Date"),
                    remarks="; ".join(x for x in (f"Court: {_detail(block, 'Court')}" if _detail(block, "Court") else "",) if x),
                    bureaus=[BUREAUS[ci]],  # type: ignore[list-item]
                    dispute_bureaus=[BUREAUS[ci]],  # type: ignore[list-item]
                )
            )
    return out


# --- scores and totals ------------------------------------------------------------------------

def read_scores(path: str, origins: list[float]) -> dict[str, int | None]:
    """VantageScore per column from page 1; a column printed "N/A" has no score."""
    import pdfplumber

    scores: dict[str, int | None] = {"tuc": None, "eqf": None, "exp": None}
    with pdfplumber.open(path) as pdf:
        words = pdf.pages[0].extract_words(x_tolerance=1.5, y_tolerance=2)
    anchor = next((w for w in words if w["text"].startswith("VantageScore")), None)
    if anchor is None:
        return scores
    edges = [o - 30 for o in origins] + [10_000.0]
    near = [w for w in words if abs(w["top"] - anchor["top"]) < 70 and w["top"] < anchor["top"] + 14]
    scale_rows = {round(w["top"]) for w in near if w["text"] == "850"}
    for key, ci in (("tuc", 0), ("eqf", 1), ("exp", 2)):
        band = [w for w in near if edges[ci] <= w["x0"] < edges[ci + 1] and round(w["top"]) not in scale_rows]
        if any(w["text"].upper() == "N/A" for w in band):
            continue
        for w in sorted(band, key=lambda w: w["top"]):
            if re.fullmatch(r"\d{3}", w["text"]) and 300 <= int(w["text"]) <= 850:
                scores[key] = int(w["text"])
                break
    return scores


@dataclass
class HeroResult:
    tradelines: list[Tradeline]
    scores: dict[str, int | None]
    origins: list[float]


def is_all_bureaus(path: str) -> bool:
    try:
        return read_layout_cached(path) is not None
    except Exception:
        return False


@lru_cache(maxsize=8)
def read_layout_cached(path: str) -> Layout | None:
    layout = read_layout(path)
    if layout is None:
        return None
    if not any(g.text.strip() == "Total count" for g in layout.gutter):
        return None
    return layout


@lru_cache(maxsize=8)
def parse_pdf(path: str) -> HeroResult | None:
    """Tradelines (accounts, inquiries, collections, public records) and scores, per bureau column."""
    layout = read_layout_cached(path)
    if layout is None:
        return None
    marks = _section_marks(layout)
    if not marks:
        return None
    tagged = _partition(layout, marks)
    rows = _account_rows(layout, tagged, marks)
    rows += _collections(tagged)
    rows += _public_records(tagged)
    rows += _inquiries(tagged)
    return HeroResult(rows, read_scores(path, layout.origins), layout.origins)


# --- entry points used by the analyzer -------------------------------------------------------

def parse_document(doc):
    """A ParsedReport for an all-bureaus Credit Hero PDF, or None when the layout does not match."""
    from app.models import ParsedReport

    if getattr(doc, "file_type", "") != "pdf" or not getattr(doc, "raw_path", "") or getattr(doc, "ocr_used", False):
        return None
    try:
        result = parse_pdf(str(doc.raw_path))
    except Exception:
        return None
    if result is None or not any(t.account_type not in ("Hard Inquiry",) for t in result.tradelines):
        return None
    from app.services.bureau_text_parser import _consumer_from_text, _report_date

    text = doc.text or ""
    return ParsedReport(
        source="fallback_parser",
        report_date=_report_date(text),
        consumer=_consumer_from_text(text),
        tradelines=[t.model_copy(deep=True) for t in result.tradelines],
        file_type=doc.file_type,
        ocr_used=False,
        extraction_quality=doc.extraction_quality,
    )


def scores_for(doc) -> dict[str, int | None] | None:
    """Column scores of an all-bureaus Credit Hero PDF ("N/A" columns are None), else None."""
    if getattr(doc, "file_type", "") != "pdf" or not getattr(doc, "raw_path", "") or getattr(doc, "ocr_used", False):
        return None
    try:
        result = parse_pdf(str(doc.raw_path))
    except Exception:
        return None
    return dict(result.scores) if result else None
