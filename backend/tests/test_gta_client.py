"""
tests/test_gta_client.py
Unit tests for the Global Trade Alert news source and its hand-off into the
ingest pipeline.

Pure — no database, no network, no model. Fixtures mirror the real basic-
access API shape (verified live, Sep 2026). The regressions pinned here are
all silent in production: a wrongly promoted weight or a zeroed relevance
score never raises, it just quietly changes what reaches the agents.
"""

from datetime import date, datetime, timedelta, timezone

import pytest

from core.config import settings

TODAY = date(2026, 9, 26)


# App modules are imported lazily, inside fixtures, on purpose: both import
# models.models, and doing that at COLLECTION time registers the Postgres-
# only JSONB/ARRAY tables on Base.metadata before conftest's session-wide
# SQLite create_all runs — which then fails and errors every test in the
# whole suite, not just this file.
@pytest.fixture
def gta():
    from services.news_sources import gta_client
    return gta_client


@pytest.fixture
def ingest():
    from services import news_ingest
    return news_ingest


def _intervention(**overrides):
    base = {
        "intervention_id": 154058,
        "state_act_id": 97058,
        "state_act_title": "EU: Provisional safeguard measure on imports of certain grain-oriented "
                           "flat-rolled products of silicon-electrical steel",
        "intervention_url": "https://globaltradealert.org/intervention/154058",
        "state_act_url": "https://www.globaltradealert.org/state-act/97058",
        "gta_evaluation": "Red",
        "implementing_jurisdictions": [{"id": 276, "name": "Germany", "iso": "DEU"}],
        "implementing_jurisdiction_groups": [],
        "affected_jurisdictions": [
            {"id": 699, "name": "India", "iso": "IND"},
            {"id": 156, "name": "China", "iso": "CHN"},
        ],
        "inferred_jurisdictions": "Targeted",
        "implementation_level": "National",
        "eligible_firm": "all",
        "intervention_type": "Safeguard",
        "mast_chapter": "D: Contingent trade-protective measures",
        "mast_subchapter": "D3 Safeguard",
        "affected_sectors": [412],
        "affected_products": [722511, 722611],
        "date_announced": "2026-08-01",
        "date_published": "2026-09-22",
        "date_implemented": "2026-08-15",
        "date_removed": None,
        "is_in_force": 1,
        "last_updated": "2026-09-22",
    }
    base.update(overrides)
    return base


# ── Grouping / identity ──────────────────────────────────────────────────────
def test_interventions_of_one_state_act_become_one_item(gta):
    records = [
        _intervention(),
        _intervention(intervention_id=154059, intervention_type="Import tariff", gta_evaluation="Amber"),
        _intervention(intervention_id=1, state_act_id=2, state_act_title="Other act",
                      state_act_url="https://www.globaltradealert.org/state-act/2"),
    ]
    groups = gta.group_by_state_act(records)
    assert sorted(len(g) for g in groups) == [1, 2]

    item = gta.state_act_to_raw_item(next(g for g in groups if len(g) == 2), today=TODAY)
    assert item["url"] == "https://www.globaltradealert.org/state-act/97058"
    assert item["title"].startswith("EU: Provisional safeguard")
    assert "Safeguard" in item["summary"] and "Import tariff" in item["summary"]
    assert len(item["entities"]) == 2
    assert {e["intervention_id"] for e in item["entities"]} == {154058, 154059}


def test_provider_fields_match_the_news_items_contract(gta):
    item = gta.state_act_to_raw_item([_intervention()], today=TODAY)
    assert item["source_type"] == "GTA"  # must match migration 007's check constraint
    assert item["source_name"] == "Global Trade Alert"
    assert item["source_tier"] == 2
    assert item["published_at"] == datetime(2026, 9, 22, tzinfo=timezone.utc)
    assert item["category"] in _feed_categories()
    assert item["regions"] == ["DEU"]
    assert item["curated"] is True


def _feed_categories():
    # The feed's colour palette (routers/news.py) covers exactly these.
    return {"MACRO", "MARKETS", "COMMODITY", "POLICY", "GLOBAL", "SECTOR", "CORPORATE"}


def test_missing_title_or_date_is_dropped(gta):
    assert gta.state_act_to_raw_item([_intervention(state_act_title="")], today=TODAY) is None
    assert gta.state_act_to_raw_item([_intervention(date_published=None)], today=TODAY) is None
    assert gta.state_act_to_raw_item([], today=TODAY) is None


# ── Content rendering ───────────────────────────────────────────────────────
def test_codes_are_translated_and_zero_padded(gta):
    # 10121 is HS 010121 (live horses) once its leading zero is restored.
    item = gta.state_act_to_raw_item(
        [_intervention(affected_products=[10121, 720851], affected_sectors=[11, 412])], today=TODAY
    )
    assert "Live animals (HS 01" in item["body"]
    assert "Iron and steel (HS 72" in item["body"]
    assert "Agriculture and horticulture products (CPC 01)" in item["body"]
    assert "Basic metals (CPC 41)" in item["body"]


def test_full_access_product_objects_are_supported(gta):
    products = [{"product_id": 720851, "prior_level": "0", "new_level": "25", "unit": None}]
    item = gta.state_act_to_raw_item(
        [_intervention(affected_products=products, intervention_description="<p>Duty of 25%.</p>")],
        today=TODAY,
    )
    assert "Iron and steel" in item["body"]
    assert "Duty of 25%." in item["body"]


def test_summary_never_carries_product_names(gta):
    # news_ingest tags NSE symbols on title+summary; generic product names
    # there could false-match a company alias and become a RED alert.
    item = gta.state_act_to_raw_item([_intervention(affected_products=[520100, 700100])], today=TODAY)
    assert "Cotton" not in item["summary"] and "Glass" not in item["summary"]
    assert "Cotton" in item["body"]


def test_india_and_timeline_are_explicit(gta):
    item = gta.state_act_to_raw_item([_intervention()], today=TODAY)
    assert "including India" in item["summary"]
    assert "India is among them" in item["body"]
    assert "announced by the government on 01 Aug 2026" in item["body"]
    assert "GTA recorded it on 22 Sep 2026" in item["body"]


def test_future_removal_date_is_not_reported_as_removed(gta):
    item = gta.state_act_to_raw_item([_intervention(date_removed="2027-12-31")], today=TODAY)
    assert "scheduled to lapse 31 Dec 2027" in item["body"]
    assert "removed" not in item["summary"]


def test_expired_measure_is_down_weighted(gta):
    live = gta.state_act_to_raw_item([_intervention()], today=TODAY)
    expired = gta.state_act_to_raw_item([_intervention(date_removed="2026-09-01", is_in_force=0)], today=TODAY)
    assert "removed 01 Sep 2026" in expired["summary"]
    assert expired["butterfly_weight"] < live["butterfly_weight"]


def test_eu_bloc_is_named_instead_of_listing_members(gta):
    members = [{"id": i, "name": f"Member {i}", "iso": f"M{i:02d}"} for i in range(27)]
    item = gta.state_act_to_raw_item(
        [_intervention(implementing_jurisdictions=members,
                       implementing_jurisdiction_groups=[{"name": "European Union"}])],
        today=TODAY,
    )
    assert item["summary"].startswith("European Union (27 member states)")
    assert item["regions"] == ["European Union"]


# ── Weighting ────────────────────────────────────────────────────────────────
def test_trade_barrier_touching_india_outranks_small_foreign_grant(gta):
    barrier = gta.state_act_to_raw_item([_intervention()], today=TODAY)
    grant = gta.state_act_to_raw_item(
        [_intervention(intervention_type="Financial grant", eligible_firm="firm-specific",
                       implementing_jurisdictions=[{"id": 246, "name": "Finland", "iso": "FIN"}],
                       affected_jurisdictions=[])],
        today=TODAY,
    )
    assert barrier["butterfly_weight"] >= 0.9
    assert grant["butterfly_weight"] == 0.0
    assert grant["category"] == "CORPORATE"


# ── Hand-off into services/news_ingest.py ────────────────────────────────────
def test_zero_weight_survives_normalisation(gta, ingest):
    # Regression: `float(raw.get("butterfly_weight") or 0.5)` promoted 0.0 to 0.5.
    raw = gta.state_act_to_raw_item(
        [_intervention(intervention_type="Financial grant", eligible_firm="firm-specific",
                       implementing_jurisdictions=[{"id": 246, "name": "Finland", "iso": "FIN"}],
                       affected_jurisdictions=[])],
        today=TODAY,
    )
    assert ingest._normalise(raw)["_butterfly_weight"] == 0.0


def test_normalise_keeps_body_lines_and_scores_curated_items(gta, ingest):
    raw = gta.state_act_to_raw_item(
        [_intervention(state_act_title="United States of America: Provisional antidumping duties on "
                                       "imports of van-type trailers from China",
                       intervention_type="Anti-dumping")],
        today=TODAY,
    )
    item = ingest._normalise(raw)
    assert item["body"] and "\n" in item["body"]
    assert item["language"] == "en"
    # "trailer" is a general-news noise term; it must not zero a GTA measure.
    assert ingest._score_relevance(item, []) >= ingest.ANALYSIS_RELEVANCE_FLOOR


def test_noise_filter_still_applies_to_non_curated_items(ingest):
    item = ingest._normalise({
        "title": "New movie trailer released", "url": "https://example.com/a",
        "published_at": datetime.now(timezone.utc), "source_tier": 2,
    })
    assert ingest._score_relevance(item, []) == 0.0


def test_persisted_row_has_only_real_columns(gta, ingest):
    from models.models import NewsItem

    item = ingest._normalise(gta.state_act_to_raw_item([_intervention()], today=TODAY))
    item["mentioned_symbols"] = []
    item["market_relevance"] = 0.5
    item["analysis_status"] = "PENDING"
    columns = set(NewsItem.__table__.columns.keys())
    persisted = {k for k in item if not k.startswith("_")}
    assert persisted <= columns, persisted - columns


# ── Window ───────────────────────────────────────────────────────────────────
def test_lookback_always_inside_retention(monkeypatch, gta):
    monkeypatch.setattr(settings, "GTA_LOOKBACK_DAYS", 90)
    assert gta.lookback_days() < settings.NEWS_RETENTION_DAYS
    monkeypatch.setattr(settings, "GTA_LOOKBACK_DAYS", 0)
    assert gta.lookback_days() == 1


def test_lookback_floor_is_midnight_utc(gta):
    floor = gta.lookback_floor(datetime(2026, 9, 26, 15, 30, tzinfo=timezone.utc))
    assert floor == datetime(2026, 9, 26, tzinfo=timezone.utc) - timedelta(days=gta.lookback_days())
