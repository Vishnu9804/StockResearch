/**
 * store/slices/companySlice.ts
 * Redux slice for the currently viewed company
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Company } from '@/lib/data/companies'
import { finscreenClient } from '@/services/finscreenApi'

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
  // FinEdge specific fields
  profitLoss: any | null
  balanceSheet: any | null
  cashFlow: any | null
  segments: any | null
  ratios: any | null
  corporateActions: any | null
  documents: any | null
  shareholdingData: any | null
  operatingRatios: any | null
  statementType: 's' | 'c'
  period: 'annual' | 'quarterly'
  quarterly: any | null
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
  // FinEdge specific initial states
  profitLoss: null,
  balanceSheet: null,
  cashFlow: null,
  segments: null,
  ratios: null,
  corporateActions: null,
  documents: null,
  shareholdingData: null,
  operatingRatios: null,
  statementType: 's',
  period: 'annual',
  quarterly: null,
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
    fetchCompanyPLSuccess(state, action: PayloadAction<any>) {
      state.profitLoss = action.payload
    },
    fetchCompanyQuarterlySuccess(state, action: PayloadAction<any>) {
      state.quarterly = action.payload
    },
    fetchCompanyBalanceSheetSuccess(state, action: PayloadAction<any>) {
      state.balanceSheet = action.payload
    },
    fetchCompanyCashFlowSuccess(state, action: PayloadAction<any>) {
      state.cashFlow = action.payload
    },
    fetchCompanySegmentsSuccess(state, action: PayloadAction<any>) {
      state.segments = action.payload
    },
    fetchCompanyRatiosSuccess(state, action: PayloadAction<any>) {
      state.ratios = action.payload
    },
    fetchCompanyShareholdingSuccess(state, action: PayloadAction<any>) {
      state.shareholdingData = action.payload
    },
    fetchCompanyCorporateActionsSuccess(state, action: PayloadAction<any>) {
      state.corporateActions = action.payload
    },
    fetchCompanyDocumentsSuccess(state, action: PayloadAction<any>) {
      state.documents = action.payload
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
      // FinEdge specific resets
      state.profitLoss = null
      state.balanceSheet = null
      state.cashFlow = null
      state.segments = null
      state.ratios = null
      state.corporateActions = null
      state.documents = null
      state.shareholdingData = null
      state.statementType = 's'
      state.period = 'annual'
    },
    setStatementType(state, action: PayloadAction<'s' | 'c'>) {
      state.statementType = action.payload
    },
    setPeriod(state, action: PayloadAction<'annual' | 'quarterly'>) {
      state.period = action.payload
    },
    fetchCompanyFinancialsStart(state, _action: PayloadAction<string>) {
      state.financialsStatus = 'loading'
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
  fetchCompanyPLSuccess,
  fetchCompanyQuarterlySuccess,
  fetchCompanyBalanceSheetSuccess,
  fetchCompanyCashFlowSuccess,
  fetchCompanySegmentsSuccess,
  fetchCompanyRatiosSuccess,
  fetchCompanyShareholdingSuccess,
  fetchCompanyCorporateActionsSuccess,
  fetchCompanyDocumentsSuccess,
  setStatementType,
  setPeriod,
  fetchCompanyFinancialsStart,
} = companySlice.actions

export const companyReducer = companySlice.reducer

// Thunk action for fetching quarterly results via FastAPI financials/pl?period=quarterly
export const fetchQuarterlyResults = (symbol: string) => async (dispatch: any) => {
  dispatch(setFinancialsStatus('loading'))
  dispatch(setFinancialsError(null))
  try {
    const res = await finscreenClient.get(`/company/${symbol}/financials/pl`, {
      params: { period: 'quarterly' }
    })
    dispatch(fetchCompanyQuarterlySuccess(res.data))
    dispatch(setFinancialsStatus('success'))
  } catch (err: any) {
    console.error('Failed to fetch quarterly results:', err)
    const errMsg = err.response?.data?.detail?.message || err.message || 'Failed to fetch quarterly results'
    dispatch(setFinancialsError(errMsg))
    dispatch(setFinancialsStatus('error'))
  }
}
