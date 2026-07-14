import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { checkAuthStart } from '../../store/slices/authSlice'
import { Spinner } from '../ui/spinner'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const { isAuthenticated, status } = useAppSelector((state) => state.auth)

  useEffect(() => {
    // Trigger a fresh Supabase session validation check on mount
    if (status === 'idle') {
      dispatch(checkAuthStart())
    }
  }, [status, dispatch])

  // Show a premium loading spinner while verifying token cryptographics
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  // If validation fails, drop them back into the login cycle gracefully
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}