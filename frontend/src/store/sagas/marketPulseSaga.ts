/**
 * store/sagas/marketPulseSaga.ts
 *
 * Redux-Saga workers for all paginated Market Pulse lists.
 * Each worker:
 *   1. Receives a FetchParams payload (page, limit + any filter keys).
 *   2. Calls the backend proxy through finscreenClient.
 *   3. Normalises the response — the backend now returns
 *        { items, total, page, limit }  when ?page or ?limit is present,
 *        or a raw array otherwise (legacy).
 *   4. Dispatches the matching Success / Failure action.
 */
import { call, put, takeLatest, all, select } from 'redux-saga/effects'
import type { PayloadAction } from '@reduxjs/toolkit'
import { finscreenClient } from '@/services/finscreenApi'
import type { FetchParams, PageResult } from '../slices/marketPulseSlice'
import {
  fetchAnnouncementsStart,   fetchAnnouncementsSuccess,   fetchAnnouncementsFailure,
  fetchBulkDealsStart,       fetchBulkDealsSuccess,       fetchBulkDealsFailure,
  fetchBlockDealsStart,      fetchBlockDealsSuccess,      fetchBlockDealsFailure,
  fetchSastTradesStart,      fetchSastTradesSuccess,      fetchSastTradesFailure,
  fetchInsiderTradesStart,   fetchInsiderTradesSuccess,   fetchInsiderTradesFailure,
  fetchDividendsStart,       fetchDividendsSuccess,       fetchDividendsFailure,
  fetchConcallsStart,        fetchConcallsSuccess,        fetchConcallsFailure,
  fetchAnnualReportsStart,   fetchAnnualReportsSuccess,   fetchAnnualReportsFailure,
} from '../slices/marketPulseSlice'

// ── Normalise whatever the backend returns ───────────────────────────────────

function normaliseResponse(raw: any, page: number, limit: number): PageResult {
  if (Array.isArray(raw)) {
    // Legacy: no pagination envelope — return everything
    return { items: raw, total: raw.length, page, limit }
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    return { items: raw.items, total: raw.total ?? raw.items.length, page: raw.page ?? page, limit: raw.limit ?? limit }
  }
  return { items: [], total: 0, page, limit }
}

// ── Type aliases for cleaner code ─────────────────────────────────────────────

type StartAction = PayloadAction<FetchParams>
type SuccessCreator = (p: PageResult) => any
type FailureCreator = (msg: string) => any

// ── Generic worker factory ───────────────────────────────────────────────────

function makeWorker(
  endpoint: string,
  successAction: SuccessCreator,
  failureAction: FailureCreator,
  stateKey: string,
) {
  return function* worker(action: StartAction): Generator<any, void, any> {
    try {
      const params: FetchParams = action.payload
      const page  = params.page  ?? 1
      const limit: number = params.limit ?? (yield select((s: any) => s.marketPulse[stateKey].limit))

      // Build query string — strip undefined values
      const qs: Record<string, any> = { page, limit }
      for (const [k, v] of Object.entries(params)) {
        if (k !== 'page' && k !== 'limit' && v !== undefined) qs[k] = v
      }

      const res: any = yield call([finscreenClient, finscreenClient.get], endpoint, { params: qs })
      const data = normaliseResponse(res.data, page, limit)
      yield put(successAction(data))
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load data'
      yield put(failureAction(msg))
    }
  }
}

// ── Workers ──────────────────────────────────────────────────────────────────

const fetchAnnouncementsWorker = makeWorker(
  '/market/announcements', fetchAnnouncementsSuccess, fetchAnnouncementsFailure, 'announcements',
)
const fetchBulkDealsWorker = makeWorker(
  '/market/bulk-deals', fetchBulkDealsSuccess, fetchBulkDealsFailure, 'bulkDeals',
)
const fetchBlockDealsWorker = makeWorker(
  '/market/block-deals', fetchBlockDealsSuccess, fetchBlockDealsFailure, 'blockDeals',
)
const fetchSastTradesWorker = makeWorker(
  '/market/sast-trades', fetchSastTradesSuccess, fetchSastTradesFailure, 'sastTrades',
)
const fetchInsiderTradesWorker = makeWorker(
  '/market/insider-trades', fetchInsiderTradesSuccess, fetchInsiderTradesFailure, 'insiderTrades',
)
const fetchDividendsWorker = makeWorker(
  '/market/dividends', fetchDividendsSuccess, fetchDividendsFailure, 'dividends',
)
const fetchConcallsWorker = makeWorker(
  '/market/concalls', fetchConcallsSuccess, fetchConcallsFailure, 'concalls',
)
const fetchAnnualReportsWorker = makeWorker(
  '/market/annual-reports', fetchAnnualReportsSuccess, fetchAnnualReportsFailure, 'annualReports',
)

// ── Root watcher ─────────────────────────────────────────────────────────────

export function* marketPulseSaga(): Generator<any, void, any> {
  yield all([
    takeLatest(fetchAnnouncementsStart.type,  fetchAnnouncementsWorker),
    takeLatest(fetchBulkDealsStart.type,      fetchBulkDealsWorker),
    takeLatest(fetchBlockDealsStart.type,     fetchBlockDealsWorker),
    takeLatest(fetchSastTradesStart.type,     fetchSastTradesWorker),
    takeLatest(fetchInsiderTradesStart.type,  fetchInsiderTradesWorker),
    takeLatest(fetchDividendsStart.type,      fetchDividendsWorker),
    takeLatest(fetchConcallsStart.type,       fetchConcallsWorker),
    takeLatest(fetchAnnualReportsStart.type,  fetchAnnualReportsWorker),
  ])
}
