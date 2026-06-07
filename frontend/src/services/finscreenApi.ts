/**
 * services/finscreenApi.ts
 * Typed service layer consuming our backend /api/finscreen REST endpoints
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

  searchStockSymbols: async (query?: string): Promise<any[]> => {
    const response = await finscreenClient.get<any[]>('/stock-symbols', { params: { query } })
    return response.data
  },
}

export default finscreenApi
