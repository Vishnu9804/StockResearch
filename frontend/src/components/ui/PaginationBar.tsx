/**
 * components/ui/PaginationBar.tsx
 *
 * Professional, production-ready pagination bar used by all Market Pulse
 * and Market Feed paginated lists.
 *
 * Features:
 *   • "Showing X – Y of Z" summary
 *   • Smart page buttons with ellipsis  (1 … 4 5 6 … 20)
 *   • First / Prev / Next / Last buttons
 *   • Per-page limit selector
 *   • Keyboard-accessible, ARIA-labelled
 */

import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface PaginationBarProps {
  total:         number
  page:          number
  limit:         number
  onPageChange:  (page: number) => void
  onLimitChange: (limit: number) => void
  limitOptions?: number[]
  className?:    string
}

const DEFAULT_LIMITS = [10, 15, 25, 50, 100]

function buildPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 1) return total === 1 ? [1] : []
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '…')[] = [1]

  if (current > 4) pages.push('…')

  const start = Math.max(2, current - 2)
  const end   = Math.min(total - 1, current + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 3) pages.push('…')
  pages.push(total)
  return pages
}

export function PaginationBar({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMITS,
  className = '',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total)
  const to   = Math.min(page * limit, total)

  const pageRange = useMemo(() => buildPageRange(page, totalPages), [page, totalPages])

  if (total === 0) return null

  const base =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-xs font-medium ' +
    'transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  const active   = 'bg-accent text-white shadow-sm shadow-accent/30 cursor-default'
  const inactive = 'bg-surface border border-border/50 text-textSecondary hover:bg-surfaceMuted/60 hover:border-accent/40 hover:text-accent cursor-pointer'
  const disabled = 'bg-surface border border-border/30 text-textMuted cursor-not-allowed opacity-40'

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-border/40 bg-surface/40 ${className}`}
    >
      {/* Left – record summary */}
      <p className="text-xs text-textSecondary whitespace-nowrap">
        Showing{' '}
        <span className="font-semibold text-textPrimary">{from.toLocaleString()}</span>
        {'–'}
        <span className="font-semibold text-textPrimary">{to.toLocaleString()}</span>
        {' of '}
        <span className="font-semibold text-textPrimary">{total.toLocaleString()}</span>
        {' results'}
      </p>

      {/* Centre – page buttons */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={`${base} ${page === 1 ? disabled : inactive}`}
          aria-label="First page"
        >
          <ChevronsLeft className="size-3.5" />
        </button>

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${base} ${page === 1 ? disabled : inactive}`}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {pageRange.map((p, idx) =>
          p === '…' ? (
            <span key={`dots-${idx}`} className="px-1 text-xs text-textMuted select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${base} ${p === page ? active : inactive}`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${base} ${page === totalPages ? disabled : inactive}`}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={`${base} ${page === totalPages ? disabled : inactive}`}
          aria-label="Last page"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>

      {/* Right – rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-textSecondary whitespace-nowrap">Rows per page</span>
        <select
          value={limit}
          onChange={(e) => {
            onLimitChange(Number(e.target.value))
            onPageChange(1)
          }}
          className="h-8 rounded-lg border border-border/50 bg-surface px-2 text-xs text-textPrimary
                     focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer
                     hover:border-accent/40 transition-colors"
          aria-label="Rows per page"
        >
          {limitOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default PaginationBar
