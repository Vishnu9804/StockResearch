/**
 * store/rootSaga.ts
 * Root Redux-Saga combining all feature sagas
 */

import { all } from 'redux-saga/effects'
import { companySaga } from './sagas/companySaga'
import { screenerSaga } from './sagas/screenerSaga'
import { watchlistSaga } from './sagas/watchlistSaga'
import { notificationSaga } from './sagas/notificationSaga'
import { authSaga } from './sagas/authSaga'

export function* rootSaga() {
  yield all([
    companySaga(),
    screenerSaga(),
    watchlistSaga(),
    notificationSaga(),
    authSaga(),
  ])
}
