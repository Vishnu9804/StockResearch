/**
 * store/slices/companySlice.ts
 * Redux slice for the currently viewed company
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Company } from '@/lib/data/companies'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface CompanyState {
  currentSymbol: string | null
  data: Company | null
  status: LoadStatus
  error: string | null
  financialsStatus: LoadStatus
  financialsError: string | null
  shareholdingStatus: LoadStatus
  shareholdingError: string | null
  priceChartStatus: LoadStatus
  priceChartError: string | null
  watchlist: string[]
  activeTab: 'overview' | 'financials' | 'shareholding' | 'corporate-actions' | 'peers'
}

const initialState: CompanyState = {
  currentSymbol: null,
  data: null,
  status: 'idle',
  error: null,
  financialsStatus: 'idle',
  financialsError: null,
  shareholdingStatus: 'idle',
  shareholdingError: null,
  priceChartStatus: 'idle',
  priceChartError: null,
  watchlist: [],
  activeTab: 'overview',
}

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    // ─── Fetch company overview ─────────────────────────────────────────
    fetchCompanyStart(state, action: PayloadAction<string>) {
      state.currentSymbol = action.payload
      state.status = 'loading'
      state.error = null
      state.data = null
    },
    fetchCompanySuccess(state, action: PayloadAction<Company>) {
      state.data = action.payload
      state.status = 'success'
      state.error = null
    },
    fetchCompanyFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },

    // ─── Financials ─────────────────────────────────────────────────────
    setFinancialsStatus(state, action: PayloadAction<LoadStatus>) {
      state.financialsStatus = action.payload
    },
    setFinancialsError(state, action: PayloadAction<string | null>) {
      state.financialsError = action.payload
    },

    // ─── Shareholding ───────────────────────────────────────────────────
    setShareholdingStatus(state, action: PayloadAction<LoadStatus>) {
      state.shareholdingStatus = action.payload
    },
    setShareholdingError(state, action: PayloadAction<string | null>) {
      state.shareholdingError = action.payload
    },

    // ─── Price Chart ─────────────────────────────────────────────────────
    setPriceChartStatus(state, action: PayloadAction<LoadStatus>) {
      state.priceChartStatus = action.payload
    },
    setPriceChartError(state, action: PayloadAction<string | null>) {
      state.priceChartError = action.payload
    },

    // ─── Watchlist ───────────────────────────────────────────────────────
    addToWatchlistFromCompany(state, action: PayloadAction<string>) {
      if (!state.watchlist.includes(action.payload)) {
        state.watchlist.push(action.payload)
      }
    },
    removeFromWatchlistFromCompany(state, action: PayloadAction<string>) {
      state.watchlist = state.watchlist.filter((s) => s !== action.payload)
    },
    toggleWatchlist(state, action: PayloadAction<string>) {
      const symbol = action.payload
      const idx = state.watchlist.indexOf(symbol)
      if (idx === -1) {
        state.watchlist.push(symbol)
      } else {
        state.watchlist.splice(idx, 1)
      }
    },
    setWatchlist(state, action: PayloadAction<string[]>) {
      state.watchlist = action.payload
    },

    // ─── Active Tab ──────────────────────────────────────────────────────
    setActiveTab(state, action: PayloadAction<CompanyState['activeTab']>) {
      state.activeTab = action.payload
    },

    // ─── Reset ───────────────────────────────────────────────────────────
    resetCompany(state) {
      state.data = null
      state.currentSymbol = null
      state.status = 'idle'
      state.error = null
      state.financialsStatus = 'idle'
      state.financialsError = null
      state.shareholdingStatus = 'idle'
      state.shareholdingError = null
      state.priceChartStatus = 'idle'
      state.priceChartError = null
    },
  },
})

export const {
  fetchCompanyStart,
  fetchCompanySuccess,
  fetchCompanyFailure,
  setFinancialsStatus,
  setFinancialsError,
  setShareholdingStatus,
  setShareholdingError,
  setPriceChartStatus,
  setPriceChartError,
  addToWatchlistFromCompany,
  removeFromWatchlistFromCompany,
  toggleWatchlist,
  setWatchlist,
  setActiveTab,
  resetCompany,
} = companySlice.actions

export const companyReducer = companySlice.reducer
