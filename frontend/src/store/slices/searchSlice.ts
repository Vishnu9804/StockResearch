/**
 * store/slices/searchSlice.ts
 * Global search state: recent searches, open state
 */

import { createSlice } from '@reduxjs/toolkit'

interface SearchState {
  recentSearches: string[]
  isOpen: boolean
}

const initialState: SearchState = {
  recentSearches: [],
  isOpen: false,
}

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setSearchOpen(state, action: { payload: boolean }) {
      state.isOpen = action.payload
    },
    addRecentSearch(state, action: { payload: string }) {
      const filtered = state.recentSearches.filter((s) => s !== action.payload)
      state.recentSearches = [action.payload, ...filtered].slice(0, 5)
    },
    clearRecentSearches(state) {
      state.recentSearches = []
    },
  },
})

export const { setSearchOpen, addRecentSearch, clearRecentSearches } = searchSlice.actions
export default searchSlice.reducer
