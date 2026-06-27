import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './button'

export interface InlineErrorProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function InlineError({
  message = 'Failed to load data. Please check your connection and try again.',
  onRetry,
  className = '',
}: InlineErrorProps) {
  return (
    <div className={`p-5 rounded-xl border border-negative/30 bg-negative-soft/20 text-negative flex flex-col sm:flex-row items-center sm:justify-between gap-4 select-none ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <AlertCircle className="size-5 shrink-0 text-negative" />
        <span className="text-sm font-medium leading-normal">{message}</span>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-negative/35 text-negative hover:bg-negative/10 hover:text-negative active:scale-[0.98] transition-all gap-1.5 focus-visible:ring-negative/40 shrink-0 font-semibold cursor-pointer"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  )
}

export default InlineError
