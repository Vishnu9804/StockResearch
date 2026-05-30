/**
 * services/finedge/endpoints.ts
 * Centrally defined endpoints for FinEdge financial feeds API
 */

export const ENDPOINTS = {
  COMPANY_OVERVIEW: (symbol: string) => `/api/v1/company/${symbol}/overview`,
  COMPANY_FINANCIALS: (symbol: string) => `/api/v1/company/${symbol}/financials`,
  COMPANY_RATIOS: (symbol: string) => `/api/v1/company/${symbol}/ratios`,
  PRICE_HISTORY: (symbol: string) => `/api/v1/company/${symbol}/price-history`,
  QUARTERLY_RESULTS: (symbol: string) => `/api/v1/company/${symbol}/quarterly`,
  PROFIT_LOSS: (symbol: string) => `/api/v1/company/${symbol}/profit-loss`,
  BALANCE_SHEET: (symbol: string) => `/api/v1/company/${symbol}/balance-sheet`,
  CASH_FLOW: (symbol: string) => `/api/v1/company/${symbol}/cash-flow`,
  SHAREHOLDING: (symbol: string) => `/api/v1/company/${symbol}/shareholding`,
  CORPORATE_ACTIONS: (symbol: string) => `/api/v1/company/${symbol}/corporate-actions`,
  DOCUMENTS: (symbol: string) => `/api/v1/company/${symbol}/documents`,
  PEERS: (symbol: string) => `/api/v1/company/${symbol}/peers`,
  SCREENER_RUN: '/api/v1/screener/run',
  SEARCH_AUTOCOMPLETE: '/api/v1/search',
  INDICES: '/api/v1/market/indices',
} as const
