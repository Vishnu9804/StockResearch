import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AuthGuard } from '../components/shared/AuthGuard'
import Login from '../pages/Login'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from '../store/slices/authSlice'

afterEach(() => {
  cleanup()
})

// Helper to create a store for testing
function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      auth: authReducer,
    } as any,
    preloadedState,
  })
}

describe('AuthGuard & Routing flow tests', () => {
  it('should render children if authenticated', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: { id: 'usr_123', email: 'test@example.com', name: 'John Doe', plan: 'FREE' },
        status: 'success',
        error: null,
      },
    })

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/watchlists']}>
          <AuthGuard>
            <div>Protected Content</div>
          </AuthGuard>
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByText('Protected Content')).toBeDefined()
  })

  it('should not render children if not authenticated', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: false,
        user: null,
        status: 'error',
        error: 'Unauthorized',
      },
    })

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/watchlists']}>
          <Routes>
            <Route
              path="/watchlists"
              element={
                <AuthGuard>
                  <div>Protected Content</div>
                </AuthGuard>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )

    // Should NOT render protected content because AuthGuard redirects/returns null
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('should redirect to the decoded URL specified in the redirect param upon authentication', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true, // Mock already authenticated to trigger the redirect immediately
        user: { id: 'usr_123', email: 'test@example.com', name: 'John Doe', plan: 'FREE' },
        status: 'success',
        error: null,
      },
    })

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/login?redirect=%2Fcompany%2FITC']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/company/ITC" element={<div>ITC Company Page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )

    expect(screen.getByText('ITC Company Page')).toBeDefined()
  })
})
