/**
 * services/finedge/market.service.ts
 * Typed service layer for market-wide and universe-level FinEdge API calls.
 *
 * All methods return the raw Axios response — callers should access `.data`.
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

// ─── Market Service ───────────────────────────────────────────────────────────

export const MarketService = {
  /**
   * Full list of tradeable stock symbols (NSE/BSE)
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
   * → GET /api/finedge/name-changes?from_date=&to_date=
   */
  getNameChanges: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.NAME_CHANGES, { params }),

  /**
   * Ticker/symbol-change history (NSE/BSE re-listings)
   * → GET /api/finedge/symbol-changes?from_date=&to_date=
   */
  getSymbolChanges: (params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.SYMBOL_CHANGES, { params }),

  /**
   * Live market indices (NIFTY50, SENSEX, NIFTYBANK, etc.)
   * → GET /api/finedge/market/indices  (via catch-all proxy)
   */
  getMarketIndices: () =>
    finedgeClient.get(ENDPOINTS.INDICES),

  /**
   * Top market movers: gainers & losers of the day
   * → GET /api/finedge/market/movers  (via catch-all proxy)
   */
  getMarketMovers: () =>
    finedgeClient.get(ENDPOINTS.MARKET_MOVERS),

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
