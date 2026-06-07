/**
 * NavigationHandler.tsx
 * Listens to Redux `pendingNavigation` state set by sagas
 * and uses React Router's `useNavigate` to perform client-side navigation.
 * This avoids window.location.href (which reloads the page and destroys the Redux store).
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { clearNavigation } from '@/store/slices/uiSlice'

export function NavigationHandler() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const pendingNavigation = useAppSelector((state) => state.ui.pendingNavigation)

  useEffect(() => {
    if (pendingNavigation) {
      navigate(pendingNavigation)
      dispatch(clearNavigation())
    }
  }, [pendingNavigation, navigate, dispatch])

  return null
}
