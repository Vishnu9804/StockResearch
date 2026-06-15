/**
 * store/sagas/companySaga.ts
 * Redux-Saga for company data fetching and management
 */

import { call, put, takeLatest, all, select } from 'redux-saga/effects'
import {
  fetchCompanyStart,
  fetchCompanySuccess,
  fetchCompanyFailure,
  setFinancialsStatus,
  setPriceChartStatus,
  setShareholdingStatus,
  fetchCompanyPLSuccess,
  fetchCompanyBalanceSheetSuccess,
  fetchCompanyCashFlowSuccess,
  fetchCompanySegmentsSuccess,
  fetchCompanyRatiosSuccess,
  fetchCompanyShareholdingSuccess,
  fetchCompanyCorporateActionsSuccess,
  fetchCompanyDocumentsSuccess,
  fetchCompanyFinancialsStart,
} from '../slices/companySlice'
import { finscreenApi } from '@/services/finscreenApi'

function* loadCompanyFinancialsSaga(symbol: string): Generator<any, void, any> {
  try {
    yield put(setFinancialsStatus('loading'))
    
    // Get statementType and period from Redux State
    const statementType = yield select((state: any) => state.company.statementType || 's')
    const period = yield select((state: any) => state.company.period || 'annual')
    const params = { statement_type: statementType, period }

    // Fetch statements in parallel
    const [pl, bs, cf, segments] = yield all([
      call(finscreenApi.fetchCompanyPL, symbol, params),
      call(finscreenApi.fetchCompanyBalanceSheet, symbol, params),
      call(finscreenApi.fetchCompanyCashFlow, symbol, params),
      call(finscreenApi.fetchCompanySegments, symbol, params),
    ])

    yield put(fetchCompanyPLSuccess(pl))
    yield put(fetchCompanyBalanceSheetSuccess(bs))
    yield put(fetchCompanyCashFlowSuccess(cf))
    yield put(fetchCompanySegmentsSuccess(segments))

    yield put(setFinancialsStatus('success'))
  } catch (err: any) {
    console.error('Failed to load company financials:', err)
    yield put(setFinancialsStatus('error'))
  }
}

function* loadCompanyRatiosSaga(symbol: string): Generator<any, void, any> {
  try {
    const ratios = yield call(finscreenApi.fetchCompanyRatios, symbol)
    yield put(fetchCompanyRatiosSuccess(ratios))
  } catch (err) {
    console.error('Failed to load company ratios:', err)
  }
}

function* loadCompanyShareholdingSaga(symbol: string): Generator<any, void, any> {
  try {
    yield put(setShareholdingStatus('loading'))
    const shareholding = yield call(finscreenApi.fetchCompanyShareholding, symbol)
    yield put(fetchCompanyShareholdingSuccess(shareholding))
    yield put(setShareholdingStatus('success'))
  } catch (err) {
    console.error('Failed to load company shareholding:', err)
    yield put(setShareholdingStatus('error'))
  }
}

function* loadCompanyCorporateActionsSaga(symbol: string): Generator<any, void, any> {
  try {
    const actions = yield call(finscreenApi.fetchCompanyCorporateActions, symbol)
    yield put(fetchCompanyCorporateActionsSuccess(actions))
  } catch (err) {
    console.error('Failed to load corporate actions:', err)
  }
}

function* loadCompanyDocumentsSaga(symbol: string): Generator<any, void, any> {
  try {
    const docs = yield call(finscreenApi.fetchCompanyDocuments, symbol)
    yield put(fetchCompanyDocumentsSuccess(docs))
  } catch (err) {
    console.error('Failed to load company documents:', err)
  }
}

function* fetchCompanyOverviewSaga(action: ReturnType<typeof fetchCompanyStart>): Generator<any, void, any> {
  const symbol = action.payload
  try {
    // 1. Fetch company profile (overview)
    const profile = yield call(finscreenApi.fetchCompanyProfile, symbol)
    yield put(fetchCompanySuccess(profile as any))

    // 2. Parallel loading of other segments
    yield all([
      call(loadCompanyFinancialsSaga, symbol),
      call(loadCompanyRatiosSaga, symbol),
      call(loadCompanyShareholdingSaga, symbol),
      call(loadCompanyCorporateActionsSaga, symbol),
      call(loadCompanyDocumentsSaga, symbol),
      put(setPriceChartStatus('success')), // price chart status is updated
    ])
  } catch (err: any) {
    console.error('Failed to fetch company overview:', err)
    yield put(fetchCompanyFailure(err.message || 'Failed to fetch company data'))
    yield put(setFinancialsStatus('error'))
    yield put(setPriceChartStatus('error'))
    yield put(setShareholdingStatus('error'))
  }
}

function* fetchCompanyFinancialsSaga(action: ReturnType<typeof fetchCompanyFinancialsStart>): Generator<any, void, any> {
  const symbol = action.payload
  yield call(loadCompanyFinancialsSaga, symbol)
}

export function* companySaga(): Generator<any, void, any> {
  yield all([
    takeLatest(fetchCompanyStart.type, fetchCompanyOverviewSaga),
    takeLatest(fetchCompanyFinancialsStart.type, fetchCompanyFinancialsSaga),
  ])
}
