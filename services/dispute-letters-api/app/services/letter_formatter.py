from __future__ import annotations

import html
import re
from datetime import date
from io import BytesIO


SECTION_HEADINGS = frozenset(
    {
        "Consumer Identification",
        "Disputed Tradelines",
        "Statutory Reinvestigation Requirements",
        "Requested Outcome",
        "Enclosures",
        "CONSUMER INFORMATION",
        "DISPUTED ITEMS",
        "STATUTORY REINVESTIGATION REQUIREMENTS",
        "REQUESTED OUTCOME",
        "ENCLOSURES",
    }
)

_BULLET_RE = re.compile(r"^(?:●|•|▪|◦|[-*+])\s+")
_FIELD_LABEL_RE = re.compile(
    r"^(Full Name|Date of Birth|Social Security Number|SSN|Current Address|"
    r"Additional Addresses on File|"
    r"Account Number|Reported Status|Reported Balance|Basis of Dispute)\s*:",
    re.IGNORECASE,
)
_DATE_LINE_RE = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s*$"
)


def replace_letter_sentence_dashes(text: str) -> str:
    """Turn em/en dashes used as sentence punctuation into commas or periods.

    Keeps hyphens in words (charge-off) and numeric/statutory ranges (§611(a)(6)–(7)).
    """
    return "".join(_replace_letter_sentence_dashes_line(line) for line in text.splitlines(keepends=True))


def _replace_letter_sentence_dashes_line(line: str) -> str:
    prefer_comma = line.lstrip().lower().startswith("re:")

    def _punct(following: str) -> str:
        if prefer_comma or not following[:1].isupper():
            return ", "
        return ". "

    def _is_citation_range(before: str, after: str) -> bool:
        return bool(re.search(r"\d", before) and re.search(r"\d", after))

    def _spaced(match: re.Match[str]) -> str:
        following = match.group(1)
        return f"{_punct(following)}{following}"

    def _unspaced(match: re.Match[str]) -> str:
        left, right = match.group(1), match.group(2)
        if _is_citation_range(left[-16:], right[:16]):
            return match.group(0)
        return f"{left}{_punct(right)}{right}"

    def _leftover(match: re.Match[str]) -> str:
        start, end = match.start(), match.end()
        before = match.string[max(0, start - 16) : start]
        after = match.string[end : end + 16]
        if _is_citation_range(before, after):
            return match.group(0)
        return ", "

    line = re.sub(r"[ \t]*[—–][ \t]*([A-Za-z])", _spaced, line)
    line = re.sub(r"[ \t]+-[ \t]+([A-Za-z])", _spaced, line)
    line = re.sub(r"(\S{1,40})[—–](\S{1,80})", _unspaced, line)
    line = re.sub(r"[ \t]*[—–][ \t]*", _leftover, line)
    line = re.sub(r"[^\S\n]{2,}", " ", line)
    return line


def normalize_letter_source(text: str) -> str:
    """Clean agent output while preserving controlled **bold** markup."""
    text = text.strip()
    text = re.sub(r"```[\w]*\n?", "", text)
    text = text.replace("```", "")
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Normalize bullet markers to a filled circle for consistent print layout
    text = re.sub(r"^(\s*)(?:[•▪◦]|\-|\*|\+)\s+", r"\1● ", text, flags=re.MULTILINE)
    text = replace_letter_sentence_dashes(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_markdown(text: str) -> str:
    """Plain text for .txt download — no bold markers."""
    text = normalize_letter_source(text)
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


def finalize_letter(text: str) -> str:
    cleaned = strip_markdown(text)
    cleaned = re.sub(
        r"\n+This letter was prepared with automated assistance.*$",
        "",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return cleaned.strip()


def _indent_level(line: str) -> int:
    if not line.strip():
        return 0
    leading = len(line) - len(line.lstrip(" "))
    if leading >= 8:
        return 2
    if leading >= 4:
        return 1
    return 0


def _line_display(line: str) -> str:
    return line.strip()


def _is_bullet(line: str) -> bool:
    return bool(_BULLET_RE.match(line.strip()))


def _bullet_text(line: str) -> str:
    return _BULLET_RE.sub("", line.strip()).strip()


def _is_section_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or stripped.endswith(":") or "**" in stripped:
        return False
    if _is_field_label_line(stripped):
        return False
    if stripped in SECTION_HEADINGS:
        return True
    if stripped.lower().startswith("re:"):
        return False
    if any(c.isdigit() for c in stripped):
        return False
    # Do not treat ALL-CAPS consumer names as headings — only known section labels above.
    if stripped.isupper():
        return False
    words = stripped.split()
    if len(words) < 2 or len(stripped) > 55:
        return False
    small = {"of", "and", "the", "or", "to", "a", "an"}
    return all(w[:1].isupper() for w in words if w.lower() not in small)


def _is_name_line(line: str, *, index: int) -> bool:
    """ALL-CAPS consumer name typically appears near the top after the date."""
    stripped = line.strip()
    if index > 6 or not stripped or len(stripped) > 60:
        return False
    if any(c.isdigit() for c in stripped):
        return False
    letters = [c for c in stripped if c.isalpha()]
    if len(letters) < 4:
        return False
    return stripped == stripped.upper() and " " in stripped


def _is_field_label_line(line: str) -> bool:
    return bool(_FIELD_LABEL_RE.match(line.strip()))


def _is_subheading(line: str) -> bool:
    return line.strip().lower().rstrip(":") == "basis of dispute"


def _extract_letter_date(body: str) -> str:
    for line in body.splitlines()[:8]:
        if _DATE_LINE_RE.match(line.strip()):
            return line.strip()
    return date.today().strftime("%B %d, %Y")


def _inline_html(text: str) -> str:
    """Render **bold** spans inside escaped text."""
    parts = re.split(r"(\*\*.+?\*\*)", text)
    out: list[str] = []
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            inner = html.escape(part[2:-2])
            out.append(f"<strong>{inner}</strong>")
        else:
            out.append(html.escape(part))
    return "".join(out)


def _inline_pdf(text: str) -> str:
    """Render **bold** spans for ReportLab Paragraph XML (no literal asterisks)."""
    parts = re.split(r"(\*\*.+?\*\*)", text or "")
    out: list[str] = []
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) >= 4:
            inner = (
                part[2:-2]
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            out.append(f"<b>{inner}</b>")
        else:
            out.append(
                part.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            )
    return "".join(out)


def _is_tight_line(
    display: str,
    *,
    heading: bool,
    name_line: bool,
    field_line: bool,
    closing: bool,
) -> bool:
    return field_line or (
        not heading
        and not name_line
        and not closing
        and len(display) < 70
        and ":" not in display
    )


def _is_closing_line(display: str) -> bool:
    normalized = display.strip().lower().rstrip(".")
    return normalized in {"respectfully,", "respectfully", "sincerely,", "sincerely"}


def _is_run_on(block: dict) -> bool:
    return block.get("kind") == "line" and block.get("variant") in {"name", "field", "tight"}


def _compact_blocks(blocks: list[dict]) -> list[dict]:
    compacted: list[dict] = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        if block["kind"] == "spacer":
            j = i + 1
            while j < len(blocks) and blocks[j]["kind"] == "spacer":
                j += 1
            nxt = blocks[j] if j < len(blocks) else None
            prev = compacted[-1] if compacted else None
            skip = (nxt or {}).get("variant") == "heading" or (prev or {}).get("variant") in {
                "closing",
                "heading",
                "signature",
            }
            if not skip and prev and _is_run_on(prev) and nxt and not _is_run_on(nxt):
                compacted.append({"kind": "spacer"})
            i = j
            continue
        compacted.append(block)
        i += 1
    return compacted


def _mark_signature_block(blocks: list[dict]) -> list[dict]:
    """Mark the first name after Respectfully/Sincerely as the sign-off row.

    That row keeps the typed name on the left and a cursive signature on the right.
    """
    awaiting = False
    for block in blocks:
        if block.get("kind") != "line":
            continue
        if block.get("variant") == "closing":
            awaiting = True
            continue
        if not awaiting:
            continue
        text = str(block.get("text") or "").strip()
        if not text:
            continue
        # Title-case consumer names can look like headings; only stop on known sections.
        if text in SECTION_HEADINGS:
            awaiting = False
            continue
        block["variant"] = "signature"
        awaiting = False
    return blocks


def _signature_image_html(name: str) -> str | None:
    png = None
    try:
        from app.services.letter_signature import render_signature_png

        png = render_signature_png(name)
    except Exception:
        png = None
    if not png:
        return None
    import base64

    b64 = base64.b64encode(png).decode("ascii")
    return (
        f'<img class="letter-signature-img" alt="{html.escape(name)}" '
        f'src="data:image/png;base64,{b64}" />'
    )


_OPENING_SENSITIVE_RE = re.compile(
    r"^(?:Date of Birth|Social Security Number|SSN)\s*:",
    re.I,
)


def _drop_opening_sensitive_lines(lines: list[str]) -> list[str]:
    """Birthday and Social Security number belong only in Consumer Identification."""
    id_index = next(
        (
            i
            for i, line in enumerate(lines)
            if line.strip() in {"Consumer Identification", "CONSUMER INFORMATION"}
        ),
        -1,
    )
    if id_index < 0:
        return lines
    return [
        line
        for i, line in enumerate(lines)
        if i >= id_index or not _OPENING_SENSITIVE_RE.match(line.strip())
    ]


def letter_layout(text: str) -> dict:
    """Shared structure for HTML preview, React preview, and .docx export."""
    body = normalize_letter_source(text)
    letter_date = _extract_letter_date(body)
    lines = _drop_opening_sensitive_lines(body.splitlines())
    start = 0
    if lines and _DATE_LINE_RE.match(lines[0].strip()):
        start = 1
        if start < len(lines) and not lines[start].strip():
            start += 1

    blocks: list[dict] = []
    prev_blank = True
    for i, line in enumerate(lines[start:], start=start):
        if not line.strip():
            if not prev_blank:
                blocks.append({"kind": "spacer"})
            prev_blank = True
            continue
        prev_blank = False
        display = _line_display(line)
        if _is_bullet(display):
            blocks.append({"kind": "bullet", "text": _bullet_text(display)})
            continue
        heading = _is_section_heading(display)
        name_line = _is_name_line(display, index=i)
        closing = _is_closing_line(display)
        field_line = _is_field_label_line(display) or _is_subheading(display)
        tight = _is_tight_line(
            display,
            heading=heading,
            name_line=name_line,
            field_line=field_line,
            closing=closing,
        )
        if heading:
            variant = "heading"
        elif name_line:
            variant = "name"
        elif closing:
            variant = "closing"
        elif field_line:
            variant = "field"
        elif tight:
            variant = "tight"
        else:
            variant = "body"
        blocks.append(
            {
                "kind": "line",
                "text": display,
                "variant": variant,
                "indent": _indent_level(line),
            }
        )
    return {"date": letter_date, "blocks": _mark_signature_block(_compact_blocks(blocks))}


def letter_to_html(text: str) -> str:
    """HTML preview that mirrors letter_to_docx layout (header date, body, spacing)."""
    layout = letter_layout(text)
    parts: list[str] = [
        '<div class="letter-page">',
        '<div class="letter-header">',
        f'<span class="letter-header-date">{html.escape(layout["date"])}</span>',
        '<span class="letter-header-page">Page 1/1</span>',
        "</div>",
        '<div class="letter-body">',
    ]
    for block in layout["blocks"]:
        kind = block["kind"]
        if kind == "spacer":
            parts.append('<p class="letter-spacer">&nbsp;</p>')
            continue
        if kind == "bullet":
            inner = _inline_html(block["text"])
            parts.append(f'<p class="letter-line letter-bullet">● {inner}</p>')
            continue
        inner = _inline_html(block["text"])
        classes = ["letter-line"]
        indent = int(block.get("indent") or 0)
        if indent:
            classes.append(f"letter-indent-{indent}")
        variant = block.get("variant") or "body"
        if variant == "heading":
            classes.append("letter-heading")
        elif variant == "name":
            classes.append("letter-name")
        elif variant == "closing":
            classes.append("letter-closing")
        elif variant == "signature":
            # Typed name on the left, cursive signature on the right side of the page.
            sig_img = _signature_image_html(block["text"])
            sig_inner = sig_img or f'<span class="letter-signature-fallback">{inner}</span>'
            parts.append(
                '<div class="letter-signoff-row">'
                f'<p class="letter-line letter-signatory-name">{inner}</p>'
                f'<div class="letter-signature">{sig_inner}</div>'
                "</div>"
            )
            continue
        elif variant == "field":
            classes.append("letter-field")
        elif variant == "tight":
            classes.append("letter-tight")
        parts.append(f'<p class="{" ".join(classes)}">{inner}</p>')
    parts.extend(["</div>", "</div>"])
    return "\n".join(parts)


def _add_runs(para, line: str, *, bold_all: bool = False) -> None:
    parts = re.split(r"(\*\*.+?\*\*)", line)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = para.add_run(part[2:-2])
            run.bold = True
        else:
            run = para.add_run(part)
            if bold_all:
                run.bold = True


def _add_signature_row(document, name: str):
    """Typed name on the left, cursive signature image on the right side of the page."""
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt

    table = document.add_table(rows=1, cols=2)
    table.autofit = False
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        borders.append(el)
    tbl_pr.append(borders)

    left, right = table.rows[0].cells
    left.width = Inches(3.0)
    right.width = Inches(3.5)
    _set_cell_borders_nil(left)
    _set_cell_borders_nil(right)

    for cell, width_dxa in ((left, 4320), (right, 5040)):
        tc_pr = cell._tc.get_or_add_tcPr()
        tc_w = OxmlElement("w:tcW")
        tc_w.set(qn("w:w"), str(width_dxa))
        tc_w.set(qn("w:type"), "dxa")
        tc_pr.append(tc_w)

    lp = left.paragraphs[0]
    lp.paragraph_format.space_before = Pt(0)
    lp.paragraph_format.space_after = Pt(4)
    lp.paragraph_format.line_spacing = 1.0
    lp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    name_run = lp.add_run(name)
    _set_run_font(name_run, size_pt=12)

    rp = right.paragraphs[0]
    rp.paragraph_format.space_before = Pt(0)
    rp.paragraph_format.space_after = Pt(4)
    rp.paragraph_format.line_spacing = 1.0
    rp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    png = None
    try:
        from app.services.letter_signature import render_signature_png

        png = render_signature_png(name)
    except Exception:
        png = None
    if png:
        run = rp.add_run()
        stream = BytesIO(png)
        run.add_picture(stream, width=Inches(min(3.2, max(1.6, 0.2 * max(len(name), 8)))))
    else:
        run = rp.add_run(name)
        run.italic = True
        _set_run_font(run, size_pt=18)
    return table


def _add_rich_paragraph(
    document,
    line: str,
    *,
    indent_level: int = 0,
    heading: bool = False,
    name_line: bool = False,
    field_line: bool = False,
    tight: bool = False,
    closing: bool = False,
):
    from docx.enum.text import WD_LINE_SPACING
    from docx.shared import Inches, Pt

    para = document.add_paragraph()
    fmt = para.paragraph_format
    fmt.line_spacing = 1.0
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
    fmt.space_before = Pt(10) if heading else Pt(0)
    if heading:
        fmt.space_after = Pt(4)
    elif closing:
        fmt.space_after = Pt(8)
    elif name_line or field_line or tight:
        fmt.space_after = Pt(0)
    else:
        fmt.space_after = Pt(6)

    if indent_level:
        fmt.left_indent = Inches(0.35 * indent_level)

    _add_runs(para, line, bold_all=heading or name_line)
    return para


def _add_bullet_paragraph(document, text: str):
    from docx.enum.text import WD_LINE_SPACING
    from docx.shared import Inches, Pt

    para = document.add_paragraph()
    fmt = para.paragraph_format
    fmt.left_indent = Inches(0.25)
    fmt.first_line_indent = Inches(-0.2)
    fmt.space_after = Pt(2)
    fmt.space_before = Pt(0)
    fmt.line_spacing = 1.0
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
    _add_runs(para, f"● {text}")
    return para


def _add_spacer_paragraph(document):
    from docx.enum.text import WD_LINE_SPACING
    from docx.shared import Pt

    para = document.add_paragraph()
    fmt = para.paragraph_format
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(8)
    fmt.line_spacing = 1.0
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
    run = para.add_run("")
    _set_run_font(run, size_pt=6)
    return para


def _set_run_font(run, *, size_pt: float = 11) -> None:
    from docx.oxml.ns import qn
    from docx.shared import Pt

    run.font.name = "Times New Roman"
    run.font.size = Pt(size_pt)
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), "Times New Roman")
    rFonts.set(qn("w:hAnsi"), "Times New Roman")


def _add_page_field(paragraph, instr: str):
    """Insert a Word field such as PAGE or NUMPAGES."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    run = paragraph.add_run()
    _set_run_font(run, size_pt=11)
    r = run._r

    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")

    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = f" {instr} "

    fld_separate = OxmlElement("w:fldChar")
    fld_separate.set(qn("w:fldCharType"), "separate")

    # Placeholder shown until Word updates fields
    placeholder = OxmlElement("w:t")
    placeholder.text = "1" if instr == "PAGE" else "1"

    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")

    r.append(fld_begin)
    r.append(instr_text)
    r.append(fld_separate)
    r.append(placeholder)
    r.append(fld_end)
    return run


def _png_size(data: bytes) -> tuple[int, int] | None:
    if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        if width > 0 and height > 0:
            return width, height
    return None


def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in {0xC0, 0xC1, 0xC2}:
            height = int.from_bytes(data[i + 5 : i + 7], "big")
            width = int.from_bytes(data[i + 7 : i + 9], "big")
            if width > 0 and height > 0:
                return width, height
            return None
        if marker in {0xD8, 0xD9} or (0xD0 <= marker <= 0xD7):
            i += 2
            continue
        if i + 3 >= len(data):
            break
        length = int.from_bytes(data[i + 2 : i + 4], "big")
        i += 2 + length
    return None


def _picture_dimensions(data: bytes):
    from docx.shared import Inches

    max_w, max_h = 6.0, 4.2
    size = _png_size(data) or _jpeg_size(data)
    if not size:
        return Inches(max_w), None
    width_px, height_px = size
    aspect = height_px / width_px
    width = max_w
    height = width * aspect
    if height > max_h:
        height = max_h
        width = height / aspect
    return Inches(width), Inches(height)


def normalize_enclosure_to_jpeg(data: bytes, *, max_edge: int = 2200) -> bytes | None:
    """Re-encode enclosure bytes to a Word/PDF-safe RGB JPEG.

    Phone photos (HEIC/WebP), truncated screenshots, and odd PNG modes often
    embed into .docx as broken placeholders. Always round-trip through Pillow.
    """
    if not data or len(data) < 32:
        return None
    try:
        from PIL import Image, ImageOps
    except Exception:
        return None
    try:
        image = Image.open(BytesIO(data))
        image.load()
        image = ImageOps.exif_transpose(image)
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")
        width, height = image.size
        longest = max(width, height)
        if longest > max_edge:
            scale = max_edge / float(longest)
            image = image.resize(
                (max(1, int(width * scale)), max(1, int(height * scale))),
                Image.Resampling.LANCZOS,
            )
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=85, optimize=True)
        out = buf.getvalue()
        if len(out) < 64 or out[:2] != b"\xff\xd8":
            return None
        # Verify the JPEG can be reopened (rejects truncated payloads).
        check = Image.open(BytesIO(out))
        check.load()
        return out
    except Exception:
        return None


def enclosure_image_streams(files: list[tuple[str, bytes]]) -> list[BytesIO]:
    streams: list[BytesIO] = []
    for _name, data in files:
        if not data:
            continue
        if data[:4] == b"%PDF":
            try:
                from pdf2image import convert_from_bytes

                pages = convert_from_bytes(
                    data,
                    dpi=110,
                    fmt="jpeg",
                    first_page=1,
                    last_page=2,
                    thread_count=1,
                )
                for page in pages:
                    buf = BytesIO()
                    page.convert("RGB").save(buf, format="JPEG", quality=80)
                    jpeg = normalize_enclosure_to_jpeg(buf.getvalue())
                    if jpeg:
                        streams.append(BytesIO(jpeg))
            except Exception:
                continue
            continue
        jpeg = normalize_enclosure_to_jpeg(data)
        if jpeg:
            streams.append(BytesIO(jpeg))
    return streams


def _is_enclosure_bullet(text: str) -> bool:
    lowered = text.lower()
    return (
        "photo identification" in lowered
        or "residential address" in lowered
        or "proof of current" in lowered
        or "screenshot" in lowered
        or "disputed account" in lowered
    )


def _blocks_for_enclosures(blocks: list[dict], has_images: bool) -> list[dict]:
    """Keep the Enclosures heading + bullet list on the letter; images follow after.

    Previously we stripped enclosure bullets when images were attached, which made
    the PDF/DOCX disagree with the on-screen preview (list visible in preview,
    missing on download).
    """
    if not has_images:
        return blocks
    has_heading = any(
        block.get("kind") == "line" and str(block.get("text") or "").strip().lower() == "enclosures"
        for block in blocks
    )
    if has_heading:
        return blocks
    return list(blocks) + [{"kind": "line", "text": "Enclosures", "variant": "heading", "indent": 0}]


def _set_cell_borders_nil(cell) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        borders.append(el)
    tc_pr.append(borders)


def _enable_update_fields_on_open(document) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    settings = document.settings.element
    existing = settings.find(qn("w:updateFields"))
    if existing is None:
        update = OxmlElement("w:updateFields")
        update.set(qn("w:val"), "true")
        settings.append(update)
    else:
        existing.set(qn("w:val"), "true")


def _add_header_page_counter(document, letter_date: str) -> None:
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt

    for section in document.sections:
        section.top_margin = Inches(1.45)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11)
        section.header_distance = Inches(1)
        section.different_first_page_header_footer = False

        header = section.header
        header.is_linked_to_previous = False
        hdr = header._element
        for child in list(hdr):
            if child.tag.endswith("}p") or child.tag.endswith("}tbl"):
                hdr.remove(child)

        table = header.add_table(1, 2, Inches(6.5))
        table.autofit = False
        tbl = table._tbl
        tbl_pr = tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement(f"w:{edge}")
            el.set(qn("w:val"), "nil")
            borders.append(el)
        tbl_pr.append(borders)

        left, right = table.rows[0].cells
        left.width = Inches(3.25)
        right.width = Inches(3.25)
        _set_cell_borders_nil(left)
        _set_cell_borders_nil(right)

        lp = left.paragraphs[0]
        lp.paragraph_format.space_before = Pt(0)
        lp.paragraph_format.space_after = Pt(0)
        lp.paragraph_format.line_spacing = 1.0
        lp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        lp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        date_run = lp.add_run(letter_date)
        _set_run_font(date_run, size_pt=11)

        rp = right.paragraphs[0]
        rp.paragraph_format.space_before = Pt(0)
        rp.paragraph_format.space_after = Pt(0)
        rp.paragraph_format.line_spacing = 1.0
        rp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        page_label = rp.add_run("Page ")
        _set_run_font(page_label, size_pt=11)
        _add_page_field(rp, "PAGE")
        slash = rp.add_run("/")
        _set_run_font(slash, size_pt=11)
        _add_page_field(rp, "NUMPAGES")

        # Keep the page number glued to the right edge of the header.
        for cell, width_dxa in ((left, 4680), (right, 4680)):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = OxmlElement("w:tcW")
            tc_w.set(qn("w:w"), str(width_dxa))
            tc_w.set(qn("w:type"), "dxa")
            tc_pr.append(tc_w)


def letter_to_docx(text: str, enclosure_files: list[tuple[str, bytes]] | None = None):
    from docx import Document
    from docx.enum.text import WD_LINE_SPACING
    from docx.oxml.ns import qn
    from docx.shared import Pt

    layout = letter_layout(text)
    files = enclosure_files or []
    image_streams = enclosure_image_streams(files)
    blocks = _blocks_for_enclosures(layout["blocks"], has_images=bool(image_streams))
    document = Document()

    style = document.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)
    style.paragraph_format.space_before = Pt(0)
    style.paragraph_format.space_after = Pt(0)
    style.paragraph_format.line_spacing = 1.0
    style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")

    _add_header_page_counter(document, layout["date"])
    _enable_update_fields_on_open(document)

    for block in blocks:
        kind = block["kind"]
        if kind == "spacer":
            _add_spacer_paragraph(document)
            continue
        if kind == "bullet":
            _add_bullet_paragraph(document, block["text"])
            continue
        variant = block.get("variant") or "body"
        if variant == "signature":
            _add_signature_row(document, block["text"])
            continue
        _add_rich_paragraph(
            document,
            block["text"],
            indent_level=int(block.get("indent") or 0),
            heading=variant == "heading",
            name_line=variant == "name",
            field_line=variant == "field",
            tight=variant == "tight",
            closing=variant == "closing",
        )

    if image_streams:
        _add_enclosure_picture_streams(document, image_streams)

    return document


def _add_enclosure_picture_streams(document, streams: list[BytesIO]) -> None:
    from docx.enum.text import WD_LINE_SPACING
    from docx.shared import Pt

    for stream in streams:
        data = stream.getvalue()
        stream.seek(0)
        para = document.add_paragraph()
        fmt = para.paragraph_format
        fmt.space_before = Pt(6)
        fmt.space_after = Pt(8)
        fmt.line_spacing = 1.0
        fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
        run = para.add_run()
        width, height = _picture_dimensions(data)
        if height is None:
            run.add_picture(stream, width=width)
        else:
            run.add_picture(stream, width=width, height=height)


def _picture_size_inches(data: bytes) -> tuple[float, float]:
    max_w, max_h = 6.0, 4.2
    size = _png_size(data) or _jpeg_size(data)
    if not size:
        return max_w, max_h * 0.75
    width_px, height_px = size
    aspect = height_px / max(width_px, 1)
    width = max_w
    height = width * aspect
    if height > max_h:
        height = max_h
        width = height / max(aspect, 0.01)
    return width, height


def letter_to_pdf(text: str, enclosure_files: list[tuple[str, bytes]] | None = None) -> bytes:
    """Build a print-ready PDF letter with optional enclosure images."""
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import letter as letter_page
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    layout = letter_layout(text)
    files = enclosure_files or []
    image_streams = enclosure_image_streams(files)
    blocks = _blocks_for_enclosures(layout["blocks"], has_images=bool(image_streams))

    buf = BytesIO()
    letter_date = layout["date"] or ""

    class NumberedCanvas(pdf_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states: list[dict] = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.setFont("Times-Roman", 10)
                # Baseline sits 1in below the top edge so the date and page number are not cramped.
                self.drawString(inch, letter_page[1] - inch, letter_date)
                self.drawRightString(
                    letter_page[0] - inch,
                    letter_page[1] - inch,
                    f"Page {self._pageNumber} of {total}",
                )
                pdf_canvas.Canvas.showPage(self)
            pdf_canvas.Canvas.save(self)

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter_page,
        leftMargin=inch,
        rightMargin=inch,
        topMargin=1.55 * inch,
        bottomMargin=0.75 * inch,
    )

    body = ParagraphStyle(
        "LetterBody",
        fontName="Times-Roman",
        fontSize=11,
        leading=14,
        spaceBefore=0,
        spaceAfter=6,
        alignment=TA_LEFT,
    )
    heading = ParagraphStyle(
        "LetterHeading",
        parent=body,
        fontName="Times-Bold",
        fontSize=11,
        spaceBefore=10,
        spaceAfter=4,
    )
    name_style = ParagraphStyle("LetterName", parent=body, fontName="Times-Bold", spaceAfter=0)
    field = ParagraphStyle("LetterField", parent=body, spaceAfter=0)
    tight = ParagraphStyle("LetterTight", parent=body, spaceAfter=0)
    closing = ParagraphStyle("LetterClosing", parent=body, spaceAfter=8)
    bullet = ParagraphStyle(
        "LetterBullet",
        parent=body,
        leftIndent=18,
        firstLineIndent=-12,
        spaceAfter=2,
    )

    def escape_xml(value: str) -> str:
        return (
            (value or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    story: list = []
    for block in blocks:
        kind = block["kind"]
        if kind == "spacer":
            story.append(Spacer(1, 8))
            continue
        if kind == "bullet":
            story.append(Paragraph(f"● {_inline_pdf(block['text'])}", bullet))
            continue
        variant = block.get("variant") or "body"
        text_line = _inline_pdf(block.get("text") or "")
        if variant == "signature":
            name = block.get("text") or ""
            left = Paragraph(escape_xml(name), name_style)
            right_flowable = Paragraph(f"<i>{escape_xml(name)}</i>", body)
            try:
                from app.services.letter_signature import render_signature_png

                png = render_signature_png(name)
            except Exception:
                png = None
            if png:
                # ReportLab embeds RGB more reliably than transparent RGBA PNGs.
                try:
                    from PIL import Image as PilImage

                    rgba = PilImage.open(BytesIO(png)).convert("RGBA")
                    canvas_img = PilImage.new("RGB", rgba.size, (255, 255, 255))
                    canvas_img.paste(rgba, mask=rgba.split()[3])
                    rgb_buf = BytesIO()
                    canvas_img.save(rgb_buf, format="PNG")
                    sig_buf = BytesIO(rgb_buf.getvalue())
                except Exception:
                    sig_buf = BytesIO(png)
                width = min(3.2, max(1.6, 0.2 * max(len(name), 8))) * inch
                iw, ih = ImageReader(sig_buf).getSize()
                sig_buf.seek(0)
                height = width * (ih / max(iw, 1))
                right_flowable = Image(sig_buf, width=width, height=height)
            table = Table([[left, right_flowable]], colWidths=[3.0 * inch, 3.5 * inch])
            table.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ]
                )
            )
            story.append(table)
            continue
        style = {
            "heading": heading,
            "name": name_style,
            "field": field,
            "tight": tight,
            "closing": closing,
        }.get(variant, body)
        indent = int(block.get("indent") or 0)
        if indent:
            style = ParagraphStyle(
                f"Indented{variant}{indent}",
                parent=style,
                leftIndent=0.35 * inch * indent,
            )
        story.append(Paragraph(text_line, style))

    for stream in image_streams:
        data = stream.getvalue()
        width_in, height_in = _picture_size_inches(data)
        story.append(Spacer(1, 6))
        story.append(Image(BytesIO(data), width=width_in * inch, height=height_in * inch))
        story.append(Spacer(1, 4))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()


def letters_zip_bytes(letters: list[tuple[str, str]]) -> bytes:
    """Build a ZIP of print-ready .pdf files. Each item is (filename_stem, markdown)."""
    import zipfile

    buf = BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem, markdown in letters:
            safe = re.sub(r'[<>:"/\\|?*]', "-", (stem or "letter").strip())[:60] or "letter"
            name = safe
            n = 2
            while name.lower() in used:
                name = f"{safe} ({n})"
                n += 1
            used.add(name.lower())
            zf.writestr(f"{name}.pdf", letter_to_pdf(markdown))
    buf.seek(0)
    return buf.getvalue()
