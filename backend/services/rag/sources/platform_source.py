"""services/rag/sources/platform_source.py
"How do I do X in FinScreen?" — the only corpus in this package that is
hand-written rather than derived from a table.

It has to be hand-written. Nothing in the database knows that the Custom Ratios
page lives at /custom-ratios, that the formula editor validates against the
Screener's variable catalog, or that Ctrl+K opens the command palette. Those
facts live in the frontend's routes and components, and a user asking "where do
I build a custom ratio" needs the click path, not a company fundamental.

Each topic is ONE document and ONE chunk. A help topic is a complete procedure;
retrieving step 4 without steps 1-3 would be worse than not retrieving it. They
are also short enough that this is free.

MAINTENANCE: these steps mirror real routes in frontend/src/App.tsx and real
labels in frontend/src/components/layout/Sidebar.tsx. When a route or a button
label changes, change it here too — the topic's content hash moves and the next
index cycle re-embeds it automatically, so the only manual step is editing the
text. A stale entry here is worse than a missing one: it sends users to a page
that no longer exists, confidently.
"""
from datetime import datetime, timezone

from services.rag.schemas import RagSourceDocument, SourceType

# (key, title, body). `key` is the stable source_key — renaming a topic's title
# is fine, changing its key orphans the old document until the cleanup pass.
HELP_TOPICS: list[tuple[str, str, str]] = [
    (
        "custom-ratios",
        "How to create a custom ratio or formula in FinScreen",
        """FinScreen lets you build your own financial ratio out of the same variables the Stock Screener uses, and then see it calculated live for any company.

Exact steps to create a custom ratio:
1. In the left sidebar, click "Custom Ratios". (Direct link: the /custom-ratios page.)
2. Give the ratio a name in the Name field, for example "Graham Number" or "My Quality Score".
3. Type the formula in the Formula field. You build it from variable names such as eps, book_value, pe, pb, roe, roce, debt_to_equity, market_cap, current_ratio. Arithmetic works the way you expect: + - * / and brackets. Example: (eps * book_value * 22.5) ^ 0.5, or roce / debt_to_equity.
4. Optionally add a short description so you remember what the ratio is for.
5. Use the Calculated Preview panel on the right to test it. Enter a stock symbol and FinScreen evaluates your formula against that company's live data and shows the Live Result, plus which variables it resolved and which ones were missing.
6. Click Save. The ratio now appears in your Custom Ratios table, where you can edit or delete it later.

If the preview shows missing variables, that means FinEdge does not currently publish that field for that company — try a different variable or a different symbol.

Related: to pin extra standard (non-custom) ratios onto every company page, open any company page and use the "Add Ratio" button in the extra-ratios section; those preferences are saved to your account and apply to every company you view.""",
    ),
    (
        "run-a-query",
        "How to run a query or search filter over corporate announcements",
        """FinScreen has a query/search-filter tool for corporate announcements, so you can ask things like "show me every capacity expansion announcement" and keep that filter saved.

Exact steps to run a query:
1. In the left sidebar, click "Market Pulse".
2. Open the "Announcements" section.
3. Click into the search filter / query builder (the Search Filter page, at /market-pulse/queries/new).
4. Type what you are looking for in plain words, for example "Mergers and de-mergers", "Capacity expansion", "Resignations", "Warnings / downgrades", "Approvals and awards", "Concalls or presentations", "Buyback / dividend", or "Climate / sustainability". Those examples are shown on the page and can be clicked directly.
5. Tick "save this filter" if you want to keep it, then press Run (the play button) or hit Enter.
6. You land on the results page (/market-pulse/queries/results) showing matching announcements. From there you can edit the query and re-run it.

Saved filters are stored on your account when you are logged in, so they follow you between devices. If you are logged out they are kept in the browser only.""",
    ),
    (
        "stock-screener",
        "How to use the Stock Screener to find stocks matching your conditions",
        """The Stock Screener filters the whole listed universe on fundamentals.

Exact steps:
1. In the left sidebar, click "Stock Screener" (the /screener page).
2. Add conditions using the query builder — pick a variable (for example P/E, ROE, market capitalisation, debt to equity, sales growth), pick an operator, and type a value.
3. Add as many conditions as you need; they are combined together.
4. The variables sidebar on the page lists every field you can filter on, grouped by category, so you can browse rather than remember names.
5. Click Run / Search. Results open on the screener results page (/screener/results) as a sortable table.
6. Click any row to open that company's full page.

If you want a starting point instead of building from scratch, click "Screen Gallery" in the sidebar (/screens) — it holds ready-made screens you can open and then adjust.

Note: the screener filters against FinScreen's own synced copy of company fundamentals, which is refreshed from FinEdge in the background, so results reflect the last sync rather than tick-by-tick live prices.""",
    ),
    (
        "watchlists",
        "How to create a watchlist and set price alerts",
        """Exact steps:
1. In the left sidebar, click "My Watchlists" (the /watchlists page).
2. Click "Create Watchlist" and give it a name.
3. Add companies to it by symbol.
4. For any item in the list you can set a target price and switch the Alert toggle on, so you are notified when the stock reaches it.
5. You can keep several watchlists side by side — for example one for tracking and one for research candidates.

You need to be logged in for a watchlist to be saved to your account.""",
    ),
    (
        "portfolio",
        "How to add or import your portfolio holdings",
        """Exact steps:
1. In the left sidebar, click "My Portfolio" (the /portfolio page). You must be logged in — the item is locked otherwise.
2. Add holdings with the symbol, quantity, average buy price and (optionally) first buy date.
3. Alternatively import them: FinScreen can read a holdings export from a broker, normalise it, and load it in as a portfolio.
4. Once holdings exist, the portfolio table shows each position with its company name, quantity, average buy price and buy date.

Why it matters beyond record-keeping: your holdings are what FinScreen's news impact alerts are scored against. A news story is analysed once, then matched to the specific companies you own, which is what produces the RED / ORANGE / YELLOW alerts in your Feed.""",
    ),
    (
        "feed-and-alerts",
        "How to read the Feed, and what the RED, ORANGE and YELLOW alerts mean",
        """The Feed (left sidebar → "Feed", the /feed page) has three tabs:

1. News — real market news articles, newest first, filterable by category (MACRO, MARKETS, COMMODITY, POLICY, GLOBAL, SECTOR, CORPORATE) and searchable across the whole store, not just the page on screen.
2. Announcements — official regulatory filings from companies. These are filings, not journalism, and are kept in their own tab for that reason.
3. Alerts — your personal alerts. This tab needs you to be logged in with holdings in your portfolio.

What the alert colours mean:
- RED: the strongest scored link between a news event and something you own.
- ORANGE: a moderate scored link.
- YELLOW: a weak but still notable link.

The colour is not a UI guess. It comes from a score computed by FinScreen's causal-analysis workflow, which traces knock-on effects from an event and matches them against the specific exposures of the companies you hold. Each alert can be marked read, dismissed, or given thumbs up/down feedback.

Important: these alerts describe cause and effect. They are not buy or sell instructions.""",
    ),
    (
        "company-page",
        "What you can see on a company page",
        """Open a company page by searching for it, clicking it in any results table, or going to /company/SYMBOL directly.

On the page you get:
- The header with current price, change, and key identity information.
- Key metrics and ratio grids, including any extra ratios you have pinned with the "Add Ratio" button.
- Financial statements: profit and loss, balance sheet, and cash flow, with quarterly results.
- Operating ratios and annual ratios tables.
- Shareholding pattern, including the promoter/FII/DII split and shareholder base statistics.
- Peer comparison against similar companies.
- Corporate actions such as dividends and splits.
- Documents: annual reports, investor presentations, credit rating notices and earnings-call transcripts, each linking to the original PDF filed with the exchange.
- A price chart.
- Strengths and limitations.

The sticky sub-navigation at the top of the page jumps you between those sections.""",
    ),
    (
        "market-pulse",
        "What is in Market Pulse",
        """Market Pulse (left sidebar → "Market Pulse", the /market-pulse page) collects market-wide activity that is not tied to one company you already follow. Its sections:

- Announcements — corporate filings across the market (/market-pulse/announcements).
- Results — companies reporting results (/market-pulse/results).
- Concalls — recent earnings calls with transcript links (/market-pulse/concalls), and Upcoming Concalls (/market-pulse/upcoming-concalls).
- Annual Reports (/market-pulse/annual-reports).
- Dividends (/market-pulse/dividends).
- New Issues / IPOs, including upcoming Rights Issues (/market-pulse/new-issues).
- Insider Trades (/market-pulse/insider-trades) and SAST Trades (/market-pulse/sast-trades) — SEBI PIT and takeover-regulation disclosures pulled from corporate announcements (our data source has no bulk/block-deal trade feed, so those two views don't exist).
- Industries (/market-pulse/industries).
- Commodities (/market-pulse/commodities).
- Holidays — the exchange holiday calendar (/market-pulse/holidays).""",
    ),
    (
        "search-and-shortcuts",
        "How to search for a company quickly, and keyboard shortcuts",
        """Press Ctrl+K (or Cmd+K on a Mac) anywhere in FinScreen to open the command palette. Start typing a company name, a symbol, or an index name and jump straight to its page.

Other navigation notes:
- The left sidebar collapses to icons using the chevron button, so you can widen the working area; hovering a collapsed icon shows its label.
- "Markets Today" (the / page) is the dashboard: indices, top movers, sector performance, a market heatmap and the latest news.
- The indices ticker runs along the top of every page.""",
    ),
    (
        "research-chat",
        "How to use Research Chat, including opening it in a new tab and the language level setting",
        """Research Chat is FinScreen's built-in research assistant. Open it from the left sidebar → "Research Chat" (the /chat page). Ctrl+click (or Cmd+click) that sidebar item to open the chat in a new browser tab, so you can keep a company page open beside it.

What it can answer:
- Questions about a specific listed company — its business, its numbers, what it is exposed to, and what its risks and red flags look like.
- Questions about what management actually said, taken from that company's earnings call transcripts.
- Questions about market news and what a news event knocks on to.
- Questions about sectors and about how to research where to look.
- Questions about how to use FinScreen itself.

The language level dropdown sits next to the send button. It has three settings and it changes ONLY the vocabulary the answer is written in — never how deeply the question was researched, how many sources were used, or how accurate the answer is:
- New to markets: everyday words, every market term explained the first time it is used.
- Knows the basics: normal market vocabulary, with a quick explanation for anything unusual.
- Analyst level: full technical vocabulary, dense and direct, no definitions.

Your conversation stays where it is when you close the page or navigate away. It only starts fresh when you press "New chat". Your recent conversations are listed beside the chat so you can reopen any of them.

What Research Chat will not do: it will not tell you to buy or sell anything, it will not give you a target price, and it will not answer questions that have nothing to do with markets, companies or FinScreen. It is a research tool — it lays out what is there, on both sides, with its sources.""",
    ),
    (
        "data-and-limits",
        "Where FinScreen's data comes from, and what it does not do",
        """Data sources:
- Prices, fundamentals, financial statements, shareholding, corporate actions, filings and earnings-call transcripts come from FinEdge, which serves exchange-filed data for Indian listed companies.
- News comes from publisher RSS feeds and GDELT, deduplicated into one store, plus corporate announcements filed with the exchanges.
- Company exposure profiles (what a company buys, sells and is sensitive to) are built by FinScreen's own analysis workflow.

Known limits, stated plainly:
- Fundamentals are served from a synced local copy that is refreshed in the background, so they are as fresh as the last sync, not tick-by-tick.
- Not every company files an earnings-call transcript, and some file scanned PDFs with no readable text — for those, transcript-based answers are not available.
- FinScreen is a research platform. It does not place trades, does not manage money, and does not give investment advice.""",
    ),
]


def build_help_documents() -> list[RagSourceDocument]:
    """Static, so this is sync — no I/O to await. The indexer's hash check
    means re-running it costs one SELECT and zero embedding calls once the
    topics are in."""
    # Fixed, not now(): doc_date feeds the retriever's recency weighting, and
    # a help topic that silently became "today's document" on every cycle would
    # out-rank genuinely fresh news for questions that are about neither.
    epoch = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [
        RagSourceDocument(
            source_type=SourceType.PLATFORM_HELP,
            source_key=key,
            title=title,
            text=f"{title}\n\n{body}",
            doc_date=epoch,
            metadata={"topic": key},
            # One chunk per topic — a procedure is only useful whole.
            pre_chunked=[f"{title}\n\n{body}"],
        )
        for key, title, body in HELP_TOPICS
    ]
