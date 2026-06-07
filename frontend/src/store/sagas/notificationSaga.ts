/**
 * store/sagas/notificationSaga.ts
 *
 * Fixed issues:
 * 1. Poll loop now starts ONLY after auth/checkAuthSuccess or auth/loginSuccess —
 *    never before auth is confirmed (no wasted calls on unauthenticated users).
 * 2. Uses fork + cancel pattern — poll stops cleanly on logout.
 * 3. Removed duplicate takeEvery listeners that caused 3 simultaneous fetches on load.
 * 4. Removed redundant fetchNotificationsFlow calls from handleMarkAsRead /
 *    handleMarkAllAsRead — the slice reducers already update local state correctly.
 */

import { delay, put, call, takeEvery, fork, take, cancel, race } from 'redux-saga/effects'
import { Task } from 'redux-saga'
import { NotificationService } from '../../services/notifications'
import {
  setNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
} from '../slices/notificationsSlice'
import { checkAuthSuccess, loginSuccess, logoutSuccess } from '../slices/authSlice'

function* fetchNotificationsFlow(): Generator<any, void, any> {
  try {
    const data = yield call(NotificationService.fetchNotifications)
    if (data.success) {
      yield put(setNotifications(data.notifications))
    }
  } catch (error: any) {
    console.error('Failed to sync alerts from backend:', error)
  }
}

/**
 * Background poll loop — runs every 15s.
 * Only started after auth is confirmed; cancelled on logout.
 * Fetches at the END of each cycle to avoid an immediate double-call
 * (auth success already triggered one fetch before this loop starts).
 */
const POLL_INTERVAL_MS = 60_000 // 60 seconds — reduces network chatter while still keeping alerts fresh

function* pollBackgroundAlertsSaga(): Generator<any, void, any> {
  while (true) {
    try {
      yield delay(POLL_INTERVAL_MS)
      yield call(fetchNotificationsFlow)
    } catch (err) {
      console.error('Error polling alerts:', err)
      yield delay(POLL_INTERVAL_MS)
    }
  }
}


/**
 * Mark single notification as read on server.
 * Slice reducer (markAsRead) already updates local state — no re-fetch needed.
 */
function* handleMarkAsRead(action: any): Generator<any, void, any> {
  try {
    yield call(NotificationService.markAsRead, action.payload)
    // Local state is already updated by the slice reducer — no GET re-fetch needed
  } catch (err) {
    console.error('Failed to mark alert as read on server:', err)
  }
}

/**
 * Mark all notifications as read on server.
 * Slice reducer already updates local state — no re-fetch needed.
 */
function* handleMarkAllAsRead(): Generator<any, void, any> {
  try {
    yield call(NotificationService.markAllAsRead)
    // Local state is already updated by the slice reducer — no GET re-fetch needed
  } catch (err) {
    console.error('Failed to mark all alerts as read on server:', err)
  }
}

export function* notificationSaga(): Generator<any, void, any> {
  // Handle mark-read actions (these don't trigger re-fetches)
  yield takeEvery(markAsRead.type, handleMarkAsRead)
  yield takeEvery(markAllAsRead.type, handleMarkAllAsRead)

  while (true) {
    // Gate: wait for auth to succeed before starting any notification work
    yield race([
      take(checkAuthSuccess.type),
      take(loginSuccess.type),
    ])

    // Auth confirmed — do one immediate fetch, then start the poll loop
    yield call(fetchNotificationsFlow)
    const pollTask: Task = yield fork(pollBackgroundAlertsSaga)

    // Wait for logout, then cancel the poll and clear notifications
    yield take(logoutSuccess.type)
    yield cancel(pollTask)
    yield put(clearAllNotifications())

    // Loop back to wait for next login/checkAuthSuccess
  }
}

export default notificationSaga
