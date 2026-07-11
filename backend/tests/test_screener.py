"""
tests/test_screener.py
Unit tests for POST /api/screener/run — backend pagination.

Covers:
  - Empty query returns rows (total > 0)
  - page/limit respected: first page length ≤ limit
  - Second page contains different rows than first page
  - Filter query reduces the result set
  - Invalid page is clamped to 1
  - Out-of-range limit is clamped to 1-200
"""

import pytest
from httpx import AsyncClient


BASE = "/api/screener/run"


@pytest.mark.asyncio
async def test_screener_empty_query_returns_rows(client: AsyncClient):
    """No filters → all seeded rows returned across pages."""
    resp = await client.post(BASE, json={"query": "", "page": 1, "limit": 100})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["total"] > 0
    assert isinstance(body["results"], list)


@pytest.mark.asyncio
async def test_screener_page_limit_respected(client: AsyncClient):
    """Results slice honours the requested limit."""
    resp = await client.post(BASE, json={"query": "", "page": 1, "limit": 2})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["results"]) <= 2
    assert body["page"] == 1
    assert body["limit"] == 2


@pytest.mark.asyncio
async def test_screener_page2_differs_from_page1(client: AsyncClient):
    """Page 2 returns a different slice than page 1 (assuming total > limit)."""
    r1 = await client.post(BASE, json={"query": "", "page": 1, "limit": 3})
    r2 = await client.post(BASE, json={"query": "", "page": 2, "limit": 3})
    assert r1.status_code == 200 and r2.status_code == 200

    b1, b2 = r1.json(), r2.json()
    # If there are enough rows, the two pages must differ
    if b1["total"] > 3 and len(b2["results"]) > 0:
        symbols_p1 = {r["symbol"] for r in b1["results"]}
        symbols_p2 = {r["symbol"] for r in b2["results"]}
        assert symbols_p1.isdisjoint(symbols_p2), "Page 1 and page 2 overlap!"


@pytest.mark.asyncio
async def test_screener_filter_reduces_results(client: AsyncClient):
    """A tight PE filter should return fewer results than the unfiltered set."""
    resp_all = await client.post(BASE, json={"query": "", "page": 1, "limit": 200})
    resp_filtered = await client.post(BASE, json={"query": "pe < 1", "page": 1, "limit": 200})
    assert resp_all.status_code == 200 and resp_filtered.status_code == 200

    total_all = resp_all.json()["total"]
    total_filtered = resp_filtered.json()["total"]
    assert total_filtered < total_all


@pytest.mark.asyncio
async def test_screener_invalid_page_clamped(client: AsyncClient):
    """page=0 or negative must be treated as page=1 (clamped)."""
    resp = await client.post(BASE, json={"query": "", "page": 0, "limit": 10})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["page"] == 1


@pytest.mark.asyncio
async def test_screener_limit_clamped_to_max(client: AsyncClient):
    """limit > 200 must be clamped to 200."""
    resp = await client.post(BASE, json={"query": "", "page": 1, "limit": 9999})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["limit"] == 200
    assert len(body["results"]) <= 200
