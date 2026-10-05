"""
tests/test_news_tagging.py
Unit tests for news_ingest's NSE symbol tagger.

Pure — no database. A false tag here is silent in production: it never
raises, it just becomes a NAMED-tier alert (which can reach RED) on a company
the story is not about. Every case below was seen on real ingested news.
"""

import pytest

UNIVERSE = [
    ("SOLARINDS", "Solar Industries India Ltd"),
    ("WAAREEENER", "Waaree Energies Ltd"),
    ("PREMIERENE", "Premier Solar Ltd"),
    ("IPL", "India Pesticides Ltd"),
    ("CLEAN", "Clean Science & Technology Ltd"),
    ("TECH", "TECH"),
    ("TECHM", "Tech Mahindra Ltd"),
    ("RELIANCE", "Reliance Industries Ltd"),
    ("RPOWER", "Reliance Power Ltd"),
    ("INFY", "Infosys Ltd"),
    ("HDFC", "HDFC"),
    ("HDFCBANK", "HDFC Bank Ltd"),
    ("HDFCLIFE", "HDFC Life Insurance Company Ltd"),
    ("BANKINDIA", "Bank Of India"),
    ("SBIN", "State Bank of India"),
    ("COALINDIA", "Coal India Ltd"),
    ("TATASTEEL", "Tata Steel Ltd"),
    ("500325", "Reliance Industries Ltd"),
]


@pytest.fixture
def tag():
    # Imported lazily for the same reason as tests/test_gta_client.py.
    from services import news_ingest
    index = news_ingest.alias_index_from_rows(UNIVERSE)
    return lambda text: news_ingest._tag_symbols(text, index)


@pytest.mark.parametrize("text", [
    "Pakistan: Customs valuation for imported solar inverters from China revised",
    "Malaysia: Sales tax exemption on raw materials for animal feed, fertilisers, and pesticides",
    "Australia: Clean Energy Finance Corporation (CEFC) invests AUD 90 million to Cleanaway",
    "China (Hubei Province): Launch of CNY 20 billion Hubei Social Security Sci-Tech Innovation Fund",
    "Bank of Japan signals faster policy normalisation",
    "Reserve Bank of India cuts the repo rate by 50 basis points",
    "Customs value set at 500325 per tonne",
])
def test_generic_words_and_lookalikes_tag_nothing(tag, text):
    assert tag(text) == []


def test_real_company_names_still_tag(tag):
    text = "Infosys and Reliance Industries sign deal; Tata Steel and Coal India rally"
    assert tag(text) == ["COALINDIA", "INFY", "RELIANCE", "TATASTEEL"]


def test_longest_match_wins(tag):
    assert tag("State Bank of India raises lending rates") == ["SBIN"]
    assert tag("Bank of India Q2 profit jumps") == ["BANKINDIA"]


def test_ticker_inside_another_companys_name_is_not_a_tag(tag):
    assert tag("HDFC Bank names new CEO") == ["HDFCBANK"]


def test_tickers_match_only_in_uppercase(tag):
    assert tag("Analysts upgrade TATASTEEL") == ["TATASTEEL"]
    assert tag("Analysts upgrade tatasteel") == []
