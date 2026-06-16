import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import { TrendingUp } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, status } = useAppSelector((state) => state.auth)

  // Redirect to login only when auth check is complete and user is not authenticated.
  // Does NOT dispatch checkAuthStart — that is done once in rootSaga's initSaga.
  useEffect(() => {
    if (status !== 'loading' && status !== 'idle' && !isAuthenticated) {
      const redirectPath = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${redirectPath}`)
    }
  }, [isAuthenticated, status, navigate, location])

  // Only show the loading splash while auth check is in progress.
  // When status === 'success' and isAuthenticated is true, render children immediately.
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="fixed inset-0 bg-surfaceMuted flex flex-col items-center justify-center z-50 select-none">
        <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
          {/* Logo with pulsating animation */}
          <div className="relative flex items-center justify-center size-16 bg-accent rounded-2xl shadow-xl shadow-blue-500/10 hover:scale-105 transition-transform duration-300">
            <TrendingUp className="size-8 text-white animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-medium tracking-tight text-textPrimary">
              FinScreen
            </h1>
            <p className="text-xs font-medium text-textMuted max-w-[240px] leading-relaxed">
              Securing institutional data feed and checking session...
            </p>
          </div>

          {/* Premium custom horizontal loading bar */}
          <div className="w-48 h-1 bg-skeletonBase rounded-full overflow-hidden relative">
            <div className="h-full bg-accent rounded-full w-2/3 animate-[shimmer_1.5s_infinite] absolute left-0 right-0"></div>
          </div>
        </div>

        {/* Global Keyframes styling injected for custom animations */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes shimmer {
            0% {
              transform: translateX(-150%);
            }
            50% {
              transform: translateX(100%);
            }
            100% {
              transform: translateX(250%);
            }
          }
        ` }} />
      </div>
    )
  }

  // If auth failed (status === 'error'), the useEffect above handles the redirect.
  // Returning null here prevents a flash while the redirect fires.
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
