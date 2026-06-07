
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutGrid } from 'lucide-react'

const SECTORS = [
  { name: 'Financial Services', change: 0.84, weight: 33.2, color: { positive: '#1d4ed8', negative: '#1e3a8a' } },
  { name: 'Information Tech', change: 1.12, weight: 13.8, color: { positive: '#7c3aed', negative: '#4c1d95' } },
  { name: 'Energy', change: -0.43, weight: 12.4, color: { positive: '#d97706', negative: '#92400e' } },
  { name: 'Consumer Disc.', change: 2.31, weight: 9.6, color: { positive: '#059669', negative: '#064e3b' } },
  { name: 'FMCG', change: -1.18, weight: 7.2, color: { positive: '#db2777', negative: '#831843' } },
  { name: 'Healthcare', change: 0.56, weight: 5.8, color: { positive: '#0891b2', negative: '#164e63' } },
  { name: 'Industrials', change: 1.87, weight: 5.1, color: { positive: '#65a30d', negative: '#365314' } },
  { name: 'Realty', change: -0.77, weight: 4.2, color: { positive: '#ea580c', negative: '#7c2d12' } },
  { name: 'Metals', change: 3.21, weight: 3.6, color: { positive: '#6b7280', negative: '#374151' } },
  { name: 'Auto', change: 1.44, weight: 3.1, color: { positive: '#0d9488', negative: '#134e4a' } },
  { name: 'Media', change: -2.14, weight: 1.0, color: { positive: '#7c3aed', negative: '#4c1d95' } },
]

function getHeatColor(change: number): string {
  if (change > 2) return '#15803d'
  if (change > 1) return '#16a34a'
  if (change > 0) return '#22c55e'
  if (change > -1) return '#ef4444'
  if (change > -2) return '#dc2626'
  return '#b91c1c'
}

function getTextColor(change: number): string {
  return Math.abs(change) > 0.3 ? '#ffffff' : '#f1f5f9'
}

export function MarketHeatmap() {
  const navigate = useNavigate()

  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-accent" />
          <CardTitle className="text-sm font-bold text-textPrimary uppercase tracking-wide">Sectoral Heatmap</CardTitle>
        </div>
        <p className="text-[11px] text-textMuted">NSE Sectors · Day Change %</p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {SECTORS.map((sector) => {
            const bgColor = getHeatColor(sector.change)
            const textColor = getTextColor(sector.change)
            const positive = sector.change >= 0
            const tileHeight = Math.max(60, Math.min(90, 50 + sector.weight * 2))

            return (
              <button
                key={sector.name}
                onClick={() => navigate('/screener')}
                className="rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.97] cursor-pointer select-none"
                style={{ backgroundColor: bgColor, height: tileHeight, color: textColor }}
              >
                <span className="text-[10px] font-bold text-center leading-tight px-1 opacity-95">{sector.name}</span>
                <span className="text-sm font-bold font-mono tabular-nums mt-0.5">
                  {positive ? '+' : ''}{sector.change.toFixed(2)}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-1.5">
            {[
              { color: '#b91c1c', label: '< -2%' },
              { color: '#ef4444', label: '-1%' },
              { color: '#94a3b8', label: '0%' },
              { color: '#22c55e', label: '+1%' },
              { color: '#15803d', label: '> +2%' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="size-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                <span className="text-[9px] text-textMuted font-mono">{l.label}</span>
              </div>
            ))}
          </div>
          <span className="text-[9px] text-textMuted font-medium">Tile size ∝ sector weight</span>
        </div>
      </CardContent>
    </Card>
  )
}
