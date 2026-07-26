"""
services/news_sources
Free, keyless news providers for the Butterfly Effect workflow.

Why not FinEdge: FinEdge is a fundamentals/filings/market-data API (P&L, balance
sheet, cash flow, quotes, corp-announcements, corporate actions, indices). Its
public surface — verified against both its documentation and our own endpoint
inventory in scripts/deep_api_test_report.json — contains no editorial news
product. What routers/finedge.py currently serves at /market/news is
corp-announcements reshaped into news cards, which is regulatory disclosure by
the company itself. That is exactly the wrong input for this feature: a filing
is by definition a DIRECT statement about one company, so it can only ever
produce red alerts. Butterfly chains start from macro, commodity, policy and
global events that never name the affected company at all.

Providers here are chosen for three properties: no API key, no commercial-use
paywall, and no per-call quota to babysit.
"""

from services.news_sources.gdelt_client import fetch_gdelt
from services.news_sources.rss_client import RSS_FEEDS, fetch_all_feeds, fetch_feed

__all__ = ["RSS_FEEDS", "fetch_feed", "fetch_all_feeds", "fetch_gdelt"]
