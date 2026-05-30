import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface User {
  id: string
  email: string
  name: string
  plan: 'FREE' | 'PRO'
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  status: 'idle',
  error: null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state, action: PayloadAction<any>) {
      state.status = 'loading'
      state.error = null
    },
    loginSuccess(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.status = 'success'
      state.isAuthenticated = true
      state.user = action.payload.user
      state.error = null
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    signupStart(state, action: PayloadAction<any>) {
      state.status = 'loading'
      state.error = null
    },
    signupSuccess(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.status = 'success'
      state.isAuthenticated = true
      state.user = action.payload.user
      state.error = null
    },
    signupFailure(state, action: PayloadAction<string>) {
      state.status = 'error'
      state.error = action.payload
    },
    logoutStart(state) {
      state.status = 'loading'
    },
    logoutSuccess(state) {
      state.status = 'idle'
      state.isAuthenticated = false
      state.user = null
      state.error = null
    },
    checkAuthStart(state) {
      state.status = 'loading'
    },
    checkAuthSuccess(state, action: PayloadAction<{ user: User }>) {
      state.status = 'success'
      state.isAuthenticated = true
      state.user = action.payload.user
    },
    checkAuthFailure(state) {
      state.status = 'error'
      state.isAuthenticated = false
      state.user = null
    },
    updateUserPlan(state, action: PayloadAction<'FREE' | 'PRO'>) {
      if (state.user) {
        state.user.plan = action.payload
      }
    }
  }
})

export const {
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
  checkAuthFailure,
  updateUserPlan
} = authSlice.actions

export const authReducer = authSlice.reducer
export default authReducer
