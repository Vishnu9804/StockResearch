-- ============================================================================
-- Global Trade Alert cutover — allow the new source_type value
-- Run via: python scripts/apply_migration.py 007_gta_news_source.sql
--
-- Sep 2026: news_items.source_type switches to Global Trade Alert (see
-- services/news_sources/gta_client.py). Every existing value is kept, same as
-- migration 004 did: already-stored MARKETAUX rows stay valid until the
-- time-based retention cleanup ages them out, and the hand-seeded MANUAL test
-- rows (with their analyses and alerts) are untouched.
-- ============================================================================

alter table public.news_items
  drop constraint if exists news_items_source_type_ck;

alter table public.news_items
  add constraint news_items_source_type_ck check (
    source_type in ('RSS','GDELT','FINEDGE_ANNOUNCEMENT','PRESS_RELEASE','MANUAL','MARKETAUX','GTA'));
