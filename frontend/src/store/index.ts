/**
 * store/index.ts
 * Production-ready Redux store configuration with Redux-Saga middleware
 */

import { configureStore } from '@reduxjs/toolkit'
import createSagaMiddleware from 'redux-saga'
import { companyReducer } from './slices/companySlice'
import { screenerReducer } from './slices/screenerSlice'
import { watchlistReducer } from './slices/watchlistSlice'
import { notificationsReducer } from './slices/notificationsSlice'
import { uiReducer } from './slices/uiSlice'
import searchReducer from './slices/searchSlice'
import authReducer from './slices/authSlice'
import { portfolioReducer } from './slices/portfolioSlice'
import { rootSaga } from './rootSaga'

const sagaMiddleware = createSagaMiddleware()

export const store = configureStore({
  reducer: {
    company: companyReducer,
    screener: screenerReducer,
    watchlist: watchlistReducer,
    notifications: notificationsReducer,
    ui: uiReducer,
    search: searchReducer,
    auth: authReducer,
    portfolio: portfolioReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false, // strictly saga-based side effects
      serializableCheck: false, // standard for complex financial series
    }).concat(sagaMiddleware),
})

sagaMiddleware.run(rootSaga)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
