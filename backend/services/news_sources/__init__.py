"""
services/news_sources
News providers for the Butterfly Effect workflow.

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

marketaux is the sole provider (see marketaux_client.py's module docstring
for the vendor review it won).
"""

from services.news_sources.marketaux_client import QUERIES, fetch_marketaux, query_health

__all__ = ["QUERIES", "fetch_marketaux", "query_health"]
