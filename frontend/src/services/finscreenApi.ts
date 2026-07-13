import axios from 'axios'
import { supabase } from './supabaseClient'

export const finscreenClient = axios.create({
  baseURL: '/',
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
  fetchCompanyProfile: (symbol: string) => finscreenClient.get(`/company/${symbol}/profile`).then(r => r.data),
  fetchCompanyPL: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/pl`, { params }).then(r => r.data),
  fetchCompanyBalanceSheet: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/balance-sheet`, { params }).then(r => r.data),
  fetchCompanyCashFlow: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/financials/cash-flow`, { params }).then(r => r.data),
  fetchCompanySegments: (symbol: string, params: any) => finscreenClient.get(`/company/${symbol}/segments`, { params }).then(r => r.data),
  fetchCompanyRatios: (symbol: string) => finscreenClient.get(`/company/${symbol}/ratios`).then(r => r.data),
  fetchCompanyShareholding: (symbol: string) => finscreenClient.get(`/company/${symbol}/shareholding`).then(r => r.data),
  fetchCompanyCorporateActions: (symbol: string) => finscreenClient.get(`/company/${symbol}/corporate-actions`).then(r => r.data),
  fetchCompanyDocuments: (symbol: string) => finscreenClient.get(`/company/${symbol}/documents`).then(r => r.data),
}

// Add this line to satisfy default imports across your frontend
export default finscreenApi;