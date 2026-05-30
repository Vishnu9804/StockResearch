'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnalystEntry {
  firm: string
  analyst: string
  rating: 'BUY' | 'HOLD' | 'SELL'
  target: number
  upside: number
}

function buildAnalysts(symbol: string, cmp: number, pe: number): { entries: AnalystEntry[]; buy: number; hold: number; sell: number; consensusTarget: number } {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1)
  const premium = 1 + (seed % 20) / 100
  const consensusTarget = Math.round(cmp * premium * 10) / 10

  const entries: AnalystEntry[] = [
    { firm: 'Motilal Oswal', analyst: 'Rajesh Kumar', rating: 'BUY', target: Math.round(cmp * 1.18), upside: 18 },
    { firm: 'ICICI Securities', analyst: 'Priya Sharma', rating: pe > 40 ? 'HOLD' : 'BUY', target: Math.round(cmp * 1.12), upside: 12 },
    { firm: 'Kotak Institutional', analyst: 'Anil Mehta', rating: 'BUY', target: Math.round(cmp * 1.22), upside: 22 },
    { firm: 'Axis Capital', analyst: 'Deepika Rao', rating: pe > 50 ? 'SELL' : 'HOLD', target: Math.round(cmp * (pe > 50 ? 0.92 : 1.05)), upside: pe > 50 ? -8 : 5 },
    { firm: 'JM Financial', analyst: 'Rohit Gupta', rating: 'BUY', target: Math.round(cmp * 1.15), upside: 15 },
  ]

  const buy = entries.filter(e => e.rating === 'BUY').length
  const hold = entries.filter(e => e.rating === 'HOLD').length
  const sell = entries.filter(e => e.rating === 'SELL').length

  return { entries, buy, hold, sell, consensusTarget }
}

const RATING_COLORS = { BUY: '#22c55e', HOLD: '#f59e0b', SELL: '#ef4444' }
const RATING_BADGE: Record<'BUY' | 'HOLD' | 'SELL', string> = {
  BUY: 'bg-positive-soft text-positive border border-green-200',
  HOLD: 'bg-warning-soft text-warning border border-amber-200',
  SELL: 'bg-negative-soft text-negative border border-red-200',
}

export function AnalystConsensus({ symbol, cmp, pe }: { symbol: string; cmp: number; pe: number }) {
  const { entries, buy, hold, sell, consensusTarget } = useMemo(
    () => buildAnalysts(symbol, cmp, pe),
    [symbol, cmp, pe]
  )

  const upside = ((consensusTarget - cmp) / cmp) * 100
  const positive = upside >= 0

  const pieData = [
    { name: 'Buy', value: buy, color: RATING_COLORS.BUY },
    { name: 'Hold', value: hold, color: RATING_COLORS.HOLD },
    { name: 'Sell', value: sell, color: RATING_COLORS.SELL },
  ].filter(d => d.value > 0)

  const consensusLabel = buy > hold + sell ? 'Strong Buy' : hold > buy + sell ? 'Neutral' : 'Cautious'

  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
        <CardTitle className="text-sm font-bold text-textPrimary uppercase tracking-wide">
          Analyst Consensus
        </CardTitle>
        <p className="text-[11px] text-textMuted mt-0.5">{entries.length} analyst ratings · 12-month target</p>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Donut + stats */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} analysts`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-textPrimary">{consensusLabel}</span>
                <span className="text-[10px] text-textMuted">{entries.length} analysts</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-positive font-mono">{buy}</span>
                <span className="text-[10px] text-textMuted font-semibold uppercase">Buy</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-warning font-mono">{hold}</span>
                <span className="text-[10px] text-textMuted font-semibold uppercase">Hold</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-negative font-mono">{sell}</span>
                <span className="text-[10px] text-textMuted font-semibold uppercase">Sell</span>
              </div>
            </div>

            {/* Consensus target */}
            <div className="mt-4 w-full p-3 rounded-xl bg-surfaceMuted border border-border text-center">
              <p className="text-[10px] text-textMuted font-semibold uppercase tracking-wider">12M Consensus Target</p>
              <p className="text-xl font-bold font-mono text-textPrimary mt-1">₹{consensusTarget.toLocaleString('en-IN')}</p>
              <div className={cn('flex items-center justify-center gap-1 text-xs font-bold mt-0.5', positive ? 'text-positive' : 'text-negative')}>
                {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {positive ? '+' : ''}{upside.toFixed(1)}% from CMP
              </div>
            </div>
          </div>

          {/* Right: Analyst list */}
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.firm} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surfaceMuted/30 hover:bg-surfaceMuted transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-textPrimary truncate">{entry.firm}</p>
                  <p className="text-[10px] text-textMuted truncate">{entry.analyst}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs font-mono font-semibold text-textPrimary">₹{entry.target.toLocaleString('en-IN')}</p>
                    <p className={cn('text-[10px] font-mono', entry.upside >= 0 ? 'text-positive' : 'text-negative')}>
                      {entry.upside >= 0 ? '+' : ''}{entry.upside}%
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('text-[9px] font-bold shadow-none px-1.5', RATING_BADGE[entry.rating])}>
                    {entry.rating === 'BUY' ? <TrendingUp className="size-2.5 mr-0.5" /> : entry.rating === 'SELL' ? <TrendingDown className="size-2.5 mr-0.5" /> : <Minus className="size-2.5 mr-0.5" />}
                    {entry.rating}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AnalystConsensus
