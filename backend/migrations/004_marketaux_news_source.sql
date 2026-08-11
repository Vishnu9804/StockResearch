-- ============================================================================
-- marketaux cutover — allow the new source_type value
-- Run via: python scripts/apply_migration.py 004_marketaux_news_source.sql
--
-- 12 Aug 2026: news_items.source_type is switching to a single paid provider,
-- marketaux (see core/config.py's "News (marketaux)" block for the vendor
-- review). The existing values are kept in the constraint rather than
-- replaced — the three manually-seeded ANALYZED test rows (source_type RSS/
-- GDELT/MANUAL) are deliberately preserved across the cutover so the
-- Butterfly Effect workflow's test fixtures keep working, and MANUAL stays
-- valid for any future hand-seeded row.
-- ============================================================================

alter table public.news_items
  drop constraint if exists news_items_source_type_ck;

alter table public.news_items
  add constraint news_items_source_type_ck check (
    source_type in ('RSS','GDELT','FINEDGE_ANNOUNCEMENT','PRESS_RELEASE','MANUAL','MARKETAUX'));
