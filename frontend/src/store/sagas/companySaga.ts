/**
 * store/sagas/companySaga.ts
 * Redux-Saga for company data fetching and management
 */

import { call, put, takeLatest, all, retry, delay } from 'redux-saga/effects'
import {
  fetchCompanyStart,
  fetchCompanySuccess,
  fetchCompanyFailure,
  setFinancialsStatus,
  setPriceChartStatus,
  setShareholdingStatus,
} from '../slices/companySlice'
import { companies, type Company } from '@/lib/data/companies'

// Simulated API Calls
function fetchCompanyOverviewApi(symbol: string): Promise<Company> {
  return new Promise((resolve, reject) => {
    const company = companies.find((c) => c.symbol === symbol.toUpperCase())
    if (company) {
      resolve(company)
    } else {
      reject(new Error(`Company with symbol ${symbol} not found`))
    }
  })
}

function* fetchCompanyOverviewSaga(action: ReturnType<typeof fetchCompanyStart>) {
  const symbol = action.payload
  try {
    // Pattern 1: Fetch with retry + exponential backoff
    const data: Company = yield retry(3, 1000, fetchCompanyOverviewApi, symbol)
    yield put(fetchCompanySuccess(data))

    // Pattern 4: Parallel loading of company page sections (simulated)
    yield put(setFinancialsStatus('loading'))
    yield put(setPriceChartStatus('loading'))
    yield put(setShareholdingStatus('loading'))

    yield all([
      call(delay, 400), // Simulate network delay for chart
      call(delay, 600), // Simulate network delay for financials
      call(delay, 800), // Simulate network delay for shareholding
    ])

    yield put(setFinancialsStatus('success'))
    yield put(setPriceChartStatus('success'))
    yield put(setShareholdingStatus('success'))
  } catch (err: any) {
    yield put(fetchCompanyFailure(err.message || 'Failed to fetch company data'))
    yield put(setFinancialsStatus('error'))
    yield put(setPriceChartStatus('error'))
    yield put(setShareholdingStatus('error'))
  }
}

export function* companySaga() {
  yield takeLatest(fetchCompanyStart.type, fetchCompanyOverviewSaga)
}
