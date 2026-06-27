import { Skeleton } from './skeleton'

export function FeedCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border/40 rounded-xl p-5 flex gap-4">
          <Skeleton className="size-9 rounded-xl bg-surfaceMuted shrink-0 animate-pulse" />
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 bg-surfaceMuted animate-pulse" />
              <Skeleton className="h-4 w-16 bg-surfaceMuted animate-pulse" />
              <Skeleton className="h-4 w-24 ml-auto bg-surfaceMuted animate-pulse" />
            </div>
            <Skeleton className="h-5 w-3/4 bg-surfaceMuted animate-pulse" />
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-3 w-full bg-surfaceMuted animate-pulse" />
              <Skeleton className="h-3 w-5/6 bg-surfaceMuted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableRowsSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border/30">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => {
            // Varying widths for cells
            const widthClass = c === 0 ? 'w-8' : c === 1 ? 'w-32' : c === 2 ? 'w-24' : 'w-16'
            return (
              <Skeleton
                key={c}
                className={`h-4 ${widthClass} bg-surfaceMuted animate-pulse ${
                  c > 2 ? 'ml-auto' : ''
                }`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function HubCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/30">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3 w-1/3">
            <Skeleton className="size-4 rounded bg-surfaceMuted animate-pulse shrink-0" />
            <Skeleton className="h-4 w-full bg-surfaceMuted animate-pulse" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full bg-surfaceMuted animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  )
}
