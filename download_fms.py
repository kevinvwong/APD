"""
Download all active Army Field Manuals from armypubs.army.mil.
Resumes automatically if re-run (skips already-downloaded files).
Rate-limited to 1.5s between requests to be polite to the server.
"""

import os
import time
import ssl
import urllib.request
import urllib.error
import urllib.parse
import re
from html.parser import HTMLParser

# Some older Army Pubs pages have SSL cert chain issues — use unverified context as fallback
SSL_UNVERIFIED = ssl.create_default_context()
SSL_UNVERIFIED.check_hostname = False
SSL_UNVERIFIED.verify_mode = ssl.CERT_NONE

OUTPUT_DIR = r"C:\Users\kwong318\GitHub\APD\fm-pdfs"
BASE_URL = "https://armypubs.army.mil"
DETAIL_BASE = f"{BASE_URL}/ProductMaps/PubForm/Details.aspx?PUB_ID="
DELAY = 1.5  # seconds between requests

PUB_IDS = [
    1031029, 1033152, 1030416, 1027606, 82535, 1030750, 1031761, 1006887,
    1025245, 1030760, 1031320, 80499, 1033154, 1029519, 1030863, 1031926,
    1001357, 1006341, 1032626, 1029351, 71217, 1027234, 83748, 1027431,
    1032275, 1030912, 104608, 1001056, 102534, 1022687, 1027457, 1024540,
    1032675, 1024108, 1030862, 1027548, 1026901, 1022633, 1021533, 1026266,
    105021, 1032715, 1031876, 1021296, 1030905, 1030075, 1024909, 1007816,
    1024321, 1025933, 1007504, 1022172, 1022335, 1020968, 82016, 31222,
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


class PDFLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pdf_links = []        # all .pdf hrefs
        self.epubs_links = []      # only epubs/DR_pubs links (the FM itself)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attrs_dict = dict(attrs)
            href = attrs_dict.get("href", "")
            if href.lower().endswith(".pdf"):
                self.pdf_links.append(href)
                # FM PDFs live under epubs/DR_pubs
                if "epubs/dr_pubs" in href.lower() or "epubs/DR_pubs" in href:
                    self.epubs_links.append(href)


def _is_ssl_error(e):
    return isinstance(e, ssl.SSLError) or (
        isinstance(e, urllib.error.URLError)
        and "SSL" in str(e.reason)
    )


def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        if _is_ssl_error(e):
            with urllib.request.urlopen(req, timeout=30, context=SSL_UNVERIFIED) as resp:
                return resp.read().decode("utf-8", errors="replace")
        raise


def resolve_pdf_url(relative_href):
    """Turn relative ../../epubs/... paths into absolute URLs, with spaces encoded."""
    if relative_href.startswith("http"):
        # Encode spaces in the path portion only
        parsed = urllib.parse.urlsplit(relative_href)
        encoded_path = urllib.parse.quote(parsed.path, safe="/%")
        return urllib.parse.urlunsplit(parsed._replace(path=encoded_path))
    # Strip leading ../../ and join with base
    clean = relative_href.lstrip("./").replace("\\", "/")
    # Remove any remaining ../ sequences by normalising
    parts = []
    for part in clean.split("/"):
        if part == "..":
            if parts:
                parts.pop()
        elif part and part != ".":
            parts.append(part)
    path = "/" + "/".join(parts)
    encoded_path = urllib.parse.quote(path, safe="/%")
    return f"{BASE_URL}{encoded_path}"


def get_pdf_url_for_pub(pub_id):
    url = f"{DETAIL_BASE}{pub_id}"
    try:
        html = fetch_html(url)
    except Exception as e:
        print(f"  [ERROR] Could not fetch detail page for PUB_ID {pub_id}: {e}")
        return None, None

    parser = PDFLinkParser()
    parser.feed(html)

    # Prefer the epubs/DR_pubs link (the actual FM PDF) over footer/banner links
    preferred = parser.epubs_links or parser.pdf_links
    if not preferred:
        print(f"  [SKIP] No PDF link found for PUB_ID {pub_id}")
        return None, None

    href = preferred[0]
    pdf_url = resolve_pdf_url(href)
    filename = os.path.basename(href.split("?")[0])
    return pdf_url, filename


def download_pdf(pdf_url, dest_path):
    req = urllib.request.Request(pdf_url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
    except Exception as e:
        if _is_ssl_error(e):
            with urllib.request.urlopen(req, timeout=120, context=SSL_UNVERIFIED) as resp:
                data = resp.read()
        else:
            raise
    with open(dest_path, "wb") as f:
        f.write(data)
    return len(data)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(PUB_IDS)
    downloaded = 0
    skipped = 0
    failed = []

    for i, pub_id in enumerate(PUB_IDS, 1):
        print(f"[{i}/{total}] PUB_ID {pub_id} — fetching detail page...")

        pdf_url, filename = get_pdf_url_for_pub(pub_id)
        time.sleep(DELAY)

        if not pdf_url or not filename:
            failed.append((pub_id, "no PDF link on detail page"))
            continue

        dest_path = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(dest_path):
            size = os.path.getsize(dest_path)
            print(f"  [SKIP] Already exists: {filename} ({size:,} bytes)")
            skipped += 1
            continue

        print(f"  [DOWN] {filename}")
        print(f"         {pdf_url}")
        try:
            size = download_pdf(pdf_url, dest_path)
            print(f"         Saved {size:,} bytes -> {dest_path}")
            downloaded += 1
        except urllib.error.HTTPError as e:
            print(f"  [FAIL] HTTP {e.code} for {pdf_url}")
            failed.append((pub_id, f"HTTP {e.code}"))
        except Exception as e:
            print(f"  [FAIL] {e}")
            failed.append((pub_id, str(e)))

        time.sleep(DELAY)

    print("\n" + "=" * 60)
    print(f"Done. Downloaded: {downloaded}  Skipped: {skipped}  Failed: {len(failed)}")
    if failed:
        print("\nFailed downloads:")
        for pub_id, reason in failed:
            print(f"  PUB_ID {pub_id}: {reason}")


if __name__ == "__main__":
    main()
