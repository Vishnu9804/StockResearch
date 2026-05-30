import { delay, put, call, takeEvery, select } from 'redux-saga/effects'
import { NotificationService } from '../../services/notifications'
import {
  setNotifications,
  markAsRead,
  markAllAsRead,
} from '../slices/notificationsSlice'

const selectIsAuthenticated = (state: any) => state.auth.isAuthenticated

function* fetchNotificationsFlow(): Generator<any, void, any> {
  try {
    const isAuthenticated = yield select(selectIsAuthenticated)
    if (!isAuthenticated) return

    const data = yield call(NotificationService.fetchNotifications)
    if (data.success) {
      yield put(setNotifications(data.notifications))
    }
  } catch (error: any) {
    console.error('Failed to sync alerts from backend:', error)
  }
}

function* pollBackgroundAlertsSaga(): Generator<any, void, any> {
  while (true) {
    try {
      yield call(fetchNotificationsFlow)
      yield delay(15000) // Poll every 15s to fetch Node-cron alerts in the background
    } catch (err) {
      console.error('Error polling alerts:', err)
      yield delay(15000)
    }
  }
}

function* handleMarkAsRead(action: any): Generator<any, void, any> {
  try {
    yield call(NotificationService.markAsRead, action.payload)
    yield call(fetchNotificationsFlow)
  } catch (err) {
    console.error('Failed to mark alert as read on server:', err)
  }
}

function* handleMarkAllAsRead(): Generator<any, void, any> {
  try {
    yield call(NotificationService.markAllAsRead)
    yield call(fetchNotificationsFlow)
  } catch (err) {
    console.error('Failed to mark all alerts as read on server:', err)
  }
}

export function* notificationSaga(): Generator<any, void, any> {
  // Start the background polling task
  yield takeEvery('auth/loginSuccess', fetchNotificationsFlow)
  yield takeEvery('auth/checkAuthSuccess', fetchNotificationsFlow)
  
  yield takeEvery(markAsRead.type, handleMarkAsRead)
  yield takeEvery(markAllAsRead.type, handleMarkAllAsRead)
  
  yield pollBackgroundAlertsSaga()
}

export default notificationSaga
