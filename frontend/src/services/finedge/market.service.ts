/**
 * services/finedge/market.service.ts
 * Typed service layer for market-wide and universe-level FinEdge API calls.
 * All methods go through the backend proxy — API key is never exposed to browser.
 */

import finedgeClient from './client'
import { ENDPOINTS } from './endpoints'

// ─── Shared Param Types ───────────────────────────────────────────────────────

export interface StockSearchParams {
  /**
   * Category to browse by:
   * - 'sector'   → pass a sector name as `value`
   * - 'industry' → pass an industry name as `value`
   * - 'index'    → pass an index name (e.g. 'NIFTY50') as `value`
   */
  group: 'sector' | 'industry' | 'index'
  value: string
}

export interface DateRangeParams {
  from_date?: string  // ISO date: YYYY-MM-DD
  to_date?: string    // ISO date: YYYY-MM-DD
}

export interface QuoteParams {
  /** Single symbol or comma-separated list; omit for all (premium only) */
  symbol?: string | string[]
}

// ─── Market Service ───────────────────────────────────────────────────────────

export const MarketService = {
  /**
   * Full list of tradeable stock symbols (NSE/BSE) — 5000+ symbols
   * → GET /api/finedge/stock-symbols
   */
  getStockSymbols: () =>
    finedgeClient.get(ENDPOINTS.STOCK_SYMBOLS),

  /**
   * Browse stocks by sector, industry, or index membership
   * → GET /api/finedge/stock-search?group=sector&value=FMCG
   */
  getStockSearch: (params: StockSearchParams) =>
    finedgeClient.get(ENDPOINTS.STOCK_SEARCH, { params }),

  /**
   * Company name-change history (SEBI-mandated disclosures)
   * → GET /api/finedge/name-changes
   */
  getNameChanges: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.NAME_CHANGES, { params }),

  /**
   * Ticker/symbol-change history (NSE/BSE re-listings)
   * → GET /api/finedge/symbol-changes
   */
  getSymbolChanges: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.SYMBOL_CHANGES, { params }),

  /**
   * End-of-day index prices for ALL NSE/BSE indices (Nifty50, Sensex, etc.)
   * → GET /api/finedge/market/indices
   * TTL: 15 minutes (cached on backend)
   */
  getMarketIndices: () =>
    finedgeClient.get(ENDPOINTS.INDICES),

  /**
   * Metadata for all NSE/BSE indices (name, description, symbol mapping)
   * → GET /api/finedge/market/index-master
   * TTL: 24 hours (rarely changes)
   */
  getIndexMaster: () =>
    finedgeClient.get(ENDPOINTS.INDEX_MASTER),

  /**
   * 1M/3M/6M/1Y/3Y/5Y/7Y/10Y price returns for all indices
   * → GET /api/finedge/market/index-returns
   * TTL: 2 hours
   */
  getIndexReturns: () =>
    finedgeClient.get(ENDPOINTS.INDEX_RETURNS),

  /**
   * Live/EOD quote for all stocks (premium: no symbol param needed)
   * → GET /api/finedge/market/movers
   * Returned as object: { "RELIANCE": { current_price, change, volume, ... } }
   * TTL: cached until EOD midnight IST
   */
  getMarketMovers: (params?: QuoteParams) =>
    finedgeClient.get(ENDPOINTS.MARKET_MOVERS, { params }),

  /**
   * Upcoming & recent IPOs on NSE/BSE (±3 months window by default)
   * → GET /api/finedge/market/ipo
   * TTL: 2 hours
   */
  getIpoCalendar: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.IPO_CALENDAR, { params }),

  /**
   * Earnings announcement dates (7 days past + 30 days ahead by default)
   * → GET /api/finedge/market/results-calendar
   * TTL: 30 minutes
   */
  getResultsCalendar: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.RESULTS_CALENDAR, { params }),

  /**
   * NSE/BSE market holiday list for the year
   * → GET /api/finedge/market/holidays
   * TTL: 24 hours
   */
  getHolidaysCalendar: () =>
    finedgeClient.get(ENDPOINTS.HOLIDAYS_CALENDAR),

  /**
   * Daily corporate announcements feed (all companies, past 24h by default)
   * → GET /api/finedge/market/announcements
   * TTL: 30 minutes
   */
  getMarketAnnouncements: (params?: DateRangeParams & { symbol?: string }) =>
    finedgeClient.get(ENDPOINTS.MARKET_ANNOUNCEMENTS, { params }),

  /**
   * Supported commodity index list
   * → GET /api/finedge/market/commodity-list
   * TTL: 24 hours
   */
  getCommodityList: () =>
    finedgeClient.get(ENDPOINTS.COMMODITY_LIST),

  /**
   * Sector-wise performance (heat map data)
   * → GET /api/finedge/market/sectors  (via catch-all proxy)
   */
  getSectorPerformance: () =>
    finedgeClient.get(ENDPOINTS.MARKET_SECTORS),

  /**
   * Universal search / autocomplete (symbol + name fuzzy match)
   * → GET /api/finedge/search?q=HDFC
   */
  searchAutocomplete: (q: string) =>
    finedgeClient.get(ENDPOINTS.SEARCH_AUTOCOMPLETE, { params: { q } }),

  /**
   * Screener query runner — POST body contains filter conditions
   * → POST /api/finedge/screener/run
   */
  runScreener: (filters: Record<string, any>) =>
    finedgeClient.post(ENDPOINTS.SCREENER_RUN, filters),
}

export default MarketService
