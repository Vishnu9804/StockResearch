/**
 * services/finedge/endpoints.ts
 * Centrally defined endpoints for FinEdge financial feeds API
 * All paths are relative to the finedgeClient baseURL (/api/finedge)
 */

export const ENDPOINTS = {
  // ─── Company Universe & Discovery ────────────────────────────────────────
  STOCK_SYMBOLS: '/stock-symbols',
  STOCK_SEARCH: '/stock-search',
  NAME_CHANGES: '/name-changes',
  SYMBOL_CHANGES: '/symbol-changes',

  // ─── Per-Company: Core Profile & Financials ───────────────────────────────
  COMPANY_PROFILE: (symbol: string) => `/company/${symbol}/profile`,
  COMPANY_OVERVIEW: (symbol: string) => `/company/${symbol}/profile`, // alias
  BASIC_FINANCIALS: (symbol: string) => `/company/${symbol}/basic-financials`,
  FINANCIAL_METRICS: (symbol: string) => `/company/${symbol}/financial-metrics`,
  COMPANY_FINANCIALS: (symbol: string) => `/company/${symbol}/financials`,
  PROFIT_LOSS: (symbol: string) => `/company/${symbol}/financials/pl`,
  BALANCE_SHEET: (symbol: string) => `/company/${symbol}/financials/balance-sheet`,
  CASH_FLOW: (symbol: string) => `/company/${symbol}/financials/cash-flow`,
  NOTES: (symbol: string) => `/company/${symbol}/notes`,
  COMPANY_RATIOS: (symbol: string) => `/company/${symbol}/ratios`,
  COMPANY_SEGMENTS: (symbol: string) => `/company/${symbol}/segments`,
  PEER_COMPARISON: (symbol: string) => `/company/${symbol}/peers`,

  // ─── Per-Company: Price Data & Valuation Ratios ───────────────────────────
  CURRENT_QUOTE: (symbol: string) => `/company/${symbol}/quote`,
  PRICE_HISTORY: (symbol: string) => `/company/${symbol}/price-history`,
  ANNUAL_PRICE_RATIOS: (symbol: string) => `/company/${symbol}/annual-price-ratios`,
  DAILY_PRICE_RATIOS: (symbol: string) => `/company/${symbol}/daily-price-ratios`,

  // ─── Per-Company: Shareholding & Ownership ────────────────────────────────
  SHAREHOLDING: (symbol: string) => `/company/${symbol}/shareholding`,
  BENEFICIAL_OWNERS: (symbol: string) => `/company/${symbol}/shareholding/beneficial-owners`,
  SHAREHOLDING_DECLARATION: (symbol: string) => `/company/${symbol}/shareholding/declaration`,
  OWNERSHIP_CURRENT: (symbol: string) => `/company/${symbol}/shareholding/ownership-current`,
  OWNERSHIP_HISTORY: (symbol: string) => `/company/${symbol}/shareholding/ownership-history`,

  // ─── Per-Company: Corporate Actions & Documents ───────────────────────────
  CORPORATE_ACTIONS: (symbol: string) => `/company/${symbol}/corporate-actions`,
  DOCUMENTS: (symbol: string) => `/company/${symbol}/documents`,

  // ─── Market (catch-all proxy) ─────────────────────────────────────────────
  SCREENER_RUN: '/screener/run',
  SEARCH_AUTOCOMPLETE: '/search',
  INDICES: '/market/indices',
  MARKET_MOVERS: '/market/movers',
  MARKET_SECTORS: '/market/sectors',
} as const
