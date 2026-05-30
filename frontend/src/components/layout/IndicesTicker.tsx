'use client'

import { marketIndices } from '@/lib/data/market'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function IndicesTicker() {
  return (
    <div className="bg-textPrimary text-white h-7 flex items-center overflow-hidden text-[10px] font-semibold border-b border-border/15 select-none shrink-0">
      {/* Moving wrapper */}
      <div className="flex animate-ticker whitespace-nowrap gap-10 px-4">
        {[...marketIndices, ...marketIndices].map((idx, i) => {
          const positive = idx.change >= 0
          return (
            <div key={`${idx.name}-${i}`} className="flex items-center gap-1.5 font-mono">
              <span className="text-textMuted font-sans tracking-wider uppercase">{idx.name}</span>
              <span className="text-white tabular-nums">{formatNumber(idx.value, 2)}</span>
              <span
                className={cn(
                  'text-[9px] tabular-nums font-bold px-1 rounded-sm border',
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
