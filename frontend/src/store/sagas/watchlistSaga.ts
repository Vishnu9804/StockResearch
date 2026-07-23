import { call, put, takeEvery, take, race, select } from 'redux-saga/effects'
import { WatchlistService } from '../../services/watchlist'
import {
  hydrateWatchlists,
  fetchWatchlistsStart,
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  moveItemRequest,
  moveItemLocally,
  quickWatch,
  quickUnwatch,
  upsertWatchedSymbol,
  removeSymbolEverywhere,
  setStatus,
  setError,
} from '../slices/watchlistSlice'
import { checkAuthSuccess, loginSuccess, logoutSuccess } from '../slices/authSlice'

// Helpers to map DB schema → frontend WatchlistItem format
function mapWatchlistItems(items: any[]) {
  return items.map((item: any) => ({
    id: item.id,
    symbol: item.symbol,
    companyName: item.companyName || item.symbol,
    targetPrice: item.targetPrice,
    alertEnabled: item.alertEnabled,
    addedAt: item.createdAt,
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

// Saga: Fetch all watchlists
function* fetchWatchlistsSaga(): Generator<any, void, any> {
  try {
    yield put(setStatus('loading'))
    const data = yield call(WatchlistService.fetchWatchlists)
    if (data.success) {
      const watchlists = mapWatchlists(data.watchlists)
      const activeWatchlistId = watchlists[0]?.id || ''
      yield put(hydrateWatchlists({ watchlists, activeWatchlistId, status: 'success', error: null }))
    }
  } catch (error: any) {
    yield put(setError(error.message || 'Failed to fetch watchlists.'))
    yield put(setStatus('error'))
  }
}

function* handleCreateWatchlist(action: any): Generator<any, void, any> {
  try {
    const data = yield call(WatchlistService.createWatchlist, action.payload.name)
    if (data.success && data.watchlist) {
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
      yield call(fetchWatchlistsSaga)
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to create watchlist.'))
  }
}

function* handleRenameWatchlist(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.renameWatchlist, action.payload.id, action.payload.name)
    // Slice reducer already renamed it locally.
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to rename watchlist.'))
  }
}

function* handleDeleteWatchlist(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.deleteWatchlist, action.payload)
    // Slice reducer for deleteWatchlist already removes it from local state.
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to delete watchlist.'))
  }
}

const selectWatchlistsState = (state: any) => state.watchlist

function* handleAddToWatchlist(action: any): Generator<any, void, any> {
  try {
    const state = yield select(selectWatchlistsState)
    const wlId = action.payload.watchlistId || state.activeWatchlistId
    const data = yield call(WatchlistService.addStock, wlId, action.payload.symbol, action.payload.companyName)
    if (data.success && data.item) {
      yield put(upsertWatchedSymbol({
        watchlist: state.watchlists.find((w: any) => w.id === wlId) ?? { id: wlId, name: '', createdAt: new Date().toISOString() },
        item: mapWatchlistItems([data.item])[0],
      }))
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to add stock.'))
  }
}

function* handleRemoveFromWatchlist(action: any): Generator<any, void, any> {
  try {
    // NOTE: itemId must come from action.payload, not a state lookup here —
    // by the time this saga runs, the removeFromWatchlist reducer has already
    // filtered the item out of local state, so it can no longer be found by symbol.
    if (action.payload.itemId) {
      yield call(WatchlistService.removeStock, action.payload.itemId)
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
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to update alert.'))
  }
}

function* handleMoveItem(action: any): Generator<any, void, any> {
  const { itemId, fromWatchlistId, toWatchlistId } = action.payload
  try {
    yield put(moveItemLocally({ itemId, fromWatchlistId, toWatchlistId }))
    yield call(WatchlistService.moveStock, itemId, toWatchlistId)
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to move stock.'))
    // Reconcile with the server since the optimistic move may not have applied.
    yield call(fetchWatchlistsSaga)
  }
}

function* handleQuickWatch(action: any): Generator<any, void, any> {
  try {
    const data = yield call(WatchlistService.watchStock, action.payload.symbol, action.payload.companyName)
    if (data.success) {
      yield put(upsertWatchedSymbol({
        watchlist: data.watchlist,
        item: mapWatchlistItems([data.item])[0],
      }))
    }
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to add to watchlist.'))
  }
}

function* handleQuickUnwatch(action: any): Generator<any, void, any> {
  try {
    yield call(WatchlistService.unwatchStock, action.payload)
    yield put(removeSymbolEverywhere(action.payload))
  } catch (err: any) {
    yield put(setError(err.message || 'Failed to remove from watchlist.'))
  }
}

export function* watchlistSaga(): Generator<any, void, any> {
  yield takeEvery(fetchWatchlistsStart.type, fetchWatchlistsSaga)
  yield takeEvery(createWatchlist.type, handleCreateWatchlist)
  yield takeEvery(renameWatchlist.type, handleRenameWatchlist)
  yield takeEvery(deleteWatchlist.type, handleDeleteWatchlist)
  yield takeEvery(addToWatchlist.type, handleAddToWatchlist)
  yield takeEvery(removeFromWatchlist.type, handleRemoveFromWatchlist)
  yield takeEvery(setTargetPrice.type, handleUpdateWatchlistItem)
  yield takeEvery(toggleAlert.type, handleUpdateWatchlistItem)
  yield takeEvery(moveItemRequest.type, handleMoveItem)
  yield takeEvery(quickWatch.type, handleQuickWatch)
  yield takeEvery(quickUnwatch.type, handleQuickUnwatch)

  // Gate the initial fetch on auth confirmation.
  while (true) {
    yield race([
      take(checkAuthSuccess.type),
      take(loginSuccess.type),
    ])

    yield call(fetchWatchlistsSaga)

    yield take(logoutSuccess.type)
  }
}

export default watchlistSaga
