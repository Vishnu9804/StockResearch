"""Standalone sanity checks for the pure, offline-testable parts of
services/ai_summary/ — quarter labeling and the scanned-PDF heuristic.

Not pytest (deliberately — this project's test story here is "cheap, fast,
plain-assert scripts", not a suite): run directly with `python
scripts/_verify_ai_summary_logic.py`. Exits non-zero on any failure.
"""
import os
import sys
from dataclasses import dataclass
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_summary.quarter import quarter_label, quarter_parts, select_current_quarter_documents, select_within_budget
from services.ai_summary.text_extraction import _looks_like_scanned
from agents.shared.adk_runner import is_permanent_client_error, is_quota_error, _should_retry

failures = []


def check(label, condition):
    status = "OK" if condition else "FAIL"
    print(f"[{status}] {label}")
    if not condition:
        failures.append(label)


# ── quarter_label: explicit title mention wins ──────────────────────────────
check("explicit Q2 FY26 in title", quarter_label("Transcript of Q2 FY26 earnings call", None) == "Q2 FY26")
check("explicit Q4-FY25 with dash", quarter_label("Board outcome Q4-FY25", None) == "Q4 FY25")

# ── quarter_label: filing-lag-aware month fallback ──────────────────────────
check("July filing -> Q1 (Apr-Jun results, filed with lag)", quarter_label(None, date(2026, 7, 15)) == "Q1 FY27")
check("October filing -> Q2 (Jul-Sep results)", quarter_label(None, date(2026, 10, 5)) == "Q2 FY27")
check("January filing -> Q3 (Oct-Dec results)", quarter_label(None, date(2026, 1, 20)) == "Q3 FY26")
check("May filing -> Q4 of PRIOR fy (Jan-Mar results)", quarter_label(None, date(2026, 5, 10)) == "Q4 FY26")
check("no title, no date -> fallback label", quarter_label(None, None) == "recent quarter")

# ── quarter_parts numeric mirror of quarter_label ────────────────────────────
check("quarter_parts matches quarter_label mapping", quarter_parts(date(2026, 10, 5)) == (2027, 2))

# ── select_current_quarter_documents groups by the newest anchor's label ────
@dataclass
class FakeDoc:
    title: str
    filed_date: date | None


docs = [
    FakeDoc("Q2 FY27 results press release", date(2026, 10, 5)),  # Jul-Sep 2026 results = Q2 of FY27 (Apr26-Mar27)
    FakeDoc("Investor presentation", date(2026, 10, 6)),   # same window, no explicit label -> falls back to month mapping, same as anchor
    FakeDoc("Concall transcript", date(2026, 10, 20)),      # newest -> anchor
    FakeDoc("Q1 FY27 results press release", date(2026, 7, 3)),  # PRIOR quarter -> must be excluded
    FakeDoc("Undated notice", None),                          # must be excluded (no date to reason from)
]
label, current = select_current_quarter_documents(docs)
check("anchor label is the newest document's quarter", label == "Q2 FY27")
check("current quarter set excludes the prior-quarter doc", len(current) == 3)
check("current quarter set excludes the undated doc", all(d.filed_date is not None for d in current))
check("current quarter set is newest-first", [d.filed_date for d in current] == sorted([d.filed_date for d in current], reverse=True))

check("empty input -> empty result, no crash", select_current_quarter_documents([]) == ("recent quarter", []))


# ── select_within_budget: never drop the real results, even under a tight
#    budget flooded with routine announcements (the actual RELIANCE Q1 FY27
#    failure this was written to catch) ──────────────────────────────────────
@dataclass
class FakeDoc2:
    title: str
    filed_date: date
    category: str


budget_docs = [
    FakeDoc2("Newspaper clippings - dematerialisation notice", date(2026, 8, 21), "announcement"),
    FakeDoc2("Voting results under Regulation 44(3)", date(2026, 8, 21), "announcement"),
    FakeDoc2("Postal Ballot Notice and related information", date(2026, 8, 18), "announcement"),
    FakeDoc2("Clarification on Supreme Court matter", date(2026, 8, 18), "announcement"),
    FakeDoc2("Media release: strategic partnership", date(2026, 8, 14), "announcement"),
    FakeDoc2("Newspaper clippings - special window", date(2026, 8, 7), "announcement"),
    FakeDoc2("Step-down subsidiary incorporation notice", date(2026, 8, 1), "announcement"),
    FakeDoc2("Postal Ballot Notice dated July 17, 2026", date(2026, 7, 21), "announcement"),
    FakeDoc2("Consolidated and Standalone unaudited financial results", date(2026, 7, 17), "announcement"),  # THE results filing
    FakeDoc2("Transcript of the discussion on the Unaudited Financial Results", date(2026, 7, 19), "concall"),
]
budget_docs.sort(key=lambda d: d.filed_date, reverse=True)  # select_within_budget expects newest-first input

kept = select_within_budget(budget_docs, max_docs=5)
kept_titles = {d.title for d in kept}
check("tight budget still keeps the concall", "Transcript of the discussion on the Unaudited Financial Results" in kept_titles)
check("tight budget still keeps the actual results announcement despite being older", "Consolidated and Standalone unaudited financial results" in kept_titles)
check("tight budget respects the cap", len(kept) == 5)

kept_generous = select_within_budget(budget_docs, max_docs=100)
check("generous budget keeps everything", len(kept_generous) == len(budget_docs))

# ── scanned-PDF heuristic ────────────────────────────────────────────────────
check("dense text-layer PDF is NOT flagged as scanned", not _looks_like_scanned("x" * 3000, 1))
check("near-empty text over many pages IS flagged as scanned", _looks_like_scanned("header only", 40))
check("zero pages is always flagged as scanned", _looks_like_scanned("", 0))

# ── shared retry logic: don't waste retries on permanent 4xx rejections ────
class FakeHttpError(Exception):
    def __init__(self, status_code):
        self.status_code = status_code


check("429 (quota) is recognised as a quota error", is_quota_error(FakeHttpError(429)))
check("429 is NOT treated as a permanent client error (still cooled-down + retried elsewhere)", not is_permanent_client_error(FakeHttpError(429)))
check("400 (content-safety rejection) is a permanent client error", is_permanent_client_error(FakeHttpError(400)))
check("404 is a permanent client error", is_permanent_client_error(FakeHttpError(404)))
check("500 is NOT a permanent client error (worth retrying)", not is_permanent_client_error(FakeHttpError(500)))
check("no status_code at all is NOT a permanent client error (worth retrying)", not is_permanent_client_error(Exception("network blip")))
check("_should_retry is False for 429", not _should_retry(FakeHttpError(429)))
check("_should_retry is False for 400", not _should_retry(FakeHttpError(400)))
check("_should_retry is True for a plain network error", _should_retry(Exception("timeout")))

print()
if failures:
    print(f"{len(failures)} check(s) FAILED: {failures}")
    sys.exit(1)
print("All checks passed.")
