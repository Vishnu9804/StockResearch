/**
 * store/slices/watchlistSlice.ts
 * Redux slice for user watchlists
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface WatchlistItem {
  symbol: string
  name: string
  sector: string
  targetPrice: number | null
  alertEnabled: boolean
  alertAbove: number | null
  alertBelow: number | null
  addedAt: string   // ISO timestamp
  notes: string
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

const DEFAULT_WATCHLIST_ID = 'default'

const initialState: WatchlistState = {
  watchlists: [
    {
      id: 'wl1',
      name: 'My Watchlist',
      createdAt: new Date().toISOString(),
      items: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd',
          sector: 'Energy',
          targetPrice: 3200,
          alertEnabled: true,
          alertAbove: 3200,
          alertBelow: 2600,
          addedAt: new Date().toISOString(),
          notes: 'Diversified conglomerate',
        },
        {
          symbol: 'INFY',
          name: 'Infosys Ltd',
          sector: 'Information Technology',
          targetPrice: 1400,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'IT leader',
        },
        {
          symbol: 'HDFCBANK',
          name: 'HDFC Bank Ltd',
          sector: 'Financial Services',
          targetPrice: 1900,
          alertEnabled: true,
          alertAbove: 1900,
          alertBelow: 1500,
          addedAt: new Date().toISOString(),
          notes: 'Banking leader',
        },
        {
          symbol: 'TCS',
          name: 'Tata Consultancy Services Ltd',
          sector: 'Information Technology',
          targetPrice: 4200,
          alertEnabled: true,
          alertAbove: 4200,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'IT services',
        },
        {
          symbol: 'ITC',
          name: 'ITC Ltd',
          sector: 'Consumer Goods',
          targetPrice: 430,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'Conglomerate',
        },
        {
          symbol: 'NESTLEIND',
          name: 'Nestle India Ltd',
          sector: 'Consumer Goods',
          targetPrice: 2500,
          alertEnabled: true,
          alertAbove: 2500,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'FMCG leader',
        },
        {
          symbol: 'MARUTI',
          name: 'Maruti Suzuki India Ltd',
          sector: 'Automobile',
          targetPrice: 12000,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'Auto leader',
        },
        {
          symbol: 'TITAN',
          name: 'Titan Company Ltd',
          sector: 'Consumer Goods',
          targetPrice: 3600,
          alertEnabled: true,
          alertAbove: 3600,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: 'Retail',
        },
      ],
    },
    {
      id: 'wl2',
      name: 'Tech Stocks',
      createdAt: new Date().toISOString(),
      items: [
        {
          symbol: 'INFY',
          name: 'Infosys Ltd',
          sector: 'Information Technology',
          targetPrice: 1650,
          alertEnabled: true,
          alertAbove: 1650,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'TCS',
          name: 'Tata Consultancy Services Ltd',
          sector: 'Information Technology',
          targetPrice: 4100,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'WIPRO',
          name: 'Wipro Ltd',
          sector: 'Information Technology',
          targetPrice: 500,
          alertEnabled: true,
          alertAbove: 500,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'HCLTECH',
          name: 'HCL Technologies Ltd',
          sector: 'Information Technology',
          targetPrice: 1700,
          alertEnabled: true,
          alertAbove: 1700,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
      ],
    },
    {
      id: 'wl3',
      name: 'High Dividend',
      createdAt: new Date().toISOString(),
      items: [
        {
          symbol: 'ITC',
          name: 'ITC Ltd',
          sector: 'Consumer Goods',
          targetPrice: 480,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'HCLTECH',
          name: 'HCL Technologies Ltd',
          sector: 'Information Technology',
          targetPrice: 1700,
          alertEnabled: true,
          alertAbove: 1700,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'HINDUNILVR',
          name: 'Hindustan Unilever Ltd',
          sector: 'Consumer Goods',
          targetPrice: 2600,
          alertEnabled: false,
          alertAbove: null,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
        {
          symbol: 'NESTLEIND',
          name: 'Nestle India Ltd',
          sector: 'Consumer Goods',
          targetPrice: 2400,
          alertEnabled: true,
          alertAbove: 2400,
          alertBelow: null,
          addedAt: new Date().toISOString(),
          notes: '',
        },
      ],
    },
  ],
  activeWatchlistId: 'wl1',
  status: 'idle',
  error: null,
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    // ─── Watchlist CRUD ──────────────────────────────────────────────────
    createWatchlist(state, action: PayloadAction<{ name: string }>) {
      const newWatchlist: Watchlist = {
        id: generateId(),
        name: action.payload.name,
        items: [],
        createdAt: new Date().toISOString(),
      }
      state.watchlists.push(newWatchlist)
      state.activeWatchlistId = newWatchlist.id
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
        state.activeWatchlistId = state.watchlists[0]?.id ?? DEFAULT_WATCHLIST_ID
      }
    },
    setActiveWatchlist(state, action: PayloadAction<string>) {
      state.activeWatchlistId = action.payload
    },

    // ─── Item management ─────────────────────────────────────────────────
    addToWatchlist(
      state,
      action: PayloadAction<{
        watchlistId?: string
        item: Omit<WatchlistItem, 'addedAt' | 'alertEnabled' | 'alertAbove' | 'alertBelow' | 'notes' | 'targetPrice'>
      }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        const exists = wl.items.some((i) => i.symbol === action.payload.item.symbol)
        if (!exists) {
          wl.items.push({
            ...action.payload.item,
            targetPrice: null,
            alertEnabled: false,
            alertAbove: null,
            alertBelow: null,
            addedAt: new Date().toISOString(),
            notes: '',
          })
        }
      }
    },
    removeFromWatchlist(
      state,
      action: PayloadAction<{ watchlistId?: string; symbol: string }>
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
    setAlertBounds(
      state,
      action: PayloadAction<{
        symbol: string
        alertAbove: number | null
        alertBelow: number | null
        watchlistId?: string
      }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        const item = wl.items.find((i) => i.symbol === action.payload.symbol)
        if (item) {
          item.alertAbove = action.payload.alertAbove
          item.alertBelow = action.payload.alertBelow
        }
      }
    },
    setItemNotes(
      state,
      action: PayloadAction<{ symbol: string; notes: string; watchlistId?: string }>
    ) {
      const wlId = action.payload.watchlistId ?? state.activeWatchlistId
      const wl = state.watchlists.find((w) => w.id === wlId)
      if (wl) {
        const item = wl.items.find((i) => i.symbol === action.payload.symbol)
        if (item) {
          item.notes = action.payload.notes
        }
      }
    },

    // ─── Hydrate from localStorage ────────────────────────────────────────
    hydrateWatchlists(state, action: PayloadAction<WatchlistState>) {
      state.watchlists = action.payload.watchlists
      state.activeWatchlistId = action.payload.activeWatchlistId
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
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  setActiveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  setAlertBounds,
  setItemNotes,
  hydrateWatchlists,
  setStatus,
  setError,
} = watchlistSlice.actions

export const watchlistReducer = watchlistSlice.reducer
