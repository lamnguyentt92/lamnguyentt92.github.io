#!/usr/bin/env python3
"""
Optional Google Scholar metadata updater using SerpAPI.

Directly scraping Google Scholar is fragile and often blocked. This script uses the
SerpAPI Google Scholar Author endpoint when SERPAPI_API_KEY is configured.
It writes data/scholar.json; the website can be extended to display citation counts.

Usage:
  export SERPAPI_API_KEY=...
  python scripts/update_scholar_serpapi.py --author-id Yt6EcJYAAAAJ --out data/scholar.json
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

import requests


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--author-id", default="Yt6EcJYAAAAJ")
    parser.add_argument("--out", default="data/scholar.json")
    args = parser.parse_args()

    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise SystemExit("SERPAPI_API_KEY is not set. Create a repository secret before running this in GitHub Actions.")

    params = {
        "engine": "google_scholar_author",
        "author_id": args.author_id,
        "api_key": api_key,
        "num": 100,
    }
    response = requests.get("https://serpapi.com/search.json", params=params, timeout=60)
    response.raise_for_status()
    raw = response.json()

    data = {
        "last_updated": date.today().isoformat(),
        "author_id": args.author_id,
        "name": raw.get("author", {}).get("name"),
        "affiliations": raw.get("author", {}).get("affiliations"),
        "cited_by": raw.get("cited_by", {}).get("table", []),
        "articles": raw.get("articles", []),
        "source": "SerpAPI Google Scholar Author API"
    }
    Path(args.out).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
