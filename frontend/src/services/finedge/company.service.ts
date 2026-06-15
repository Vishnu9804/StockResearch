/**
 * services/finedge/company.service.ts
 * Typed service layer for all per-company FinEdge API calls.
 * Consumed by React components via hooks or Redux Thunks.
 *
 * All methods return the raw Axios response — callers should access `.data`.
 * The finedgeClient handles auth, retries (429), and 401 → logout.
 */

import finedgeClient from './client'
import { ENDPOINTS } from './endpoints'

// ─── Shared Param Types ───────────────────────────────────────────────────────

export interface FinancialParams {
  /** 'c' = consolidated (default), 's' = standalone */
  statement_type?: 'c' | 's'
  /** Number of periods to return */
  limit?: number
}

export interface DateRangeParams {
  from?: string  // ISO date: YYYY-MM-DD
  to?: string    // ISO date: YYYY-MM-DD
}

export interface PriceHistoryParams extends DateRangeParams {
  interval?: 'daily' | 'weekly' | 'monthly'
}

export interface ShareholdingParams {
  /** quarter format: YYYYMM e.g. '202409' */
  quarter?: string
}

// ─── Company Service ─────────────────────────────────────────────────────────

export const CompanyService = {
  /**
   * Company profile / overview card data
   * → GET /api/finedge/company/:symbol/profile
   */
  getProfile: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.COMPANY_PROFILE(symbol)),

  /**
   * Summary financials headline card (revenue, EBITDA, PAT, EPS)
   * → GET /api/finedge/company/:symbol/basic-financials
   */
  getBasicFinancials: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.BASIC_FINANCIALS(symbol), { params }),

  /**
   * Key financial metrics (ROE, ROCE, margins, growth CAGR)
   * → GET /api/finedge/company/:symbol/financial-metrics
   */
  getFinancialMetrics: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.FINANCIAL_METRICS(symbol), { params }),

  /**
   * Profit & Loss statement
   * → GET /api/finedge/company/:symbol/financials/pl
   */
  getProfitLoss: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.PROFIT_LOSS(symbol), { params }),

  /**
   * Balance Sheet
   * → GET /api/finedge/company/:symbol/financials/balance-sheet
   */
  getBalanceSheet: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.BALANCE_SHEET(symbol), { params }),

  /**
   * Cash Flow Statement
   * → GET /api/finedge/company/:symbol/financials/cash-flow
   */
  getCashFlow: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.CASH_FLOW(symbol), { params }),

  /**
   * Notes to accounts (deep-dive financial disclosures)
   * → GET /api/finedge/company/:symbol/notes
   */
  getNotes: (symbol: string, params?: FinancialParams) =>
    finedgeClient.get(ENDPOINTS.NOTES(symbol), { params }),

  /**
   * Key financial ratios (valuation, profitability, leverage, efficiency)
   * → GET /api/finedge/company/:symbol/ratios
   */
  getRatios: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.COMPANY_RATIOS(symbol)),

  /**
   * Segment-wise revenue breakdown (business segments)
   * → GET /api/finedge/company/:symbol/segments
   */
  getSegments: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.COMPANY_SEGMENTS(symbol)),

  /**
   * Peer / competitor comparison table
   * → GET /api/finedge/company/:symbol/peers
   */
  getPeers: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.PEER_COMPARISON(symbol)),

  // ─── Price Data ────────────────────────────────────────────────────────────

  /**
   * Live / delayed current market quote
   * → GET /api/finedge/company/:symbol/quote
   */
  getCurrentQuote: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.CURRENT_QUOTE(symbol)),

  /**
   * OHLCV daily price history for charts (up to 5 years)
   * → GET /api/finedge/company/:symbol/price-history?from=&to=&interval=
   */
  getPriceHistory: (symbol: string, params?: PriceHistoryParams) =>
    finedgeClient.get(ENDPOINTS.PRICE_HISTORY(symbol), { params }),

  /**
   * Annual average PE/PB/PS/EV-EBITDA ratios (year-by-year)
   * → GET /api/finedge/company/:symbol/annual-price-ratios
   */
  getAnnualPriceRatios: (symbol: string, params?: { limit?: number }) =>
    finedgeClient.get(ENDPOINTS.ANNUAL_PRICE_RATIOS(symbol), { params }),

  /**
   * Daily PE/PB/PS time-series for valuation band charts
   * → GET /api/finedge/company/:symbol/daily-price-ratios?from=&to=
   */
  getDailyPriceRatios: (symbol: string, params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.DAILY_PRICE_RATIOS(symbol), { params }),

  // ─── Shareholding & Ownership ──────────────────────────────────────────────

  /**
   * Shareholding pattern (promoter / FII / DII / public breakdown)
   * → GET /api/finedge/company/:symbol/shareholding
   */
  getShareholdingPattern: (symbol: string, params?: ShareholdingParams) =>
    finedgeClient.get(ENDPOINTS.SHAREHOLDING(symbol), { params }),

  /**
   * Beneficial owners (individuals / institutions holding > 1%)
   * → GET /api/finedge/company/:symbol/shareholding/beneficial-owners
   */
  getBeneficialOwners: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.BENEFICIAL_OWNERS(symbol)),

  /**
   * Shareholding declaration (pledged shares, locked-in, warrants)
   * → GET /api/finedge/company/:symbol/shareholding/declaration
   */
  getShareholdingDeclaration: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.SHAREHOLDING_DECLARATION(symbol)),

  /**
   * Current top shareholders ranked by holding %
   * → GET /api/finedge/company/:symbol/shareholding/ownership-current
   */
  getOwnershipCurrent: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.OWNERSHIP_CURRENT(symbol)),

  /**
   * Historical ownership trend (quarterly promoter/FII/DII/public %)
   * → GET /api/finedge/company/:symbol/shareholding/ownership-history
   */
  getOwnershipHistory: (symbol: string, params?: DateRangeParams) =>
    finedgeClient.get(ENDPOINTS.OWNERSHIP_HISTORY(symbol), { params }),

  // ─── Corporate Actions & Documents ────────────────────────────────────────

  /**
   * Corporate actions: dividends, splits, buybacks, rights issues, bonuses
   * → GET /api/finedge/company/:symbol/corporate-actions
   */
  getCorporateActions: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.CORPORATE_ACTIONS(symbol)),

  /**
   * Corporate documents: annual reports, investor presentations, transcripts
   * → GET /api/finedge/company/:symbol/documents
   */
  getDocuments: (symbol: string) =>
    finedgeClient.get(ENDPOINTS.DOCUMENTS(symbol)),
}

export default CompanyService
