"""
Convert all FM PDFs in fm-pdfs/ to Markdown in fm-md/.
Uses PyMuPDF (fitz) for text extraction, preserving headings and structure.
Skips files already converted (resume-friendly).
"""

import os
import re
import fitz  # PyMuPDF

PDF_DIR = r"C:\Users\kwong318\GitHub\APD\fm-pdfs"
MD_DIR  = r"C:\Users\kwong318\GitHub\APD\fm-md"


def size_to_heading(size, body_size):
    """Map font size to markdown heading level relative to body text."""
    ratio = size / body_size
    if ratio >= 1.8:
        return 1
    if ratio >= 1.4:
        return 2
    if ratio >= 1.15:
        return 3
    return 0  # body text


def detect_body_size(doc):
    """Find the most common font size across first 10 pages — that's body text."""
    from collections import Counter
    sizes = Counter()
    for page in doc[:10]:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    s = round(span["size"])
                    if s > 5:
                        sizes[s] += len(span["text"].strip())
    return sizes.most_common(1)[0][0] if sizes else 10


def spans_to_text(line_spans):
    """Merge spans in a line, preserving bold as **text**."""
    parts = []
    for span in line_spans:
        text = span["text"]
        if not text.strip():
            parts.append(text)
            continue
        is_bold = "Bold" in span.get("font", "") or span.get("flags", 0) & 2**4
        if is_bold and text.strip():
            text = f"**{text.strip()}**"
        parts.append(text)
    return "".join(parts).strip()


def block_to_md(block, body_size):
    """Convert a text block to markdown lines."""
    if block["type"] != 0:
        return []

    lines_out = []
    for line in block["lines"]:
        spans = line["spans"]
        if not spans:
            continue

        line_text = spans_to_text(spans)
        if not line_text:
            continue

        # Use max font size in line to decide heading level
        max_size = max(round(s["size"]) for s in spans)
        level = size_to_heading(max_size, body_size)

        # Strip bold markers from headings (redundant)
        clean = re.sub(r"\*\*(.*?)\*\*", r"\1", line_text).strip()
        if not clean:
            continue

        if level == 1:
            lines_out.append(f"# {clean}")
        elif level == 2:
            lines_out.append(f"## {clean}")
        elif level == 3:
            lines_out.append(f"### {clean}")
        else:
            lines_out.append(line_text)

    return lines_out


def pdf_to_markdown(pdf_path):
    doc = fitz.open(pdf_path)
    body_size = detect_body_size(doc)

    md_lines = []
    prev_was_heading = False

    for page_num, page in enumerate(doc, 1):
        blocks = page.get_text("dict", sort=True)["blocks"]
        page_lines = []

        for block in blocks:
            block_lines = block_to_md(block, body_size)
            page_lines.extend(block_lines)

        # Collapse runs of blank lines, add spacing around headings
        for line in page_lines:
            is_heading = line.startswith("#")
            if is_heading and md_lines and md_lines[-1] != "":
                md_lines.append("")
            md_lines.append(line)
            if is_heading:
                md_lines.append("")
            prev_was_heading = is_heading

    # Collapse 3+ consecutive blank lines to 2
    result = []
    blank_count = 0
    for line in md_lines:
        if line == "":
            blank_count += 1
            if blank_count <= 2:
                result.append(line)
        else:
            blank_count = 0
            result.append(line)

    return "\n".join(result).strip() + "\n"


def main():
    os.makedirs(MD_DIR, exist_ok=True)

    pdf_files = sorted(f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf"))
    total = len(pdf_files)
    converted = 0
    skipped = 0
    failed = []

    for i, fname in enumerate(pdf_files, 1):
        stem = os.path.splitext(fname)[0]
        md_fname = stem + ".md"
        pdf_path = os.path.join(PDF_DIR, fname)
        md_path  = os.path.join(MD_DIR, md_fname)

        if os.path.exists(md_path):
            size = os.path.getsize(md_path)
            print(f"[{i}/{total}] SKIP  {fname} (already converted, {size:,} bytes)")
            skipped += 1
            continue

        print(f"[{i}/{total}] CONV  {fname}", end=" ... ", flush=True)
        try:
            md = pdf_to_markdown(pdf_path)
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md)
            print(f"{len(md):,} chars -> {md_fname}")
            converted += 1
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append((fname, str(e)))

    print(f"\nDone. Converted: {converted}  Skipped: {skipped}  Failed: {len(failed)}")
    if failed:
        print("\nFailed:")
        for fname, reason in failed:
            print(f"  {fname}: {reason}")


if __name__ == "__main__":
    main()
