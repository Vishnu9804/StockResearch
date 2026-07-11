import pytest
from httpx import AsyncClient

BASE_URL = "/api/finscreen/company/RELIANCE/price-history"

@pytest.mark.asyncio
async def test_price_history_no_filters(client: AsyncClient):
    """Verify that price history returns successfully and includes the price list."""
    resp = await client.get(BASE_URL)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "symbol" in body
    assert "price" in body
    assert isinstance(body["price"], list)
    assert len(body["price"]) > 0

@pytest.mark.asyncio
async def test_price_history_with_date_filtering(client: AsyncClient):
    """Verify that price history is filtered correctly by from_date and to_date."""
    # First get the full data to pick valid dates
    resp = await client.get(BASE_URL)
    assert resp.status_code == 200
    all_prices = resp.json()["price"]
    assert len(all_prices) >= 10
    
    # Sort them to be sure about ranges
    sorted_prices = sorted(all_prices, key=lambda x: x["quote_date"])
    
    # Pick a date range in the middle
    from_date = sorted_prices[3]["quote_date"]
    to_date = sorted_prices[-3]["quote_date"]
    
    # Query with filters
    resp_filtered = await client.get(BASE_URL, params={"from_date": from_date, "to_date": to_date})
    assert resp_filtered.status_code == 200
    filtered_prices = resp_filtered.json()["price"]
    
    # Verify all returned dates are within the requested range
    for p in filtered_prices:
        qdate = p["quote_date"]
        assert from_date <= qdate <= to_date
        
    # The filtered list should be smaller than the original list
    assert len(filtered_prices) < len(all_prices)
