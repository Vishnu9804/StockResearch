"""
services/ai_summary/quarter.py
Decides which of a company's documents belong to "the current quarter" —
deliberately NOT "today's calendar quarter". A company files its Q2 results
roughly 6-8 weeks AFTER Q2 ends (SEBI LODR), so for most of any given
calendar quarter a company has zero filings for that quarter yet and its
real "current" filings still describe the PREVIOUS one. Anchoring on the
company's own most recent filing date, instead of the wall clock, is what
keeps this correct all year round without ever showing "insufficient data"
for weeks at a stretch right after a quarter rolls over.

The month-to-quarter mapping below intentionally mirrors
services/rag/sources/transcript_source.py::_extract_quarter (same filing-lag
reasoning, same Apr-Mar Indian financial year) so a document's quarter label
means the same thing everywhere in this codebase — Research Chat citations
and this feature's quarter_label should never disagree about what "Q2 FY26"
means. Duplicated here rather than imported: this module has no other reason
to depend on the RAG package, and a small, pure, deterministic function is
cheaper to duplicate once than to risk coupling two independently-evolving
features together.
"""
import re
from datetime import date

_QUARTER_RE = re.compile(r"\bQ([1-4])\s*[-/ ]?\s*(?:FY)?\s*(\d{2,4})", re.IGNORECASE)

# Maps the MONTH A FILING WAS MADE to the quarter it actually reports on —
# not the calendar quarter that month falls in. E.g. a filing made in
# June/July/August is (almost always) reporting Q1 (Apr-Jun) results, filed
# 1-2 months after quarter-end.
_MONTH_TO_QUARTER = {
    4: 4, 5: 4,             # Apr/May filings report the PRIOR FY's Q4 (Jan-Mar)
    6: 1, 7: 1, 8: 1,       # Jun-Aug filings report Q1 (Apr-Jun)
    9: 2, 10: 2, 11: 2,     # Sep-Nov filings report Q2 (Jul-Sep)
    12: 3, 1: 3, 2: 3,      # Dec-Feb filings report Q3 (Oct-Dec)
    3: 4,                   # Mar filings report Q4 (Jan-Mar), filed early
}


def _fiscal_year_for(filed_date: date) -> int:
    """The FY a filing's reported quarter belongs to, labelled by the
    calendar year it ENDS in (FY26 = Apr 2025-Mar 2026 — this codebase's
    convention, see services/rag/sources/transcript_source.py).

    Deliberately NOT a flat "month >= 4 -> year+1": April/May filings report
    Q4 (Jan-Mar) of the FY that just ENDED, so they must resolve to the
    filing's OWN calendar year, not the next one. June onward, a filing is
    always reporting a quarter that falls inside the FY beginning that same
    April, so the +1 is correct from June onward. The single boundary at
    month 6 (not 4) is what makes both cases resolve correctly with one
    comparison instead of a special-cased exception for April/May."""
    return filed_date.year + 1 if filed_date.month >= 6 else filed_date.year


def quarter_label(title: str | None, filed_date: date | None) -> str:
    """A human-readable "Q2 FY26" label — checks the title text first (some
    filings say it outright), falls back to the filing-lag-aware month
    mapping above. Returns "recent quarter" only when there's no date at all
    to reason from."""
    match = _QUARTER_RE.search(title or "")
    if match:
        quarter, year = match.group(1), match.group(2)
        return f"Q{quarter} FY{year[-2:]}"
    if filed_date:
        quarter = _MONTH_TO_QUARTER.get(filed_date.month, 1)
        fiscal_year = _fiscal_year_for(filed_date)
        return f"Q{quarter} FY{str(fiscal_year)[2:]}"
    return "recent quarter"


def quarter_parts(filed_date: date) -> tuple[int, int]:
    """(fiscal_year, quarter_number) for company_ai_summaries' typed columns
    — same mapping as quarter_label, just returned as numbers instead of a
    formatted string."""
    quarter = _MONTH_TO_QUARTER.get(filed_date.month, 1)
    return _fiscal_year_for(filed_date), quarter


def select_current_quarter_documents(documents: list) -> tuple[str, list]:
    """Given ALL of a symbol's announcement/concall/presentation documents
    (any order), returns (quarter_label, the subset that belongs to the most
    recent quarter) — "most recent" meaning the quarter of the single newest
    filed_date among them, grouping every other document that maps to that
    SAME label alongside it.

    `documents` items only need `.title` and `.filed_date` attributes (works
    against the CompanyDocument ORM model or any duck-typed equivalent, which
    is what makes this function trivially unit-testable without a database).
    Documents with no filed_date at all are excluded — there's no reliable
    way to know which quarter an undated filing belongs to, and silently
    guessing "the current one" risks pulling in a stale one.
    """
    dated = [d for d in documents if d.filed_date is not None]
    if not dated:
        return "recent quarter", []

    anchor = max(dated, key=lambda d: d.filed_date)
    anchor_label = quarter_label(anchor.title, anchor.filed_date)

    current = [d for d in dated if quarter_label(d.title, d.filed_date) == anchor_label]
    # Newest-first — the order the synthesis prompt and the UI both present
    # documents in.
    current.sort(key=lambda d: d.filed_date, reverse=True)
    return anchor_label, current


# Titles that mark an 'announcement' filing as the actual results/board
# outcome — as opposed to the routine administrative filings (newspaper
# clippings, subsidiary notices, postal ballots, ...) an active large-cap can
# file dozens of in a single quarter. Verified against real title text: NSE
# filings consistently use one of these phrases for the filing that actually
# carries the quarter's results.
_HIGH_SIGNAL_KEYWORDS = (
    "financial result", "quarterly result", "unaudited", "audited",
    "outcome of the board", "board meeting", "press release",
)


def _is_high_signal_announcement(title: str | None) -> bool:
    text = (title or "").lower()
    return any(keyword in text for keyword in _HIGH_SIGNAL_KEYWORDS)


def select_within_budget(current_quarter_docs: list, max_docs: int) -> list:
    """Applies a per-company document budget to an already-selected
    current-quarter set (the output of select_current_quarter_documents,
    which is newest-first) WITHOUT silently dropping the quarter's actual
    results content.

    A flat "keep the newest N" cap is the wrong rule here: verified live
    against RELIANCE's real Q1 FY27 filings, where a busy quarter's flood of
    August newspaper clippings and postal ballot notices pushed the July 17
    results announcement itself out of a 15-document newest-first cap, even
    though the concall discussing those exact results was kept. This fixes
    exactly that failure mode:

      - concall and presentation documents are NEVER dropped by the budget —
        they're inherently rare (a handful per quarter at most) and always
        high-value, so capping them buys no real cost saving.
      - only 'announcement' is trimmed, and even then, announcements whose
        title marks them as results/board-outcome related are kept ahead of
        routine ones regardless of date, before the remaining budget is
        filled newest-first with whatever's left.
    """
    priority_docs = [d for d in current_quarter_docs if d.category in ("concall", "presentation")]
    announcements = [d for d in current_quarter_docs if d.category == "announcement"]

    remaining_budget = max(max_docs - len(priority_docs), 0)
    # Stable sort: high-signal announcements first, each group staying
    # newest-first internally since current_quarter_docs arrives newest-first.
    announcements_ranked = sorted(
        announcements, key=lambda d: 0 if _is_high_signal_announcement(d.title) else 1
    )
    kept = priority_docs + announcements_ranked[:remaining_budget]
    kept.sort(key=lambda d: d.filed_date, reverse=True)
    return kept
