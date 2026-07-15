import { call, put, takeEvery, take, race } from 'redux-saga/effects'
import { PortfolioService } from '../../services/portfolio'
import { fetchPortfoliosStart, hydratePortfolios, setStatus, setError } from '../slices/portfolioSlice'
import { checkAuthSuccess, loginSuccess, logoutSuccess } from '../slices/authSlice'

function mapHoldings(holdings: any[]) {
  return holdings.map((h: any) => ({
    id: h.id,
    portfolioId: h.portfolioId,
    symbol: h.symbol,
    companyName: h.companyName || h.symbol,
    quantity: h.quantity,
    avgBuyPrice: h.avgBuyPrice,
    buyDate: h.buyDate,
    createdAt: h.createdAt,
  }))
}

function mapPortfolios(rawList: any[]) {
  return rawList.map((p: any) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    holdings: mapHoldings(p.holdings ?? []),
  }))
}

function* fetchPortfoliosSaga(): Generator<any, void, any> {
  try {
    yield put(setStatus('loading'))
    const data = yield call(PortfolioService.fetchPortfolios)
    if (data.success) {
      yield put(hydratePortfolios({ portfolios: mapPortfolios(data.portfolios), hasPortfolio: data.hasPortfolio }))
    }
  } catch (error: any) {
    yield put(setError(error.message || 'Failed to fetch portfolio.'))
    yield put(setStatus('error'))
  }
}

export function* portfolioSaga(): Generator<any, void, any> {
  yield takeEvery(fetchPortfoliosStart.type, fetchPortfoliosSaga)

  // Gate the initial fetch on auth confirmation.
  while (true) {
    yield race([
      take(checkAuthSuccess.type),
      take(loginSuccess.type),
    ])

    yield call(fetchPortfoliosSaga)

    yield take(logoutSuccess.type)
  }
}

export default portfolioSaga
