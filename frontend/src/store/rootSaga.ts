/**
 * store/rootSaga.ts
 * Root Redux-Saga combining all feature sagas.
 * Auth check is initiated directly inside authSaga on boot — no initSaga needed.
 * This avoids the race condition where checkAuthStart was dispatched BEFORE
 * authSaga's takeLatest(checkAuthStart) listener was registered, causing the
 * action to be silently dropped and the app to hang on the loading screen.
 */

import { all } from 'redux-saga/effects'
import { companySaga } from './sagas/companySaga'
import { screenerSaga } from './sagas/screenerSaga'
import { authSaga } from './sagas/authSaga'
import { marketPulseSaga } from './sagas/marketPulseSaga'
import { watchlistSaga } from './sagas/watchlistSaga'

export function* rootSaga() {
  yield all([
    authSaga(),
    companySaga(),
    screenerSaga(),
    marketPulseSaga(),
    watchlistSaga(),
  ])
}
