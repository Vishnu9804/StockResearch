/**
 * services/finscreenApi.ts
 * Typed service layer consuming our backend /api/finscreen REST endpoints.
 * This is a convenience wrapper — it picks up any auth cookies automatically.
 */

import axios, { type AxiosInstance } from 'axios'
import type { Company } from '@/lib/data/companies'

const BASE_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '/api/finscreen'
  : `${BASE_API.replace(/\/$/, '')}/finscreen`

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const finscreenClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach request ID
finscreenClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = generateRequestId()
  return config
})

export interface CompanyProfile extends Company {}

export interface SegmentItem {
  name: string
  revenuePercentage: number
  revenue: number
}

export interface CompanySegments {
  success: boolean
  symbol: string
  segments: SegmentItem[]
}

export interface FinancialMetricRatio {
  success: boolean
  symbol: string
  valuation: { pe: number; pb: number; evEbitda: number; marketCapSales: number }
  profitability: { roe: number; roce: number; netMargin: number; ebitdaMargin: number }
  efficiency: { assetTurnover: number; inventoryDays: number; debtorDays: number }
  leverage: { debtToEquity: number; interestCoverage: number; currentRatio: number }
  growth: { revenueCagr3Y: number; profitCagr3Y: number; epsCagr: number }
}

export interface DocumentItem {
  id: string
  title: string
  type: string
  date: string
  fileUrl: string
}

export interface CompanyDocuments {
  success: boolean
  symbol: string
  documents: DocumentItem[]
}

export interface ShareholdingItem {
  period: string
  promoters: number
  fii: number
  dii: number
  public: number
  others: number
}

export const finscreenApi = {
  // ─── Company Endpoints ────────────────────────────────────────────────────

  fetchCompanyProfile: async (symbol: string): Promise<CompanyProfile> => {
    const response = await finscreenClient.get<CompanyProfile>(`/company/${symbol}/profile`)
    return response.data
  },

  fetchCompanyPL: async (symbol: string, params?: Record<string, any>): Promise<any> => {
    const response = await finscreenClient.get<any>(`/company/${symbol}/financials/pl`, { params })
    return response.data
  },

  fetchCompanyBalanceSheet: async (symbol: string, params?: Record<string, any>): Promise<any> => {
    const response = await finscreenClient.get<any>(`/company/${symbol}/financials/balance-sheet`, { params })
    return response.data
  },

  fetchCompanyCashFlow: async (symbol: string, params?: Record<string, any>): Promise<any> => {
    const response = await finscreenClient.get<any>(`/company/${symbol}/financials/cash-flow`, { params })
    return response.data
  },

  fetchCompanySegments: async (symbol: string, params?: Record<string, any>): Promise<CompanySegments> => {
    const response = await finscreenClient.get<CompanySegments>(`/company/${symbol}/segments`, { params })
    return response.data
  },

  fetchCompanyRatios: async (symbol: string, params?: Record<string, any>): Promise<FinancialMetricRatio> => {
    const response = await finscreenClient.get<FinancialMetricRatio>(`/company/${symbol}/ratios`, { params })
    return response.data
  },

  fetchCompanyShareholding: async (symbol: string, params?: Record<string, any>): Promise<ShareholdingItem[]> => {
    const response = await finscreenClient.get<ShareholdingItem[]>(`/company/${symbol}/shareholding`, { params })
    return response.data
  },

  fetchCompanyCorporateActions: async (symbol: string, params?: Record<string, any>): Promise<any> => {
    const response = await finscreenClient.get<any>(`/company/${symbol}/corporate-actions`, { params })
    return response.data
  },

  fetchCompanyDocuments: async (symbol: string, params?: Record<string, any>): Promise<CompanyDocuments> => {
    const response = await finscreenClient.get<CompanyDocuments>(`/company/${symbol}/documents`, { params })
    return response.data
  },

  fetchCompanyNotes: async (symbol: string, params?: Record<string, any>): Promise<any> => {
    const response = await finscreenClient.get<any>(`/company/${symbol}/notes`, { params })
    return response.data
  },

  fetchPeersList: async (symbol: string): Promise<{ peers: string[] }> => {
    const response = await finscreenClient.get<{ peers: string[] }>(`/company/${symbol}/peers`)
    return response.data
  },

  // ─── Market / Discovery Endpoints ─────────────────────────────────────────

  searchStockSymbols: async (query?: string): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/stock-symbols', { params: { query } })
    return response.data
  },

  /**
   * Fetch end-of-day index feed for all NSE/BSE indices
   * Maps to: GET /api/finscreen/market/indices → FinEdge index/market-price/daily-feed
   */
  fetchMarketIndices: async (): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/market/indices')
    return response.data
  },

  /**
   * Fetch EOD quotes for ALL listed stocks (premium account — no symbol filter needed)
   * Maps to: GET /api/finscreen/market/movers → FinEdge /api/v1/quote
   * Returns: Record<symbol, { current_price, change, volume, ... }>
   */
  fetchMarketMovers: async (): Promise<Record<string, any>> => {
    const response = await finscreenClient.get<Record<string, any>>('/market/movers')
    return response.data
  },

  /**
   * Fetch quotes for a specific set of symbols (filtered via query param)
   */
  fetchMultipleQuotes: async (symbols: string[]): Promise<Record<string, any>> => {
    const params = new URLSearchParams()
    symbols.forEach(s => params.append('symbol', s))
    const response = await finscreenClient.get<Record<string, any>>(`/market/movers?${params.toString()}`)
    return response.data
  },

  /**
   * Fetch upcoming earnings results calendar (next 30 days)
   * Maps to: GET /api/finscreen/market/results-calendar
   */
  fetchResultsCalendar: async (params?: { from_date?: string; to_date?: string }): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/market/results-calendar', { params })
    return response.data
  },

  /**
   * Fetch daily corporate announcements feed
   * Maps to: GET /api/finscreen/market/announcements
   */
  fetchMarketAnnouncements: async (params?: { from_date?: string; to_date?: string; symbol?: string }): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/market/announcements', { params })
    return response.data
  },

  /**
   * Fetch upcoming and recent IPO calendar
   * Maps to: GET /api/finscreen/market/ipo
   */
  fetchIpoCalendar: async (): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/market/ipo')
    return response.data
  },

  /**
   * Fetch 1M/3M/6M/1Y/3Y/5Y/10Y returns for all indices
   * Maps to: GET /api/finscreen/market/index-returns
   */
  fetchIndexReturns: async (): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/market/index-returns')
    return response.data
  },

  fetchRefreshedStocks: async (): Promise<any> => {
    try {
      const response = await finscreenClient.get<any>('/refreshed-stocks', { params: { days: 1 } })
      return response.data
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.warn('Refreshed stocks returned 401, falling back to core benchmark stocks.')
      } else {
        console.error('Failed to fetch refreshed stocks:', err)
      }
      return {
        success: false,
        fallback: true,
        data: ['RELIANCE', 'TCS', 'HDFCBANK']
      }
    }
  },
}

export default finscreenApi
