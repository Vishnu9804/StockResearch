/**
 * frontend/src/tests/authSlice.test.ts
 * Unit tests for Redux authSlice reducer
 */

import { describe, it, expect } from 'vitest'
import {
  authReducer,
  loginStart,
  loginSuccess,
  loginFailure,
  signupSuccess,
  logoutSuccess,
  updateUserPlan,
  type AuthState,
  type User
} from '../store/slices/authSlice'

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  status: 'idle',
  error: null,
}

describe('Redux Auth Reducers', () => {
  it('should return initial state by default', () => {
    expect(authReducer(undefined, { type: '@@INIT' })).toEqual(initialState)
  })

  it('should handle loginStart action', () => {
    const nextState = authReducer(initialState, loginStart({ email: 'test@example.com', password: '123' }))
    expect(nextState.status).toBe('loading')
    expect(nextState.error).toBeNull()
  })

  it('should handle loginSuccess action', () => {
    const mockUser: User = {
      id: 'usr_abc',
      email: 'test@example.com',
      name: 'John Test',
      plan: 'FREE',
    }

    const nextState = authReducer(
      { ...initialState, status: 'loading' },
      loginSuccess({ user: mockUser, accessToken: 'token-123' })
    )

    expect(nextState.status).toBe('success')
    expect(nextState.isAuthenticated).toBe(true)
    expect(nextState.user).toEqual(mockUser)
    expect(nextState.error).toBeNull()
  })

  it('should handle loginFailure action', () => {
    const nextState = authReducer(
      { ...initialState, status: 'loading' },
      loginFailure('Invalid credentials')
    )

    expect(nextState.status).toBe('error')
    expect(nextState.error).toBe('Invalid credentials')
    expect(nextState.isAuthenticated).toBe(false)
    expect(nextState.user).toBeNull()
  })

  it('should handle signupSuccess action', () => {
    const mockUser: User = {
      id: 'usr_xyz',
      email: 'new@example.com',
      name: 'New Account',
      plan: 'FREE',
    }

    const nextState = authReducer(
      initialState,
      signupSuccess({ user: mockUser, accessToken: 'token-999' })
    )

    expect(nextState.status).toBe('success')
    expect(nextState.isAuthenticated).toBe(true)
    expect(nextState.user).toEqual(mockUser)
  })

  it('should handle logoutSuccess action', () => {
    const activeState: AuthState = {
      isAuthenticated: true,
      user: { id: 'usr_xyz', email: 'a@a.com', name: 'A', plan: 'PRO' },
      status: 'success',
      error: null,
    }

    const nextState = authReducer(activeState, logoutSuccess())

    expect(nextState.isAuthenticated).toBe(false)
    expect(nextState.user).toBeNull()
    expect(nextState.status).toBe('idle')
  })

  it('should handle updateUserPlan action', () => {
    const activeState: AuthState = {
      isAuthenticated: true,
      user: { id: 'usr_xyz', email: 'a@a.com', name: 'A', plan: 'FREE' },
      status: 'success',
      error: null,
    }

    const nextState = authReducer(activeState, updateUserPlan('PRO'))

    expect(nextState.user?.plan).toBe('PRO')
  })
})
