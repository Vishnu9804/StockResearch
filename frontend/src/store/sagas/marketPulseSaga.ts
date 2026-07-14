import { call, put, takeLatest, all, select } from 'redux-saga/effects'
import type { PayloadAction } from '@reduxjs/toolkit'
import { finscreenClient } from '../../services/finscreenApi'
import type { FetchParams, PageResult } from '../slices/marketPulseSlice'
import {
  fetchAnnouncementsStart,
  fetchAnnouncementsSuccess,
  fetchAnnouncementsFailure,
  fetchBulkDealsStart,
  fetchBulkDealsSuccess,
  fetchBulkDealsFailure,
  fetchBlockDealsStart,
  fetchBlockDealsSuccess,
  fetchBlockDealsFailure,
  fetchSastTradesStart,
  fetchSastTradesSuccess,
  fetchSastTradesFailure,
  fetchInsiderTradesStart,
  fetchInsiderTradesSuccess,
  fetchInsiderTradesFailure,
  fetchDividendsStart,
  fetchDividendsSuccess,
  fetchDividendsFailure,
  fetchConcallsStart,
  fetchConcallsSuccess,
  fetchConcallsFailure,
  fetchAnnualReportsStart,
  fetchAnnualReportsSuccess,
  fetchAnnualReportsFailure,
} from '../slices/marketPulseSlice'

function normaliseResponse(raw: any, page: number, limit: number): PageResult {
  if (!raw) return { items: [], total: 0, page, limit }
  
  // If it's the new paginated wrapper format: {"items": [...], "total": 10}
  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    return { 
      items: raw.items, 
      total: raw.total ?? raw.items.length, 
      page: raw.page ?? page, 
      limit: raw.limit ?? limit 
    }
  }
  
  // If it's a raw legacy array: [...]
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length, page, limit }
  }
  
  return { items: [], total: 0, page, limit }
}

type StartAction = PayloadAction<FetchParams>
type SuccessCreator = (p: PageResult) => any
type FailureCreator = (msg: string) => any

function makeWorker(
  endpoint: string,
  successAction: SuccessCreator,
  failureAction: FailureCreator,
  stateKey: string
) {
  return function* worker(action: StartAction): Generator<any, void, any> {
    try {
      // FIX: Added '|| {}' to prevent undefined crashes on initial load
      const params: FetchParams = action.payload || {} 
      const page = params.page ?? 1
      const limit: number = params.limit ?? (yield select((s: any) => s.marketPulse[stateKey].limit))
      
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

const fetchAnnouncementsWorker = makeWorker('/market/announcements', fetchAnnouncementsSuccess, fetchAnnouncementsFailure, 'announcements')
const fetchBulkDealsWorker = makeWorker('/market/bulk-deals', fetchBulkDealsSuccess, fetchBulkDealsFailure, 'bulkDeals')
const fetchBlockDealsWorker = makeWorker('/market/block-deals', fetchBlockDealsSuccess, fetchBlockDealsFailure, 'blockDeals')
const fetchSastTradesWorker = makeWorker('/market/sast-trades', fetchSastTradesSuccess, fetchSastTradesFailure, 'sastTrades')
const fetchInsiderTradesWorker = makeWorker('/market/insider-trades', fetchInsiderTradesSuccess, fetchInsiderTradesFailure, 'insiderTrades')
const fetchDividendsWorker = makeWorker('/market/dividends', fetchDividendsSuccess, fetchDividendsFailure, 'dividends')
const fetchConcallsWorker = makeWorker('/market/concalls', fetchConcallsSuccess, fetchConcallsFailure, 'concalls')
const fetchAnnualReportsWorker = makeWorker('/market/annual-reports', fetchAnnualReportsSuccess, fetchAnnualReportsFailure, 'annualReports')

export function* marketPulseSaga(): Generator<any, void, any> {
  yield all([
    takeLatest(fetchAnnouncementsStart.type, fetchAnnouncementsWorker),
    takeLatest(fetchBulkDealsStart.type, fetchBulkDealsWorker),
    takeLatest(fetchBlockDealsStart.type, fetchBlockDealsWorker),
    takeLatest(fetchSastTradesStart.type, fetchSastTradesWorker),
    takeLatest(fetchInsiderTradesStart.type, fetchInsiderTradesWorker),
    takeLatest(fetchDividendsStart.type, fetchDividendsWorker),
    takeLatest(fetchConcallsStart.type, fetchConcallsWorker),
    takeLatest(fetchAnnualReportsStart.type, fetchAnnualReportsWorker),
  ])
}
export default marketPulseSaga;