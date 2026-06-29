/**
 * store/slices/searchSlice.ts
 * Global search state: recent searches, open state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { finscreenClient } from '@/services/finscreenApi'

interface SearchState {
  recentSearches: string[]
  isOpen: boolean
  symbols: any[]
  loading: boolean
  error: string | null
}

const initialState: SearchState = {
  recentSearches: [],
  isOpen: false,
  symbols: [],
  loading: false,
  error: null,
}

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload
    },
    addRecentSearch(state, action: PayloadAction<string>) {
      const filtered = state.recentSearches.filter((s) => s !== action.payload)
      state.recentSearches = [action.payload, ...filtered].slice(0, 5)
    },
    clearRecentSearches(state) {
      state.recentSearches = []
    },
    fetchSymbolsStart(state) {
      state.loading = true
      state.error = null
    },
    fetchSymbolsSuccess(state, action: PayloadAction<any[]>) {
      state.loading = false
      state.symbols = action.payload
    },
    fetchSymbolsFailure(state, action: PayloadAction<string>) {
      state.loading = false
      state.error = action.payload
    },
  },
})

export const {
  setSearchOpen,
  addRecentSearch,
  clearRecentSearches,
  fetchSymbolsStart,
  fetchSymbolsSuccess,
  fetchSymbolsFailure
} = searchSlice.actions

export const fetchStockSymbols = () => async (dispatch: any, getState: any) => {
  const { search } = getState()
  if (search.symbols.length > 0) return // Already cached
  dispatch(fetchSymbolsStart())
  try {
    const res = await finscreenClient.get('/stock-symbols')
    // Ensure it's an array
    const data = Array.isArray(res.data) ? res.data : []
    dispatch(fetchSymbolsSuccess(data))
  } catch (err: any) {
    console.error('Failed to fetch stock symbols:', err)
    dispatch(fetchSymbolsFailure(err.message || 'Failed to fetch symbols'))
  }
}

export default searchSlice.reducer

