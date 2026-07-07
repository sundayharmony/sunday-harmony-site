from __future__ import annotations

import html
import re


def normalize_letter_source(text: str) -> str:
    """Clean agent output while preserving controlled **bold** markup."""
    text = text.strip()
    text = re.sub(r"```[\w]*\n?", "", text)
    text = text.replace("```", "")
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
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
    text = re.sub(r"^\s{1,3}[-*+]\s+", "- ", text, flags=re.MULTILINE)
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


def _is_section_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or any(c.isdigit() for c in stripped):
        return False
    if "**" in stripped:
        return False
    return stripped.isupper() and len(stripped) < 45


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


def letter_to_html(text: str) -> str:
    body = normalize_letter_source(text)
    blocks: list[str] = []
    for line in body.splitlines():
        if not line.strip():
            blocks.append("<p class=\"letter-spacer\">&nbsp;</p>")
            continue
        indent = _indent_level(line)
        display = _line_display(line)
        inner = _inline_html(display)
        classes = ["letter-line"]
        if indent:
            classes.append(f"letter-indent-{indent}")
        if _is_section_heading(display):
            classes.append("letter-heading")
        blocks.append(f'<p class="{" ".join(classes)}">{inner}</p>')
    return "\n".join(blocks)


def _add_rich_paragraph(document, line: str, *, indent_level: int = 0, heading: bool = False):
    from docx.shared import Inches, Pt

    para = document.add_paragraph()
    para.paragraph_format.space_after = Pt(6)
    if indent_level:
        para.paragraph_format.left_indent = Inches(0.35 * indent_level)

    parts = re.split(r"(\*\*.+?\*\*)", line)
    for i, part in enumerate(parts):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = para.add_run(part[2:-2])
            run.bold = True
        else:
            run = para.add_run(part)
            if heading:
                run.bold = True


def letter_to_docx(text: str):
    from docx import Document
    from docx.shared import Pt

    body = normalize_letter_source(text)
    document = Document()
    style = document.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)

    for line in body.splitlines():
        if not line.strip():
            document.add_paragraph("")
            continue
        display = _line_display(line)
        _add_rich_paragraph(
            document,
            display,
            indent_level=_indent_level(line),
            heading=_is_section_heading(display),
        )

    return document
