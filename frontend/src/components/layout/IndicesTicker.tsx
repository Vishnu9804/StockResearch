import { useState, useEffect } from 'react'
import { finscreenClient } from '@/services/finscreenApi'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface IndexItem {
  name: string
  value: number
  change: number
  changePct: number
}

// Key indices to show in the ticker (symbol → display name)
const KEY_SYMBOLS: Record<string, string> = {
  'NIF50': 'NIFTY 50',
  'SNSXBSE30': 'SENSEX',
  'NIFBAN': 'BANK NIFTY',
  'NIFIT': 'NIFTY IT',
  'NIFMID': 'NIFTY MIDCAP',
  'INDVIX': 'INDIA VIX',
}

export function IndicesTicker() {
  const [indices, setIndices] = useState<IndexItem[]>([])

  useEffect(() => {
    let cancelled = false
    finscreenClient.get<any[]>('/market/indices')
      .then(res => {
        if (cancelled) return
        const data: any[] = Array.isArray(res.data) ? res.data : []
        const filtered: IndexItem[] = []
        // Pull key symbols first (in display order)
        for (const [sym, displayName] of Object.entries(KEY_SYMBOLS)) {
          const match = data.find((d: any) =>
            d.symbol === sym || d.index_symbol === sym || d.index_name === displayName
          )
          if (match) {
            filtered.push({
              name: displayName,
              value: parseFloat(match.close_price || match.ltp || match.value || 0),
              change: parseFloat(match.change || match.net_change || 0),
              changePct: parseFloat(match.pct_change || match.change_pct || 0),
            })
          }
        }
        // Fallback: if no key symbols matched, show first 6 from API
        if (filtered.length === 0 && data.length > 0) {
          data.slice(0, 6).forEach((d: any) => {
            filtered.push({
              name: d.index_name || d.name || d.symbol || '—',
              value: parseFloat(d.close_price || d.ltp || d.value || 0),
              change: parseFloat(d.change || d.net_change || 0),
              changePct: parseFloat(d.pct_change || d.change_pct || 0),
            })
          })
        }
        setIndices(filtered)
      })
      .catch(() => {/* keep silent — ticker non-critical */})
    return () => { cancelled = true }
  }, [])

  // While loading, render nothing (ticker bar still shows but empty — graceful)
  const display = indices.length > 0 ? indices : []

  return (
    <div className="bg-textPrimary text-white h-7 flex items-center overflow-hidden text-xs font-medium border-b border-border/15 select-none shrink-0">
      {/* ticker-track class is defined in globals.css with ticker-scroll keyframes */}
      <div className="ticker-track whitespace-nowrap gap-10 px-4">
        {[...display, ...display].map((idx, i) => {
          const positive = idx.changePct >= 0
          return (
            <div key={`${idx.name}-${i}`} className="inline-flex items-center gap-1.5 font-mono mr-10">
              <span className="text-textMuted font-sans tracking-wider uppercase">{idx.name}</span>
              <span className="text-white tabular-nums">{formatNumber(idx.value, 2)}</span>
              <span
                className={cn(
                  'text-xs tabular-nums font-medium px-1 rounded-sm border',
                  positive
                    ? 'bg-positive-soft/20 text-positive border-positive/25'
                    : 'bg-negative-soft/20 text-negative border-negative/25'
                )}
              >
                {positive ? '+' : ''}
                {formatNumber(idx.change, 2)} ({positive ? '+' : ''}
                {idx.changePct.toFixed(2)}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
