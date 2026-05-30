'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const GAINERS = [
  { symbol: 'MARUTI', name: 'Maruti Suzuki', cmp: 13240, change: 2.12, volume: '8.2L' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', cmp: 7856, change: 1.87, volume: '12.4L' },
  { symbol: 'LT', name: 'Larsen & Toubro', cmp: 3512, change: 1.56, volume: '6.8L' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', cmp: 1687, change: 0.52, volume: '24.1L' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', cmp: 2847, change: 1.24, volume: '18.7L' },
]

const LOSERS = [
  { symbol: 'WIPRO', name: 'Wipro Ltd', cmp: 459, change: -1.44, volume: '14.2L' },
  { symbol: 'TCS', name: 'TCS Ltd', cmp: 3956, change: -1.12, volume: '9.3L' },
  { symbol: 'INFY', name: 'Infosys Ltd', cmp: 1521, change: -0.78, volume: '11.6L' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', cmp: 2412, change: -0.52, volume: '7.1L' },
  { symbol: 'TITAN', name: 'Titan Company', cmp: 3398, change: -0.23, volume: '5.4L' },
]

const ACTIVE = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank', cmp: 1687, change: 0.52, volume: '24.1L' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', cmp: 2847, change: 1.24, volume: '18.7L' },
  { symbol: 'INFY', name: 'Infosys Ltd', cmp: 1521, change: -0.78, volume: '11.6L' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', cmp: 7856, change: 1.87, volume: '12.4L' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', cmp: 459, change: -1.44, volume: '14.2L' },
]

type Tab = 'gainers' | 'losers' | 'active'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'gainers', label: 'Top Gainers', icon: TrendingUp },
  { id: 'losers', label: 'Top Losers', icon: TrendingDown },
  { id: 'active', label: 'Most Active', icon: Zap },
]

export function TopMovers() {
  const [activeTab, setActiveTab] = useState<Tab>('gainers')

  const data = activeTab === 'gainers' ? GAINERS : activeTab === 'losers' ? LOSERS : ACTIVE

  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-bold text-textPrimary uppercase tracking-wide">Top Movers</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 pb-4">
        {/* Tabs */}
        <div className="flex border-b border-border/50 mb-3">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                  isActive ? 'text-accent' : 'text-textMuted hover:text-textSecondary'
                )}
              >
                <Icon className="size-3" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-accent rounded-t-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="space-y-0 divide-y divide-border/30">
          {data.map((stock, i) => {
            const positive = stock.change >= 0
            return (
              <Link
                key={stock.symbol}
                to={`/company/${stock.symbol}`}
                className="flex items-center justify-between py-2.5 hover:bg-surfaceMuted -mx-1 px-1 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-textMuted w-4 tabular-nums">{i + 1}</span>
                  <div>
                    <p className="text-xs font-bold text-textPrimary group-hover:text-accent transition-colors font-mono">{stock.symbol}</p>
                    <p className="text-[10px] text-textMuted truncate max-w-[120px]">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-semibold text-textPrimary tabular-nums">₹{stock.cmp.toLocaleString('en-IN')}</p>
                  <p className={cn('text-[10px] font-mono font-bold tabular-nums flex items-center justify-end gap-0.5', positive ? 'text-positive' : 'text-negative')}>
                    {positive ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                    {positive ? '+' : ''}{stock.change.toFixed(2)}%
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
