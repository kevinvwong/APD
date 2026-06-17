"""
Convert a book PDF to Markdown for the reference corpus (books/<id>.md).

The repo's pdf_to_md.py is hardcoded to the FM pipeline (fm-pdfs/ -> fm-md/);
this wrapper reuses its font-size heading extraction but takes an explicit input
PDF and writes one book Markdown file. Heading-by-font-size is what makes these
textbook PDFs ingest cleanly — a flat OCR text dump (e.g. archive.org *_djvu.txt)
does NOT preserve structure and must not be used.

Requires PyMuPDF:  pip install pymupdf

Usage:
  python scripts/book-pdf-to-md.py <input.pdf> [<book-id>]
    # <book-id> defaults to the input filename stem; output is books/<book-id>.md
  python scripts/book-pdf-to-md.py .tmp/book-pdfs/openstax-organizational-behavior.pdf

Then:
  npm run books:ingest-all -- --no-fetch --only <book-id>
  npm run search:index

IMPORTANT: eyeball the converted structure before ingesting — `grep "^#"` the
head AND tail of books/<id>.md. A clean word count can still hide an OCR blob.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from pdf_to_md import pdf_to_markdown  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"ERROR: no such file: {pdf_path}")
        sys.exit(1)
    book_id = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(os.path.basename(pdf_path))[0]

    out_dir = os.path.join(ROOT, "books")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, book_id + ".md")

    print(f"Converting {pdf_path} -> {out_path} ...", flush=True)
    md = pdf_to_markdown(pdf_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(md)

    heads = sum(1 for ln in md.splitlines() if ln.startswith("#"))
    words = len(md.split())
    print(f"  {len(md):,} chars, {words:,} words, {heads} headings")
    print("  Now spot-check structure:  grep \"^#\" books/%s.md  (head AND tail)" % book_id)


if __name__ == "__main__":
    main()
