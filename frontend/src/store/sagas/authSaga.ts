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

function* loginSaga(action: ReturnType<typeof loginStart>): Generator<any, void, any> {
  try {
    const data = yield call(AuthService.login, action.payload)
    if (data.success) {
      yield put(loginSuccess({ user: data.user, accessToken: data.accessToken }))
      toast.success(`Welcome back, ${data.user.name}! 🚀`)
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
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
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
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
    toast.success('Logged out successfully. See you soon!')
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  } catch (error: any) {
    yield put(logoutSuccess()) // Always clean up local state
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
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
  yield takeLatest(loginStart.type, loginSaga)
  yield takeLatest(signupStart.type, signupSaga)
  yield takeLatest(logoutStart.type, logoutSaga)
  yield takeLatest(checkAuthStart.type, checkAuthSaga)
}

export default authSaga
