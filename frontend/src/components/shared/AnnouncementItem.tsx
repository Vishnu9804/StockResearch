import React from 'react'
import { Link } from 'react-router-dom'
import { type Announcement } from '@/lib/data/market-pulse'

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Board Meeting': { bg: 'var(--fs-info-soft)', text: 'var(--fs-info)' },
  'Concall':       { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Annual Report': { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Dividend':      { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Merger':        { bg: 'var(--fs-accent-soft)', text: 'var(--fs-accent)' },
  'Capacity':      { bg: 'var(--fs-accent-soft)', text: 'var(--fs-accent)' },
  'Resignation':   { bg: 'var(--fs-negative-soft)', text: 'var(--fs-negative)' },
  'Award':         { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Results':       { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Other':         { bg: 'var(--fs-surface-muted)', text: 'var(--fs-text-secondary)' },
}

interface AnnouncementItemProps {
  item: Announcement
  density: 'comfortable' | 'compact'
  isActive?: boolean
  actionButtons?: React.ReactNode
}

export function AnnouncementItem({ item, density, isActive = false, actionButtons }: AnnouncementItemProps) {
  const colors = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['Other']

  // Spacing styles based on density
  const rowPadding = density === 'compact' ? 'py-2.5 px-5' : 'py-5 px-5'
  const textSpacing = density === 'compact' ? 'space-y-0.5' : 'space-y-1.5'
  const titleSize = density === 'compact' ? 'text-xs' : 'text-sm'
  const metaMargin = density === 'compact' ? 'mt-1.5' : 'mt-3.5'

  const activeClasses = isActive
    ? 'border-l-3 border-l-accent bg-accentSoft/10'
    : 'border-l-3 border-l-transparent hover:bg-surfaceMuted/20'

  return (
    <div
      className={`transition-colors duration-150 relative ${rowPadding} ${activeClasses} flex flex-col justify-between select-none outline-ring/45 focus-visible:outline`}
      tabIndex={0}
    >
      <div className={`w-full ${textSpacing}`}>
        {/* Line 1: Company details, Badge, Timestamp */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/company/${item.symbol.toLowerCase()}`}
              className="text-xs font-bold text-accent hover:underline decoration-none outline-none font-mono"
            >
              {item.company}
            </Link>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {item.category}
            </span>
            <span className="text-textMuted text-xs font-medium">·</span>
            <Link
              to={`/market-pulse/queries/new?query=${encodeURIComponent(item.category)}`}
              className="text-[11px] font-semibold text-textSecondary hover:text-accent hover:underline decoration-none outline-none"
            >
              Create search filter
            </Link>
          </div>
          <span className="text-[11px] text-textMuted font-medium select-none">
            {item.date}
          </span>
        </div>

        {/* Line 2: Headline / Title */}
        <h3 className={`font-semibold text-textPrimary leading-snug ${titleSize}`}>
          {item.title}
        </h3>

        {/* Line 3: Description / Summary */}
        <p className="text-xs text-textSecondary leading-relaxed">
          {item.summary}
        </p>

        {/* Line 4: Metadata and custom actions */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${metaMargin}`}>
          {/* Muted Metadata */}
          <span className="text-[10px] text-textMuted font-medium tracking-wide uppercase select-none">
            NSE: {item.symbol} · Series: EQ · Equity
          </span>

          {/* Action Buttons Container */}
          {actionButtons && (
            <div className="flex flex-wrap gap-2 items-center">
              {actionButtons}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default AnnouncementItem
