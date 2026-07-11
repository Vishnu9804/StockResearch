import { AlertCircle, RefreshCw, Wifi, Clock } from 'lucide-react'
import { Button } from './button'
import { useEffect, useState } from 'react'

export interface InlineErrorProps {
  message?: string | null
  onRetry?: () => void
  className?: string
  /** If true, shows a countdown auto-retry. Default: true when onRetry is provided */
  autoRetry?: boolean
  /** Auto-retry delay in seconds. Default: 30 */
  autoRetryDelay?: number
}

/** Map raw axios/network error strings to user-friendly messages */
function friendlyMessage(raw?: string | null): { icon: typeof AlertCircle; msg: string } {
  if (!raw) return { icon: AlertCircle, msg: 'Failed to load data. Please try again.' }
  const lower = raw.toLowerCase()
  if (lower.includes('timeout') || lower.includes('15000ms') || lower.includes('exceeded')) {
    return {
      icon: Clock,
      msg: 'The data source is taking longer than usual. This often happens during market hours. Retrying automatically…',
    }
  }
  if (lower.includes('network') || lower.includes('econnaborted') || lower.includes('err_network')) {
    return { icon: Wifi, msg: 'Network error. Please check your connection and try again.' }
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return { icon: Clock, msg: 'Too many requests. Please wait a moment and retry.' }
  }
  if (lower.includes('502') || lower.includes('503') || lower.includes('504')) {
    return { icon: AlertCircle, msg: 'Data service temporarily unavailable. Retrying…' }
  }
  if (lower.includes('401') || lower.includes('403')) {
    return { icon: AlertCircle, msg: 'Authentication error. Please refresh the page.' }
  }
  return { icon: AlertCircle, msg: 'Failed to load data. Please try again.' }
}

export function InlineError({
  message,
  onRetry,
  className = '',
  autoRetry = true,
  autoRetryDelay = 30,
}: InlineErrorProps) {
  const [countdown, setCountdown] = useState(autoRetry && onRetry ? autoRetryDelay : 0)
  const [retrying, setRetrying] = useState(false)

  const { icon: Icon, msg } = friendlyMessage(message)

  // Auto-retry countdown
  useEffect(() => {
    if (!autoRetry || !onRetry || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          handleRetry()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [autoRetry, onRetry]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    if (!onRetry) return
    setRetrying(true)
    setCountdown(0)
    try {
      onRetry()
    } finally {
      setTimeout(() => setRetrying(false), 1500)
    }
  }

  return (
    <div
      className={`p-5 rounded-xl border border-negative/30 bg-negative-soft/20 text-negative flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 select-none ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon className="size-5 shrink-0 text-negative mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-normal">{msg}</span>
          {autoRetry && onRetry && countdown > 0 && (
            <span className="text-xs text-negative/70">
              Auto-retrying in <span className="font-bold tabular-nums">{countdown}s</span>
            </span>
          )}
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="border-negative/35 text-negative hover:bg-negative/10 hover:text-negative active:scale-[0.98] transition-all gap-1.5 focus-visible:ring-negative/40 shrink-0 font-semibold cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry now'}
        </Button>
      )}
    </div>
  )
}

export default InlineError
