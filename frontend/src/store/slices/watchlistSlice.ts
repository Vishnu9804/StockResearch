/**
 * store/slices/watchlistSlice.ts
 * Redux slice for user watchlists
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface WatchlistItem {
  id: string
  symbol: string
  companyName: string
  targetPrice: number | null
  alertEnabled: boolean
  addedAt: string
}

export interface Watchlist {
  id: string
  name: string
  items: WatchlistItem[]
  createdAt: string
}

export type WatchlistStatus = 'idle' | 'loading' | 'success' | 'error'

export interface WatchlistState {
  watchlists: Watchlist[]
  activeWatchlistId: string
  status: WatchlistStatus
  error: string | null
}

const initialState: WatchlistState = {
  watchlists: [],
  activeWatchlistId: '',
  status: 'idle',
  error: null,
}

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    // ─── Fetch ───────────────────────────────────────────────────────────
    fetchWatchlistsStart() {
      // handled by saga; type string is 'watchlist/fetchWatchlistsStart'
    },

    // ─── Watchlist CRUD ──────────────────────────────────────────────────
    createWatchlist(_state, _action: PayloadAction<{ name: string }>) {
      // handled by saga (needs server-generated id)
    },
    renameWatchlist(state, action: PayloadAction<{ id: string; name: string }>) {
      const wl = state.watchlists.find((w) => w.id === action.payload.id)
      if (wl) {
        wl.name = action.payload.name
      }
    },
    deleteWatchlist(state, action: PayloadAction<string>) {
      state.watchlists = state.watchlists.filter((w) => w.id !== action.payload)
      if (state.activeWatchlistId === action.payload) {
        state.activeWatchlistId = state.watchlists[0]?.id ?? ''
      }
    },
    setActiveWatchlist(state, action: PayloadAction<string>) {
      state.activeWatchlistId = action.payload
    },

    // ─── Item management ─────────────────────────────────────────────────
    addToWatchlist(
      _state,
      _action: PayloadAction<{ watchlistId?: string; symbol: string; companyName?: string }>
    ) {
      // handled by saga (needs server-generated item id)
    },
    removeFromWatchlist(
      state,
      action: PayloadAction<{ watchlistId?: string; symbol: string; itemId?: string }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        wl.items = wl.items.filter((i) => i.symbol !== action.payload.symbol)
      }
    },
    setTargetPrice(
      state,
      action: PayloadAction<{ symbol: string; price: number | null; watchlistId?: string }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        const item = wl.items.find((i) => i.symbol === action.payload.symbol)
        if (item) {
          item.targetPrice = action.payload.price
        }
      }
    },
    toggleAlert(
      state,
      action: PayloadAction<{ symbol: string; watchlistId?: string }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        const item = wl.items.find((i) => i.symbol === action.payload.symbol)
        if (item) {
          item.alertEnabled = !item.alertEnabled
        }
      }
    },

    // ─── Move between collections ───────────────────────────────────────
    moveItemRequest(
      _state,
      _action: PayloadAction<{ itemId: string; symbol: string; fromWatchlistId: string; toWatchlistId: string }>
    ) {
      // handled by saga
    },
    moveItemLocally(
      state,
      action: PayloadAction<{ itemId: string; fromWatchlistId: string; toWatchlistId: string }>
    ) {
      const from = state.watchlists.find((w) => w.id === action.payload.fromWatchlistId)
      const to = state.watchlists.find((w) => w.id === action.payload.toWatchlistId)
      if (!from || !to) return
      const idx = from.items.findIndex((i) => i.id === action.payload.itemId)
      if (idx === -1) return
      const [item] = from.items.splice(idx, 1)
      to.items.push(item)
    },

    // ─── Quick watch/unwatch (company page "Watch" button) ──────────────
    quickWatch(_state, _action: PayloadAction<{ symbol: string; companyName?: string }>) {
      // handled by saga
    },
    quickUnwatch(_state, _action: PayloadAction<string>) {
      // handled by saga
    },
    upsertWatchedSymbol(
      state,
      action: PayloadAction<{ watchlist: { id: string; name: string; createdAt: string }; item: WatchlistItem }>
    ) {
      let wl = state.watchlists.find((w) => w.id === action.payload.watchlist.id)
      if (!wl) {
        wl = { id: action.payload.watchlist.id, name: action.payload.watchlist.name, createdAt: action.payload.watchlist.createdAt, items: [] }
        state.watchlists.push(wl)
      }
      const exists = wl.items.some((i) => i.id === action.payload.item.id)
      if (!exists) {
        wl.items.push(action.payload.item)
      }
    },
    removeSymbolEverywhere(state, action: PayloadAction<string>) {
      for (const wl of state.watchlists) {
        wl.items = wl.items.filter((i) => i.symbol !== action.payload)
      }
    },

    // ─── Hydrate from server fetch ───────────────────────────────────────
    hydrateWatchlists(state, action: PayloadAction<WatchlistState>) {
      state.watchlists = action.payload.watchlists
      state.activeWatchlistId = action.payload.activeWatchlistId
      state.status = action.payload.status
      state.error = action.payload.error
    },

    setStatus(state, action: PayloadAction<WatchlistStatus>) {
      state.status = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const {
  fetchWatchlistsStart,
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  setActiveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  moveItemRequest,
  moveItemLocally,
  quickWatch,
  quickUnwatch,
  upsertWatchedSymbol,
  removeSymbolEverywhere,
  hydrateWatchlists,
  setStatus,
  setError,
} = watchlistSlice.actions

export const watchlistReducer = watchlistSlice.reducer
