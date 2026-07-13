import { call, put, takeLatest } from 'redux-saga/effects'
import { toast } from 'react-hot-toast'
import { supabase } from '../../services/supabaseClient'
import { apiClient } from '../../services/finscreenApi'
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

function* loginSaga(action: ReturnType<typeof loginStart>): Generator<any, void, any> {
  try {
    const { email, password } = action.payload
    
    // Authenticate directly via Supabase client engine
    const { data, error } = yield call(
      [supabase.auth, supabase.auth.signInWithPassword],
      { email, password }
    )
    
    if (error) throw error

    if (data?.user) {
      const authenticatedUser = {
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.name || 'Investor',
        plan: 'FREE' as const
      }
      
      yield put(loginSuccess({ user: authenticatedUser }))
      toast.success(`Welcome back, ${authenticatedUser.name}!`)
      yield put(navigateTo('/'))
    }
  } catch (error: any) {
    const errMsg = error.message || 'Login failed.'
    yield put(loginFailure(errMsg))
    toast.error(errMsg)
  }
}

function* signupSaga(action: ReturnType<typeof signupStart>): Generator<any, void, any> {
  try {
    const { email, password, name } = action.payload
         
    // Register the user credentials directly to Supabase Auth infrastructure
    const { data, error } = yield call(
      [supabase.auth, supabase.auth.signUp],
      {
        email,
        password,
        options: {
          data: { name } // This passes the name to raw_user_meta_data so our trigger can grab it!
        }
      }
    )
         
    if (error) throw error
    if (data?.user) {
      const newUser = {
        id: data.user.id,
        email: data.user.email ?? email,
        name: name,
        plan: 'FREE' as const
      }
             
      // REMOVED: yield call([apiClient, apiClient.post], '/auth/sync-profile', { name })
      // The database trigger handles this now automatically and perfectly!
             
      yield put(signupSuccess({ user: newUser }))
      toast.success('Account created successfully! Welcome to FinScreen')
      yield put(navigateTo('/'))
    }
  } catch (error: any) {
    const errMsg = error.message || 'Registration failed.'
    yield put(signupFailure(errMsg))
    toast.error(errMsg)
  }
}

function* logoutSaga(): Generator<any, void, any> {
  try {
    yield call([supabase.auth, supabase.auth.signOut])
    yield put(logoutSuccess())
    yield put(clearAllNotifications())
    toast.success('Logged out successfully.')
    yield put(navigateTo('/login'))
  } catch (error: any) {
    yield put(logoutSuccess())
    yield put(clearAllNotifications())
    yield put(navigateTo('/login'))
  }
}

function* checkAuthSaga(): Generator<any, void, any> {
  try {
    const { data: { session }, error } = yield call([supabase.auth, supabase.auth.getSession])
    if (error) throw error

    if (session?.user) {
      const userProfile = {
        id: session.user.id,
        email: session.user.email ?? '',
        name: session.user.user_metadata?.name || 'Investor',
        plan: 'FREE' as const
      }
      yield put(checkAuthSuccess({ user: userProfile }))
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