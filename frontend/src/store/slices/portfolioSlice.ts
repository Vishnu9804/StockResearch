/**
 * store/slices/portfolioSlice.ts
 * Redux slice for the current user's portfolio, hydrated via portfolioSaga.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface PortfolioHolding {
  id: string
  portfolioId: string
  symbol: string
  companyName: string
  quantity: number
  avgBuyPrice: number
  buyDate: string | null
  createdAt: string
}

export interface Portfolio {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  holdings: PortfolioHolding[]
}

export type PortfolioStatus = 'idle' | 'loading' | 'success' | 'error'

export interface PortfolioState {
  portfolios: Portfolio[]
  hasPortfolio: boolean
  status: PortfolioStatus
  error: string | null
}

const initialState: PortfolioState = {
  portfolios: [],
  hasPortfolio: false,
  status: 'idle',
  error: null,
}

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    fetchPortfoliosStart() {
      // handled by saga; type string is 'portfolio/fetchPortfoliosStart'
    },
    hydratePortfolios(state, action: PayloadAction<{ portfolios: Portfolio[]; hasPortfolio: boolean }>) {
      state.portfolios = action.payload.portfolios
      state.hasPortfolio = action.payload.hasPortfolio
      state.status = 'success'
      state.error = null
    },
    setStatus(state, action: PayloadAction<PortfolioStatus>) {
      state.status = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const {
  fetchPortfoliosStart,
  hydratePortfolios,
  setStatus,
  setError,
} = portfolioSlice.actions

export const portfolioReducer = portfolioSlice.reducer
