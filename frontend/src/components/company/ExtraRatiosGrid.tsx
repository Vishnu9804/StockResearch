import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCrores, formatIndian, formatNumber } from '@/lib/formatters'
import { useRatioPreferences, type RatioDefinition } from '@/hooks/useRatioPreferences'
import { AddRatioModal } from './AddRatioModal'

function formatRatioValue(value: number | null | undefined, format: RatioDefinition['format']): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  switch (format) {
    case 'percent': return `${formatNumber(value)}%`
    case 'currency': return `₹${formatIndian(value)}`
    case 'crore': return formatCrores(value)
    case 'days': return `${formatNumber(value, 1)}d`
    default: return formatNumber(value)
  }
}

export function ExtraRatiosGrid({ ratios }: { ratios?: Record<string, number | null> }) {
  const { catalog, selectedKeys, addRatios, removeRatio, loading } = useRatioPreferences()
  const [modalOpen, setModalOpen] = useState(false)

  const selectedDefs = catalog.filter((r) => selectedKeys.includes(r.key))
  const availableDefs = catalog.filter((r) => !selectedKeys.includes(r.key))

  if (loading) return null

  return (
    <div className="max-w-[1600px] mx-auto w-full px-6 mt-4 select-none">
      <div className="bg-surface border border-border/40 shadow-xs rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-textPrimary uppercase tracking-wider">Additional Ratios</h3>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 uppercase tracking-wide transition-colors"
          >
            <Plus className="size-3.5" />
            Add Ratio
          </button>
        </div>

        {selectedDefs.length === 0 ? (
          <p className="text-xs text-textMuted py-2">
            No additional ratios pinned yet. Click &ldquo;Add Ratio&rdquo; to choose from {catalog.length}+ ratios like P/E growth, EV/EBITDA, PEG, and more.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {selectedDefs.map((def) => (
              <div
                key={def.key}
                className="group relative flex flex-col gap-1.5 hover:bg-surfaceMuted/50 p-2 rounded-lg transition-colors"
              >
                <button
                  onClick={() => removeRatio(def.key)}
                  aria-label={`Remove ${def.label}`}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-textMuted hover:text-negative transition-opacity"
                >
                  <X className="size-3" />
                </button>
                <span className="text-xs font-medium text-textMuted uppercase tracking-wider leading-none pr-3">
                  {def.label}
                </span>
                <span className={cn('text-sm font-mono font-medium text-textPrimary tabular-nums leading-snug')}>
                  {formatRatioValue(ratios?.[def.key], def.format)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddRatioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        availableRatios={availableDefs}
        onAdd={addRatios}
      />
    </div>
  )
}

export default ExtraRatiosGrid
