import { call, put, takeEvery, select } from 'redux-saga/effects'
import { WatchlistService } from '../../services/watchlist'
import {
  hydrateWatchlists,
  createWatchlist,
  deleteWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  setStatus,
  setError
} from '../slices/watchlistSlice'

// Saga: Fetch all watchlists
function* fetchWatchlistsSaga(): Generator<any, void, any> {
  try {
    yield put(setStatus('loading'))
    const data = yield call(WatchlistService.fetchWatchlists)
    if (data.success) {
      // Map database schema to frontend Watchlist format
      const watchlists = data.watchlists.map((wl: any) => ({
        id: wl.id,
        name: wl.name,
        createdAt: wl.createdAt,
        items: wl.items.map((item: any) => ({
          id: item.id, // Store database ID for quick updates
          symbol: item.symbol,
          name: item.symbol === 'RELIANCE' ? 'Reliance Industries Ltd' : `${item.symbol} Ltd`,
          sector: 'Equities',
          targetPrice: item.targetPrice,
          alertEnabled: item.alertEnabled,
          addedAt: item.createdAt,
          notes: ''
        }))
      }))
      
      const activeWatchlistId = watchlists[0]?.id || 'default'
      yield put(hydrateWatchlists({ watchlists, activeWatchlistId, status: 'success', error: null }))
    }
  } catch (error: any) {
    yield put(setError(error.message || 'Failed to fetch watchlists.'))
  }
}

function* handleCreateWatchlist(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.createWatchlist, action.payload.name)
    yield call(fetchWatchlistsSaga)
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to create watchlist.'))
  }
}

function* handleDeleteWatchlist(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.deleteWatchlist, action.payload)
    yield call(fetchWatchlistsSaga)
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to delete watchlist.'))
  }
}

// Selector
const selectWatchlistsState = (state: any) => state.watchlist

function* handleAddToWatchlist(action: any): Generator<any, void, any> {
  try {
    const state = yield select(selectWatchlistsState)
    const wlId = action.payload.watchlistId || state.activeWatchlistId
    yield call(WatchlistService.addStock, wlId, action.payload.item.symbol)
    yield call(fetchWatchlistsSaga)
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to add stock.'))
  }
}

function* handleRemoveFromWatchlist(action: any): Generator<any, void, any> {
  try {
    const state = yield select(selectWatchlistsState)
    const wlId = action.payload.watchlistId || state.activeWatchlistId
    const wl = state.watchlists.find((w: any) => w.id === wlId)
    const item = wl?.items.find((i: any) => i.symbol === action.payload.symbol)
    
    if (item && item.id) {
      yield call(WatchlistService.removeStock, item.id)
      yield call(fetchWatchlistsSaga)
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to remove stock.'))
  }
}

function* handleUpdateWatchlistItem(action: any): Generator<any, void, any> {
  try {
    const state = yield select(selectWatchlistsState)
    const wlId = action.payload.watchlistId || state.activeWatchlistId
    const wl = state.watchlists.find((w: any) => w.id === wlId)
    const item = wl?.items.find((i: any) => i.symbol === action.payload.symbol)

    if (item && item.id) {
      // Calculate updated price and alert status
      let targetPrice = item.targetPrice
      let alertEnabled = item.alertEnabled

      if (action.type === setTargetPrice.type) {
        targetPrice = action.payload.price
      } else if (action.type === toggleAlert.type) {
        alertEnabled = !alertEnabled
      }

      yield call(WatchlistService.updateStock, item.id, targetPrice, alertEnabled)
      yield call(fetchWatchlistsSaga)
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to update alert.'))
  }
}

export function* watchlistSaga(): Generator<any, void, any> {
  // Initial fetch
  yield call(fetchWatchlistsSaga)
  
  // Listeners
  yield takeEvery('watchlist/fetchStart', fetchWatchlistsSaga)
  yield takeEvery(createWatchlist.type, handleCreateWatchlist)
  yield takeEvery(deleteWatchlist.type, handleDeleteWatchlist)
  yield takeEvery(addToWatchlist.type, handleAddToWatchlist)
  yield takeEvery(removeFromWatchlist.type, handleRemoveFromWatchlist)
  yield takeEvery(setTargetPrice.type, handleUpdateWatchlistItem)
  yield takeEvery(toggleAlert.type, handleUpdateWatchlistItem)
}

export default watchlistSaga
