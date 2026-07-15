/**
 * store/slices/screenerSlice.ts
 * Redux slice for the stock screener
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type FilterOperator =
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'between'
  | 'in'

export interface FilterRow {
  id: string
  variableId: string
  operator: FilterOperator
  value: number
  value2?: number  // used for 'between' operator
}

export interface ScreenerResult {
  symbol: string
  name: string
  sector: string
  marketCap: number
  pe: number
  pb: number
  dividendYield: number
  roe: number
  roce: number
  debtToEquity: number
  salesGrowth3Y: number
  profitGrowth3Y: number
  netProfitMargin: number
  ebitdaMargin: number
  promoterHolding: number
  fiiHolding: number
  currentRatio: number
  interestCoverage: number
  cmp: number
  changePct: number
  high52w: number
  low52w: number
  eps: number
  bookValue: number
  rsi14: number
  beta: number
}

export type ScreenerStatus = 'idle' | 'validating' | 'loading' | 'success' | 'error'

export interface SectorBreakdownEntry {
  sector: string
  count: number
  pct: number
}

export interface StatCoverage {
  available: number
  missing: number
}

export interface ScreenerAggregates {
  avgPE: number | null
  avgPECoverage: StatCoverage
  totalMarketCap: number | null
  totalMarketCapCoverage: StatCoverage
  medianROCE: number | null
  medianROCECoverage: StatCoverage
  sectorBreakdown: SectorBreakdownEntry[]
  sectorCoverage: StatCoverage
}

export interface ScreenerState {
  filters: FilterRow[]
  results: ScreenerResult[]
  status: ScreenerStatus
  error: string | null
  totalCount: number
  page: number
  pageSize: number
  queryText: string
  queryValid: boolean
  queryError: string | null
  sortBy: keyof ScreenerResult | null
  sortOrder: 'asc' | 'desc'
  activeTemplateId: string | null
  aggregates: ScreenerAggregates | null
}

const initialState: ScreenerState = {
  filters: [],
  results: [],
  status: 'idle',
  error: null,
  totalCount: 0,
  page: 1,
  pageSize: 25,
  queryText: '',
  queryValid: true,
  queryError: null,
  sortBy: 'marketCap',
  sortOrder: 'desc',
  activeTemplateId: null,
  aggregates: null,
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const screenerSlice = createSlice({
  name: 'screener',
  initialState,
  reducers: {
    // ─── Filter management ───────────────────────────────────────────────
    addFilter(state, action: PayloadAction<Omit<FilterRow, 'id'>>) {
      state.filters.push({ ...action.payload, id: generateId() })
    },
    removeFilter(state, action: PayloadAction<string>) {
      state.filters = state.filters.filter((f) => f.id !== action.payload)
    },
    updateFilter(state, action: PayloadAction<FilterRow>) {
      const idx = state.filters.findIndex((f) => f.id === action.payload.id)
      if (idx !== -1) {
        state.filters[idx] = action.payload
      }
    },
    clearFilters(state) {
      state.filters = []
      state.queryText = ''
      state.queryValid = true
      state.queryError = null
      state.results = []
      state.totalCount = 0
      state.status = 'idle'
      state.activeTemplateId = null
    },

    // ─── Query text ──────────────────────────────────────────────────────
    setQuery(state, action: PayloadAction<string>) {
      state.queryText = action.payload
      state.queryValid = true
      state.queryError = null
    },
    setQueryValid(state, action: PayloadAction<{ valid: boolean; error?: string }>) {
      state.queryValid = action.payload.valid
      state.queryError = action.payload.error ?? null
    },

    // ─── Run screener ────────────────────────────────────────────────────
    runScreenerStart(state, action: PayloadAction<{ query?: string } | undefined>) {
      state.status = 'loading'
      state.error = null
      state.page = 1
      if (action.payload?.query) {
        state.queryText = action.payload.query
      }
    },
    runScreenerSuccess(
      state,
      action: PayloadAction<{ results: ScreenerResult[]; totalCount: number; aggregates?: ScreenerAggregates | null }>
    ) {
      state.results = action.payload.results
      state.totalCount = action.payload.totalCount
      state.aggregates = action.payload.aggregates ?? null
      state.status = 'success'
      state.error = null
    },
    runScreenerFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },

    // ─── Pagination ──────────────────────────────────────────────────────
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload
      state.page = 1
    },

    // ─── Sorting ─────────────────────────────────────────────────────────
    setSortBy(
      state,
      action: PayloadAction<{ column: keyof ScreenerResult; order: 'asc' | 'desc' }>
    ) {
      state.sortBy = action.payload.column
      state.sortOrder = action.payload.order
    },

    // ─── Templates ───────────────────────────────────────────────────────
    setActiveTemplate(state, action: PayloadAction<string | null>) {
      state.activeTemplateId = action.payload
    },
  },
})

export const {
  addFilter,
  removeFilter,
  updateFilter,
  clearFilters,
  setQuery,
  setQueryValid,
  runScreenerStart,
  runScreenerSuccess,
  runScreenerFailure,
  setPage,
  setPageSize,
  setSortBy,
  setActiveTemplate,
} = screenerSlice.actions

export const screenerReducer = screenerSlice.reducer
