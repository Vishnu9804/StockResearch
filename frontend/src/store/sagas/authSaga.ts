import { call, put, takeLatest } from 'redux-saga/effects'
import { toast } from 'react-hot-toast'
import { AuthService } from '../../services/auth'
import {
  loginStart,
  loginSuccess,
  loginFailure,
  signupStart,
  signupSuccess,
  signupFailure,
  logoutStart,
  logoutSuccess,
  checkAuthStart,
  checkAuthSuccess,
  checkAuthFailure
} from '../slices/authSlice'
import { navigateTo } from '../slices/uiSlice'
import { clearAllNotifications } from '../slices/notificationsSlice'

// ─── Static Demo Credentials ──────────────────────────────────────────────────
const STATIC_USER = {
  email: 'free@finscreen.in',
  password: 'free@finscreen.in',
  user: {
    id: 'usr_free_demo',
    email: 'free@finscreen.in',
    name: 'Free User',
    plan: 'FREE' as const,
  },
}

function* loginSaga(action: ReturnType<typeof loginStart>): Generator<any, void, any> {
  try {
    const { email, password } = action.payload

    // ── Static login bypass ────────────────────────────────────────────────
    if (
      email?.trim().toLowerCase() === STATIC_USER.email &&
      password === STATIC_USER.password
    ) {
      yield put(loginSuccess({ user: STATIC_USER.user, accessToken: 'static_demo_token' }))
      toast.success(`Welcome back, ${STATIC_USER.user.name}! 🚀`)
      yield put(navigateTo('/'))
      return
    }
    // ──────────────────────────────────────────────────────────────────────

    const data = yield call(AuthService.login, action.payload)
    if (data.success) {
      yield put(loginSuccess({ user: data.user, accessToken: data.accessToken }))
      toast.success(`Welcome back, ${data.user.name}! 🚀`)
      // Use Redux action → NavigationHandler for client-side navigation (no page reload)
      yield put(navigateTo('/'))
    } else {
      yield put(loginFailure(data.message || 'Login failed.'))
      toast.error(data.message || 'Login failed.')
    }
  } catch (error: any) {
    const errMsg = error.response?.data?.message || error.message || 'Login failed.'
    yield put(loginFailure(errMsg))
    toast.error(errMsg)
  }
}

function* signupSaga(action: ReturnType<typeof signupStart>): Generator<any, void, any> {
  try {
    const data = yield call(AuthService.signup, action.payload)
    if (data.success) {
      yield put(signupSuccess({ user: data.user, accessToken: data.accessToken }))
      toast.success('Account created successfully! Welcome to FinScreen ⚡')
      yield put(navigateTo('/'))
    } else {
      yield put(signupFailure(data.message || 'Registration failed.'))
      toast.error(data.message || 'Registration failed.')
    }
  } catch (error: any) {
    const errMsg = error.response?.data?.message || error.message || 'Registration failed.'
    yield put(signupFailure(errMsg))
    toast.error(errMsg)
  }
}

function* logoutSaga(): Generator<any, void, any> {
  try {
    yield call(AuthService.logout)
    yield put(logoutSuccess())
    yield put(clearAllNotifications())
    toast.success('Logged out successfully. See you soon!')
    yield put(navigateTo('/login'))
  } catch (error: any) {
    yield put(logoutSuccess()) // Always clean up local state
    yield put(clearAllNotifications())
    yield put(navigateTo('/login'))
  }
}

function* checkAuthSaga(): Generator<any, void, any> {
  try {
    const data = yield call(AuthService.getProfile)
    if (data.success) {
      yield put(checkAuthSuccess({ user: data.user }))
    } else {
      yield put(checkAuthFailure())
    }
  } catch (error: any) {
    yield put(checkAuthFailure())
  }
}

export function* authSaga(): Generator<any, void, any> {
  // Perform the initial auth check directly on saga boot.
  // We call checkAuthSaga() directly here instead of dispatching checkAuthStart,
  // because if we used put(checkAuthStart()), the takeLatest listener below
  // wouldn't be registered yet — causing the action to be silently dropped
  // and the app to hang on the loading screen forever.
  yield call(checkAuthSaga)

  // Set up listeners for future user-triggered auth actions
  yield takeLatest(loginStart.type, loginSaga)
  yield takeLatest(signupStart.type, signupSaga)
  yield takeLatest(logoutStart.type, logoutSaga)
  yield takeLatest(checkAuthStart.type, checkAuthSaga)
}

export default authSaga
