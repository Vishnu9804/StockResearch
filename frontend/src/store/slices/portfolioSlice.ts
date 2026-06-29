/**
 * store/slices/portfolioSlice.ts
 * Redux slice for user portfolios and holdings with custom thunk actions.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { finscreenClient } from '@/services/finscreenApi'

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
  userId: string
  name: string
  createdAt: string
}

export interface PortfolioState {
  portfolios: Portfolio[]
  holdings: PortfolioHolding[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  activePortfolioId: string | null
}

const initialState: PortfolioState = {
  portfolios: [],
  holdings: [],
  status: 'idle',
  error: null,
  activePortfolioId: null,
}

// ─── Slice ───────────────────────────────────────────────────────────────────

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    setActivePortfolioId(state, action: PayloadAction<string | null>) {
      state.activePortfolioId = action.payload
    },
    // Portfolios
    fetchPortfoliosStart(state) {
      state.status = 'loading'
      state.error = null
    },
    fetchPortfoliosSuccess(state, action: PayloadAction<Portfolio[]>) {
      state.status = 'success'
      state.portfolios = action.payload
      if (action.payload.length > 0 && !state.activePortfolioId) {
        state.activePortfolioId = action.payload[0].id
      }
    },
    fetchPortfoliosFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    createPortfolioSuccess(state, action: PayloadAction<Portfolio>) {
      state.portfolios.unshift(action.payload)
      state.activePortfolioId = action.payload.id
    },
    deletePortfolioSuccess(state, action: PayloadAction<string>) {
      state.portfolios = state.portfolios.filter(p => p.id !== action.payload)
      if (state.activePortfolioId === action.payload) {
        state.activePortfolioId = state.portfolios.length > 0 ? state.portfolios[0].id : null
      }
    },
    // Holdings
    fetchHoldingsStart(state) {
      state.status = 'loading'
      state.error = null
    },
    fetchHoldingsSuccess(state, action: PayloadAction<PortfolioHolding[]>) {
      state.status = 'success'
      state.holdings = action.payload
    },
    fetchHoldingsFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    addHoldingSuccess(state, action: PayloadAction<PortfolioHolding>) {
      state.holdings.unshift(action.payload)
    },
    updateHoldingSuccess(state, action: PayloadAction<PortfolioHolding>) {
      const idx = state.holdings.findIndex(h => h.id === action.payload.id)
      if (idx !== -1) {
        state.holdings[idx] = action.payload
      }
    },
    deleteHoldingSuccess(state, action: PayloadAction<string>) {
      state.holdings = state.holdings.filter(h => h.id !== action.payload)
    }
  }
})

export const {
  setActivePortfolioId,
  fetchPortfoliosStart,
  fetchPortfoliosSuccess,
  fetchPortfoliosFailure,
  createPortfolioSuccess,
  deletePortfolioSuccess,
  fetchHoldingsStart,
  fetchHoldingsSuccess,
  fetchHoldingsFailure,
  addHoldingSuccess,
  updateHoldingSuccess,
  deleteHoldingSuccess,
} = portfolioSlice.actions

export const portfolioReducer = portfolioSlice.reducer

// ─── Custom Thunk Actions ────────────────────────────────────────────────────

export const fetchPortfolios = () => async (dispatch: any) => {
  dispatch(fetchPortfoliosStart())
  try {
    const res = await finscreenClient.get('/portfolio')
    dispatch(fetchPortfoliosSuccess(res.data.portfolios))
  } catch (err: any) {
    const msg = err.response?.data?.detail?.message || err.message || 'Failed to fetch portfolios'
    dispatch(fetchPortfoliosFailure(msg))
  }
}

export const createPortfolio = (name: string) => async (dispatch: any) => {
  try {
    const res = await finscreenClient.post('/portfolio', { name })
    dispatch(createPortfolioSuccess(res.data.portfolio))
  } catch (err: any) {
    console.error('Failed to create portfolio:', err)
  }
}

export const deletePortfolio = (id: string) => async (dispatch: any) => {
  try {
    await finscreenClient.delete(`/portfolio/${id}`)
    dispatch(deletePortfolioSuccess(id))
  } catch (err: any) {
    console.error('Failed to delete portfolio:', err)
  }
}

export const fetchHoldings = (portfolioId: string) => async (dispatch: any) => {
  dispatch(fetchHoldingsStart())
  try {
    const res = await finscreenClient.get(`/portfolio/${portfolioId}/holdings`)
    dispatch(fetchHoldingsSuccess(res.data.holdings))
  } catch (err: any) {
    const msg = err.response?.data?.detail?.message || err.message || 'Failed to fetch holdings'
    dispatch(fetchHoldingsFailure(msg))
  }
}

export const addHolding = (
  portfolioId: string,
  holding: Omit<PortfolioHolding, 'id' | 'portfolioId' | 'createdAt'>
) => async (dispatch: any) => {
  try {
    const res = await finscreenClient.post(`/portfolio/${portfolioId}/holdings`, holding)
    dispatch(addHoldingSuccess(res.data.holding))
  } catch (err: any) {
    console.error('Failed to add holding:', err)
  }
}

export const updateHolding = (
  portfolioId: string,
  holdingId: string,
  updates: { quantity?: number; avgBuyPrice?: number }
) => async (dispatch: any) => {
  try {
    const res = await finscreenClient.put(`/portfolio/${portfolioId}/holdings/${holdingId}`, updates)
    dispatch(updateHoldingSuccess(res.data.holding))
  } catch (err: any) {
    console.error('Failed to update holding:', err)
  }
}

export const deleteHolding = (
  portfolioId: string,
  holdingId: string
) => async (dispatch: any) => {
  try {
    await finscreenClient.delete(`/portfolio/${portfolioId}/holdings/${holdingId}`)
    dispatch(deleteHoldingSuccess(holdingId))
  } catch (err: any) {
    console.error('Failed to delete holding:', err)
  }
}
