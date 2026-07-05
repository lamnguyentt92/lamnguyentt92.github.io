#!/usr/bin/env python3
"""
Update publication venue rankings for the GitHub Pages site.

Sources used by default:
  * Conference rankings: CORE/ICORE export endpoint, when reachable.
  * Journal quartiles: SCImago direct journal pages, when reachable.
  * Manual seed/override: data/rankings.json remains the fallback.

Notes:
  * CORE/ICORE normally uses A*, A, B, C, not D. This script maps missing or
    unranked conference venues to "D / Unranked" only for website display.
  * SCImago does not provide a stable public API. Direct page parsing is best-effort.
    For production reliability, set SCIMAGO_CSV_PATH or SCIMAGO_CSV_URL to a CSV/XLSX
    downloaded from SCImago and adapt parse_scimago_csv() if your file headers differ.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

try:
    import requests
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: requests. Run `pip install -r requirements.txt`.") from exc

try:
    from bs4 import BeautifulSoup
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: beautifulsoup4. Run `pip install -r requirements.txt`.") from exc

try:
    from rapidfuzz import fuzz
except Exception:  # pragma: no cover
    fuzz = None

CORE_EXPORT_URL = "https://portal.core.edu.au/conf-ranks/?by=all&do=Export&page=1&search=&sort=arank&source=all"
CORE_SOURCE_PRIORITY = ["ICORE2026", "CORE2023", "CORE2021", "CORE2020", "CORE2018", "CORE2017", "CORE2014", "CORE2013", "ERA2010"]

VENUE_LOOKUP = {
    "wisec": {
        "type": "conference",
        "queries": ["WiSec", "ACM Conference on Security and Privacy in Wireless and Mobile Networks"],
        "source_url": "https://portal.core.edu.au/conf-ranks/2313/",
    },
    "wimob": {
        "type": "conference",
        "queries": ["WiMob", "Wireless and Mobile Computing, Networking and Communications"],
        "source_url": "https://portal.core.edu.au/conf-ranks/679/",
    },
    "aiccsa": {
        "type": "conference",
        "queries": ["AICCSA", "Computer Systems and Applications"],
        "source_url": "https://portal.core.edu.au/conf-ranks/86/",
    },
    "iccsa": {
        "type": "conference",
        "queries": ["ICCSA", "Computational Science and its Applications"],
        "source_url": "https://portal.core.edu.au/conf-ranks/953/",
    },
    "tdsc": {
        "type": "journal",
        "scimago_id": "28918",
        "scimago_title": "IEEE Transactions on Dependable and Secure Computing",
        "source_url": "https://www.scimagojr.com/journalsearch.php?q=28918&tip=sid",
    },
    "pmc": {
        "type": "journal",
        "scimago_id": "3200147819",
        "scimago_title": "Pervasive and Mobile Computing",
        "source_url": "https://www.scimagojr.com/journalsearch.php?q=3200147819&tip=sid",
    },
    "peerj-cs": {
        "type": "journal",
        "scimago_id": "21100830173",
        "scimago_title": "PeerJ Computer Science",
        "source_url": "https://www.scimagojr.com/journalsearch.php?q=21100830173&tip=sid",
    },
}


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def score_match(query: str, *fields: str) -> float:
    q = normalize(query)
    haystack = " ".join(normalize(f) for f in fields if f)
    if not q or not haystack:
        return 0.0
    if q in haystack:
        return 100.0
    if fuzz:
        return float(fuzz.partial_ratio(q, haystack))
    # Small stdlib fallback.
    import difflib
    return difflib.SequenceMatcher(None, q, haystack).ratio() * 100


def source_priority(source: str) -> int:
    try:
        return CORE_SOURCE_PRIORITY.index(source)
    except ValueError:
        return len(CORE_SOURCE_PRIORITY) + 1


def fetch_text(url: str, timeout: int = 30) -> str:
    headers = {
        "User-Agent": "LamNguyenGitHubPagesRankUpdater/1.0 (+https://github.com/lamnguyentt92)"
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def read_existing_rankings(path: Path) -> Dict[str, Any]:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"rankings": {}}


def load_site_publications(path: Path) -> Dict[str, Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    pubs = data.get("publications", [])
    return {pub.get("venue_key", pub.get("id")): pub for pub in pubs}


def parse_core_export(text: str) -> list[Dict[str, str]]:
    """Parse CORE export; tolerate CSV columns changing names/order."""
    if "<html" in text[:200].lower():
        # The portal sometimes returns HTML when export is blocked.
        return []
    rows = []
    sample = text[:2048]
    dialect = csv.Sniffer().sniff(sample) if "," in sample else csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    for row in reader:
        normalized = {normalize(k).replace(" ", "_"): (v or "").strip() for k, v in row.items() if k}
        rows.append({
            "id": normalized.get("id", normalized.get("rank_id", "")),
            "title": normalized.get("title", normalized.get("conference", normalized.get("name", ""))),
            "acronym": normalized.get("acronym", ""),
            "source": normalized.get("source", ""),
            "rank": normalized.get("rank", ""),
            "for": normalized.get("primary_for", normalized.get("field_of_research", "")),
        })
    return rows


def find_core_rank(rows: Iterable[Dict[str, str]], queries: Iterable[str]) -> Optional[Dict[str, str]]:
    candidates = []
    for row in rows:
        rank = (row.get("rank") or "").strip()
        if not rank:
            continue
        best_score = max(score_match(q, row.get("title", ""), row.get("acronym", "")) for q in queries)
        if best_score >= 88:
            candidates.append((best_score, source_priority(row.get("source", "")), row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][2]


def extract_quartile_from_scimago_html(html: str) -> Optional[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    # Search snippets commonly include "SJR 2025 1.758 Q1"; pages may include similar text.
    match = re.search(r"SJR\s*(20\d{2})\s*[0-9.]+\s*(Q[1-4])", text, re.IGNORECASE)
    if match:
        return {"rank_year": match.group(1), "rank": match.group(2).upper()}
    # Fallback: choose the first quartile-like text near "best quartile".
    match = re.search(r"(?:best\s+quartile|quartile).*?\b(Q[1-4])\b", text, re.IGNORECASE)
    if match:
        return {"rank_year": "latest available", "rank": match.group(1).upper()}
    match = re.search(r"\b(Q[1-4])\b", text)
    if match:
        return {"rank_year": "latest available", "rank": match.group(1).upper()}
    return None


def update_from_scimago_page(scimago_id: str) -> Optional[Dict[str, str]]:
    url = f"https://www.scimagojr.com/journalsearch.php?q={scimago_id}&tip=sid"
    try:
        html = fetch_text(url)
    except Exception as exc:
        print(f"[warn] Could not fetch SCImago page {url}: {exc}", file=sys.stderr)
        return None
    result = extract_quartile_from_scimago_html(html)
    if result:
        result["source_url"] = url
    return result


def update_conference_ranks(current: Dict[str, Any]) -> None:
    try:
        rows = parse_core_export(fetch_text(CORE_EXPORT_URL))
    except Exception as exc:
        print(f"[warn] Could not fetch CORE export: {exc}", file=sys.stderr)
        rows = []

    for key, spec in VENUE_LOOKUP.items():
        if spec.get("type") != "conference":
            continue
        existing = current.setdefault(key, {})
        match = find_core_rank(rows, spec.get("queries", [])) if rows else None
        if match:
            existing.update({
                "venue": match.get("title") or existing.get("venue") or spec["queries"][-1],
                "type": "conference",
                "rank": match.get("rank") or "D / Unranked",
                "rank_system": "CORE/ICORE",
                "rank_year": match.get("source") or "latest available",
                "source_url": spec.get("source_url", existing.get("source_url", "")),
            })
        else:
            existing.setdefault("venue", spec["queries"][-1])
            existing.setdefault("type", "conference")
            existing.setdefault("rank", "D / Unranked")
            existing.setdefault("rank_system", "CORE/ICORE")
            existing.setdefault("rank_year", "not found")
            existing.setdefault("source_url", spec.get("source_url", ""))


def update_journal_ranks(current: Dict[str, Any]) -> None:
    for key, spec in VENUE_LOOKUP.items():
        if spec.get("type") != "journal":
            continue
        existing = current.setdefault(key, {})
        result = update_from_scimago_page(spec["scimago_id"])
        if result:
            existing.update({
                "venue": spec.get("scimago_title", existing.get("venue", key)),
                "type": "journal",
                "rank": result["rank"],
                "rank_system": "SCImago SJR",
                "rank_year": result.get("rank_year", "latest available"),
                "source_url": result.get("source_url", spec.get("source_url", "")),
            })
        else:
            existing.setdefault("venue", spec.get("scimago_title", key))
            existing.setdefault("type", "journal")
            existing.setdefault("rank", "N/A")
            existing.setdefault("rank_system", "SCImago SJR")
            existing.setdefault("rank_year", "not found")
            existing.setdefault("source_url", spec.get("source_url", ""))


def ensure_na_for_other_venues(current: Dict[str, Any], publications: Dict[str, Dict[str, Any]]) -> None:
    for key, pub in publications.items():
        if key not in current:
            current[key] = {
                "venue": pub.get("venue", key),
                "type": pub.get("type", "unknown"),
                "rank": "N/A",
                "rank_system": "N/A",
                "rank_year": "N/A",
                "source_url": "",
                "note": "No supported ranking source for this publication type."
            }


def main() -> int:
    parser = argparse.ArgumentParser(description="Update venue rankings for Lam Nguyen's GitHub Pages website.")
    parser.add_argument("--data", default="data/site-data.json", help="Path to site-data.json")
    parser.add_argument("--out", default="data/rankings.json", help="Path to output rankings.json")
    args = parser.parse_args()

    data_path = Path(args.data)
    out_path = Path(args.out)
    existing = read_existing_rankings(out_path)
    rankings = dict(existing.get("rankings", {}))
    publications = load_site_publications(data_path)

    update_conference_ranks(rankings)
    update_journal_ranks(rankings)
    ensure_na_for_other_venues(rankings, publications)

    output = {
        "last_updated": date.today().isoformat(),
        "method": "Automated best-effort refresh from CORE/ICORE and SCImago, with previous data as fallback.",
        "rankings": rankings,
    }
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} with {len(rankings)} ranking records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
