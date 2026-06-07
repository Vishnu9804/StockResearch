import { call, put, takeEvery, take, race, select } from 'redux-saga/effects'
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
import { checkAuthSuccess, loginSuccess, logoutSuccess } from '../slices/authSlice'

// Helpers to map DB schema → frontend WatchlistItem format
function mapWatchlistItems(items: any[]) {
  return items.map((item: any) => ({
    id: item.id,
    symbol: item.symbol,
    name: item.symbol === 'RELIANCE' ? 'Reliance Industries Ltd' : `${item.symbol} Ltd`,
    sector: 'Equities',
    targetPrice: item.targetPrice,
    alertEnabled: item.alertEnabled,
    addedAt: item.createdAt,
    notes: '',
    alertAbove: null,
    alertBelow: null,
  }))
}

function mapWatchlists(rawList: any[]) {
  return rawList.map((wl: any) => ({
    id: wl.id,
    name: wl.name,
    createdAt: wl.createdAt,
    items: mapWatchlistItems(wl.items ?? []),
  }))
}

// Saga: Fetch all watchlists (only called on initial load or explicit refresh)
function* fetchWatchlistsSaga(): Generator<any, void, any> {
  try {
    yield put(setStatus('loading'))
    const data = yield call(WatchlistService.fetchWatchlists)
    if (data.success) {
      const watchlists = mapWatchlists(data.watchlists)
      const activeWatchlistId = watchlists[0]?.id || 'default'
      yield put(hydrateWatchlists({ watchlists, activeWatchlistId, status: 'success', error: null }))
    }
  } catch (error: any) {
    yield put(setError(error.message || 'Failed to fetch watchlists.'))
  }
}

/**
 * Fix: Previously every mutation called fetchWatchlistsSaga() after success,
 * causing 2 HTTP calls per user action (mutation + full list re-fetch).
 * The mutation responses already return the created/updated objects.
 * We now patch local Redux state directly from the response instead of re-fetching.
 */

function* handleCreateWatchlist(action: any): Generator<any, void, any> {
  try {
    const data = yield call(WatchlistService.createWatchlist, action.payload.name)
    // Re-fetch only on create since new watchlist needs a server-generated ID
    // The response from POST /watchlists should return the created watchlist
    if (data.success && data.watchlist) {
      // Merge new watchlist into state without a full re-fetch
      const state: any = yield select((s: any) => s.watchlist)
      const newWl = {
        id: data.watchlist.id,
        name: data.watchlist.name,
        createdAt: data.watchlist.createdAt,
        items: [],
      }
      yield put(hydrateWatchlists({
        watchlists: [...state.watchlists, newWl],
        activeWatchlistId: newWl.id,
        status: 'success',
        error: null,
      }))
    } else {
      // Fallback: re-fetch if response format is unexpected
      yield call(fetchWatchlistsSaga)
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to create watchlist.'))
  }
}

function* handleDeleteWatchlist(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.deleteWatchlist, action.payload)
    // Slice reducer for deleteWatchlist already removes it from local state.
    // No re-fetch needed — state is already updated by the action.
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
    // Slice reducer for addToWatchlist already added the item to local state.
    // No re-fetch needed.
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
      // Slice reducer for removeFromWatchlist already removed item from local state.
      // No re-fetch needed.
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
      let targetPrice = item.targetPrice
      let alertEnabled = item.alertEnabled

      if (action.type === setTargetPrice.type) {
        targetPrice = action.payload.price
      } else if (action.type === toggleAlert.type) {
        alertEnabled = !alertEnabled
      }

      yield call(WatchlistService.updateStock, item.id, targetPrice, alertEnabled)
      // Slice reducers (setTargetPrice, toggleAlert) already updated local state.
      // No re-fetch needed.
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to update alert.'))
  }
}

export function* watchlistSaga(): Generator<any, void, any> {
  // Set up mutation listeners — these are always active regardless of auth state
  yield takeEvery('watchlist/fetchStart', fetchWatchlistsSaga)
  yield takeEvery(createWatchlist.type, handleCreateWatchlist)
  yield takeEvery(deleteWatchlist.type, handleDeleteWatchlist)
  yield takeEvery(addToWatchlist.type, handleAddToWatchlist)
  yield takeEvery(removeFromWatchlist.type, handleRemoveFromWatchlist)
  yield takeEvery(setTargetPrice.type, handleUpdateWatchlistItem)
  yield takeEvery(toggleAlert.type, handleUpdateWatchlistItem)

  // Gate the initial fetch on auth confirmation.
  // Previously this fired immediately on boot, producing a guaranteed 401
  // on the login page before auth was checked.
  while (true) {
    // Wait for auth to complete before fetching watchlists
    yield race([
      take(checkAuthSuccess.type),
      take(loginSuccess.type),
    ])

    // Auth confirmed — fetch watchlists once
    yield call(fetchWatchlistsSaga)

    // Wait for logout, then reset and wait for next auth
    yield take(logoutSuccess.type)
  }
}

export default watchlistSaga
