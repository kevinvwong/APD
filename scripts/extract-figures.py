"""
Build a manifest mapping (fm_number, figure/table label) -> pdf page number,
then render each unique referenced page as a PNG to .tmp/figures/.

Heuristic for caption location: in Army FMs the front-matter "Figures" /
"Tables" list mentions each caption with a trailing page-number leader
("Figure 1-1. Operational categories .......... 2"). The actual figure
in the body has the caption WITHOUT the trailing dot leader / page number.

We keep only matches whose line does NOT end in a dotted-leader+number
(the in-body caption), and we take the LAST such occurrence per label
within a PDF (in case a figure is reprinted in an appendix).

Run: python scripts/extract-figures.py
"""

import fitz
import os
import re
import json
import sys
from pathlib import Path

PDF_DIR = Path(r"C:\Users\kwong318\GitHub\APD\fm-pdfs")
OUT_DIR = Path(r"C:\Users\kwong318\GitHub\APD\.tmp\figures")
DPI = 110

# A real caption: starts at line begin with "Figure N-N." or "Table N-N."
# and does NOT end with dot-leader+page-number (which marks a TOC entry).
CAPTION_LINE_RE = re.compile(
    r"^(Table|Figure)\s+([A-Za-z]?-?\d+(?:[.\-]\d+)*)\.\s+(.+)$",
    re.IGNORECASE,
)
LEADER_RE = re.compile(r"\.{4,}\s*[\diIvVxXlL\-]+\s*$")


def fm_number_from_pdf(path: Path) -> str:
    stem = path.stem
    m = re.search(r"FM[_\s]?(\d+[-\.]\d+(?:\.\d+)?)", stem, re.IGNORECASE)
    if m:
        return f"FM {m.group(1).replace('_', '-')}"
    m = re.search(r"fm(\d+)[_-](\d+)", stem, re.IGNORECASE)
    if m:
        return f"FM {m.group(1)}-{m.group(2)}"
    return stem


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Clear out old manifest entries; keep already-rendered PNGs to avoid re-render
    manifest = []
    seen_pages = set()  # (fm_number, page_no) already rendered

    pdfs = sorted(p for p in PDF_DIR.iterdir() if p.suffix.lower() == ".pdf")
    print(f"Scanning {len(pdfs)} PDFs for figure captions…")

    for pdf_idx, pdf_path in enumerate(pdfs, 1):
        fm_number = fm_number_from_pdf(pdf_path)
        doc = fitz.open(pdf_path)

        # Per-FM: track the LAST page each label was found on (as a real caption)
        label_to_page = {}  # { (kind, label_num): page_no }

        for page_no in range(len(doc)):
            text = doc[page_no].get_text()
            for line in text.split("\n"):
                line = line.strip()
                m = CAPTION_LINE_RE.match(line)
                if not m:
                    continue
                # Skip TOC entries
                if LEADER_RE.search(line):
                    continue
                kind = m.group(1).capitalize()
                label_num = m.group(2)
                # Take the LAST occurrence (in case of reprint)
                label_to_page[(kind, label_num)] = page_no

        # Build manifest entries from final mapping
        fm_pages = set()
        for (kind, label_num), page_no in label_to_page.items():
            manifest.append(
                {
                    "fm_number": fm_number,
                    "label": f"{kind} {label_num}",
                    "page": page_no + 1,
                    "file": f"{fm_number.replace(' ', '-').replace('.', '_')}-p{page_no + 1:04d}.png",
                    "kind": kind.lower(),
                }
            )
            fm_pages.add(page_no)

        # Render each unique page (idempotent)
        rendered = 0
        for page_no in sorted(fm_pages):
            key = (fm_number, page_no)
            seen_pages.add(key)
            out = OUT_DIR / f"{fm_number.replace(' ', '-').replace('.', '_')}-p{page_no + 1:04d}.png"
            if out.exists():
                rendered += 1
                continue
            pix = doc[page_no].get_pixmap(dpi=DPI)
            pix.save(str(out))
            rendered += 1

        print(
            f"  [{pdf_idx}/{len(pdfs)}] {fm_number}: "
            f"{len(label_to_page)} unique captions, {len(fm_pages)} pages, {rendered} rendered"
        )
        doc.close()

    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)

    # Now delete any old PNGs that no longer correspond to a current manifest entry
    current_files = {e["file"] for e in manifest}
    deleted = 0
    for png in OUT_DIR.glob("*.png"):
        if png.name not in current_files:
            png.unlink()
            deleted += 1

    total_size = sum(p.stat().st_size for p in OUT_DIR.glob("*.png"))
    pngs_now = len(list(OUT_DIR.glob("*.png")))
    sys.stdout.write(
        f"\nDone. {len(manifest)} caption->page entries, "
        f"{pngs_now} rendered pages, {total_size / 1_048_576:.1f} MB total. "
        f"Deleted {deleted} stale PNGs.\n"
    )


if __name__ == "__main__":
    main()
