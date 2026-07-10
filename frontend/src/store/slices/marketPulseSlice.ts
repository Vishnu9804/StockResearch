/**
 * store/slices/marketPulseSlice.ts
 *
 * Centralised Redux slice for all Market Pulse & Market Feed paginated lists.
 * Each sub-state follows the same PaginatedList<T> shape.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// ── Generic helpers ──────────────────────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface PaginatedList<T = any> {
  items: T[]
  total: number
  page: number
  limit: number
  status: LoadStatus
  error: string | null
}

export interface FetchParams {
  page?: number
  limit?: number
  [key: string]: any
}

export interface PageResult {
  items: any[]
  total: number
  page: number
  limit: number
}

function makeList(limit = 50): PaginatedList {
  return { items: [], total: 0, page: 1, limit, status: 'idle', error: null }
}

// ── State ────────────────────────────────────────────────────────────────────

export interface MarketPulseState {
  announcements: PaginatedList
  bulkDeals:     PaginatedList
  blockDeals:    PaginatedList
  sastTrades:    PaginatedList
  insiderTrades: PaginatedList
  dividends:     PaginatedList
  concalls:      PaginatedList
  annualReports: PaginatedList
}

const initialState: MarketPulseState = {
  announcements: makeList(50),
  bulkDeals:     makeList(15),
  blockDeals:    makeList(15),
  sastTrades:    makeList(15),
  insiderTrades: makeList(15),
  dividends:     makeList(15),
  concalls:      makeList(15),
  annualReports: makeList(15),
}

// ── Helpers for reducers ─────────────────────────────────────────────────────

type ListKey = keyof MarketPulseState

function setLoading(state: MarketPulseState, key: ListKey, action: PayloadAction<FetchParams>) {
  state[key].status = 'loading'
  state[key].error  = null
  if (action.payload.page  !== undefined) state[key].page  = action.payload.page
  if (action.payload.limit !== undefined) state[key].limit = action.payload.limit
}

function setSuccess(state: MarketPulseState, key: ListKey, action: PayloadAction<PageResult>) {
  const p = action.payload
  state[key].items  = p.items
  state[key].total  = p.total
  state[key].page   = p.page
  state[key].limit  = p.limit
  state[key].status = 'success'
  state[key].error  = null
}

function setFailure(state: MarketPulseState, key: ListKey, action: PayloadAction<string>) {
  state[key].status = 'error'
  state[key].error  = action.payload
}

// ── Slice ────────────────────────────────────────────────────────────────────

const marketPulseSlice = createSlice({
  name: 'marketPulse',
  initialState,
  reducers: {
    // ── Announcements ──────────────────────────────────────────────────────
    fetchAnnouncementsStart:   (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'announcements', a),
    fetchAnnouncementsSuccess: (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'announcements', a),
    fetchAnnouncementsFailure: (s, a: PayloadAction<string>)       => setFailure(s, 'announcements', a),
    // ── Bulk Deals ─────────────────────────────────────────────────────────
    fetchBulkDealsStart:       (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'bulkDeals', a),
    fetchBulkDealsSuccess:     (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'bulkDeals', a),
    fetchBulkDealsFailure:     (s, a: PayloadAction<string>)       => setFailure(s, 'bulkDeals', a),
    // ── Block Deals ────────────────────────────────────────────────────────
    fetchBlockDealsStart:      (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'blockDeals', a),
    fetchBlockDealsSuccess:    (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'blockDeals', a),
    fetchBlockDealsFailure:    (s, a: PayloadAction<string>)       => setFailure(s, 'blockDeals', a),
    // ── SAST Trades ────────────────────────────────────────────────────────
    fetchSastTradesStart:      (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'sastTrades', a),
    fetchSastTradesSuccess:    (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'sastTrades', a),
    fetchSastTradesFailure:    (s, a: PayloadAction<string>)       => setFailure(s, 'sastTrades', a),
    // ── Insider Trades ─────────────────────────────────────────────────────
    fetchInsiderTradesStart:   (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'insiderTrades', a),
    fetchInsiderTradesSuccess: (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'insiderTrades', a),
    fetchInsiderTradesFailure: (s, a: PayloadAction<string>)       => setFailure(s, 'insiderTrades', a),
    // ── Dividends ──────────────────────────────────────────────────────────
    fetchDividendsStart:       (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'dividends', a),
    fetchDividendsSuccess:     (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'dividends', a),
    fetchDividendsFailure:     (s, a: PayloadAction<string>)       => setFailure(s, 'dividends', a),
    // ── Concalls ───────────────────────────────────────────────────────────
    fetchConcallsStart:        (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'concalls', a),
    fetchConcallsSuccess:      (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'concalls', a),
    fetchConcallsFailure:      (s, a: PayloadAction<string>)       => setFailure(s, 'concalls', a),
    // ── Annual Reports ─────────────────────────────────────────────────────
    fetchAnnualReportsStart:   (s, a: PayloadAction<FetchParams>)  => setLoading(s, 'annualReports', a),
    fetchAnnualReportsSuccess: (s, a: PayloadAction<PageResult>)   => setSuccess(s, 'annualReports', a),
    fetchAnnualReportsFailure: (s, a: PayloadAction<string>)       => setFailure(s, 'annualReports', a),
  },
})

export const {
  fetchAnnouncementsStart,  fetchAnnouncementsSuccess,  fetchAnnouncementsFailure,
  fetchBulkDealsStart,      fetchBulkDealsSuccess,      fetchBulkDealsFailure,
  fetchBlockDealsStart,     fetchBlockDealsSuccess,     fetchBlockDealsFailure,
  fetchSastTradesStart,     fetchSastTradesSuccess,     fetchSastTradesFailure,
  fetchInsiderTradesStart,  fetchInsiderTradesSuccess,  fetchInsiderTradesFailure,
  fetchDividendsStart,      fetchDividendsSuccess,      fetchDividendsFailure,
  fetchConcallsStart,       fetchConcallsSuccess,       fetchConcallsFailure,
  fetchAnnualReportsStart,  fetchAnnualReportsSuccess,  fetchAnnualReportsFailure,
} = marketPulseSlice.actions

export const marketPulseReducer = marketPulseSlice.reducer
