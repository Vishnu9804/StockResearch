import axios from 'axios'
import { supabase } from './supabaseClient'

export const finscreenClient = axios.create({
  baseURL: '/api/finscreen',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const screenerApiClient = axios.create({
  baseURL: '/api/screener',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Centralized injection mechanism for active validation tokens
const injectAuthToken = async (config: any) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
}

finscreenClient.interceptors.request.use(injectAuthToken, (error) => Promise.reject(error))
apiClient.interceptors.request.use(injectAuthToken, (error) => Promise.reject(error))
screenerApiClient.interceptors.request.use(injectAuthToken, (error) => Promise.reject(error))

export const finscreenApi = {
  // --- Company Specific Endpoints ---
  fetchCompanyProfile: (symbol: string) => finscreenClient.get(`/company/${symbol}/profile`).then(r => r.data),
  fetchCompanyPL: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/pl`, { params }).then(r => r.data),
  fetchCompanyBalanceSheet: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/balance-sheet`, { params }).then(r => r.data),
  fetchCompanyCashFlow: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/cash-flow`, { params }).then(r => r.data),
  fetchCompanySegments: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/segments`, { params }).then(r => r.data),
  fetchCompanyRatios: (symbol: string) => finscreenClient.get(`/company/${symbol}/ratios`).then(r => r.data),
  fetchCompanyShareholding: (symbol: string) => finscreenClient.get(`/company/${symbol}/shareholding`).then(r => r.data),
  fetchShareholdingBreakdown: (symbol: string) => finscreenClient.get(`/company/${symbol}/shareholding/breakdown`).then(r => r.data),
  fetchCompanyCorporateActions: (symbol: string) => finscreenClient.get(`/company/${symbol}/corporate-actions`).then(r => r.data),
  fetchCompanyDocuments: (symbol: string) => finscreenClient.get(`/company/${symbol}/documents`).then(r => r.data),
  fetchPeers: (symbol: string) => finscreenClient.get(`/company/${symbol}/peers`).then(r => r.data),
  fetchPeerComparison: (symbol: string, sector?: string, limit?: number) =>
    finscreenClient.get(`/company/${symbol}/peer-comparison`, {
      params: { ...(sector ? { sector } : {}), ...(limit ? { limit } : {}) },
    }).then(r => r.data),
  fetchPeerComparisonQuarterly: (symbol: string, symbols: string[]) =>
    finscreenClient.get(`/company/${symbol}/peer-comparison/quarterly`, { params: { symbols: symbols.join(',') } }).then(r => r.data),
  
  // --- Market & Feed Endpoints ---
  fetchMarketNews: () => finscreenClient.get('/market/news').then(r => r.data),
  fetchMarketIndices: () => finscreenClient.get('/market/indices').then(r => r.data),
  fetchTopMovers: () => finscreenClient.get('/market/movers').then(r => r.data),
  fetchMarketMovers: () => finscreenClient.get('/market/movers').then(r => r.data),
  fetchSectorPerformance: () => finscreenClient.get('/market/sector-performance').then(r => r.data),
  fetchCommodities: () => finscreenClient.get('/market/commodities').then(r => r.data),
  fetchHolidays: () => finscreenClient.get('/market/holidays').then(r => r.data),
  fetchIpoCalendar: () => finscreenClient.get('/market/ipo').then(r => r.data),
  fetchResultsCalendar: () => finscreenClient.get('/market/results-calendar').then(r => r.data),
  fetchMarketAnnouncements: () => finscreenClient.get('/market/announcements').then(r => r.data),
  fetchRefreshedStocks: () => finscreenClient.get('/refreshed-stocks').then(r => r.data),
  fetchStockSymbols: () => finscreenClient.get('/stock-symbols').then(r => r.data),

  // --- Ratio catalog (static definitions for the "Add Ratio" picker) ---
  fetchRatioCatalog: () => finscreenClient.get('/ratio-catalog').then(r => r.data),
}

// --- User's saved extra-ratio preferences (global, applies to every company page) ---
export const ratioPreferencesApi = {
  list: () => apiClient.get('/ratio-preferences/').then(r => r.data),
  add: (ratioKeys: string[]) => apiClient.post('/ratio-preferences/', { ratioKeys }).then(r => r.data),
  remove: (ratioKey: string) => apiClient.delete(`/ratio-preferences/${encodeURIComponent(ratioKey)}`).then(r => r.data),
}

// --- User-authored custom ratio formulas (Custom Ratios / Formula Builder page) ---
export interface CustomRatioDto {
  id: string
  name: string
  formula: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface EvaluateFormulaResult {
  success: boolean
  symbol: string
  value?: number
  resolvedVariables: Record<string, number>
  missingVariables?: string[]
  message?: string
}

export const customRatiosApi = {
  list: () => apiClient.get('/custom-ratios/').then(r => r.data as { success: boolean; ratios: CustomRatioDto[] }),
  create: (name: string, formula: string, description?: string) =>
    apiClient.post('/custom-ratios/', { name, formula, description }).then(r => r.data as { success: boolean; ratio: CustomRatioDto }),
  update: (id: string, body: { name?: string; formula?: string; description?: string }) =>
    apiClient.put(`/custom-ratios/${id}`, body).then(r => r.data as { success: boolean; ratio: CustomRatioDto }),
  remove: (id: string) => apiClient.delete(`/custom-ratios/${id}`).then(r => r.data),
  evaluate: (formula: string, symbol: string) =>
    apiClient.post('/custom-ratios/evaluate', { formula, symbol }).then(r => r.data as EvaluateFormulaResult),
}

// Default export to satisfy components importing it directly
export default finscreenApi;