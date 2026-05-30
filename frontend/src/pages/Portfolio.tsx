import { Link } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id: string
  symbol: string
  name: string
  sector: string
  qty: number
  avgCost: number
  cmp: number
  dayChange: number
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const HOLDINGS: Holding[] = [
  { id: '1', symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', qty: 50, avgCost: 2450.0, cmp: 2847.35, dayChange: 1.24 },
  { id: '2', symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', qty: 120, avgCost: 1380.5, cmp: 1521.80, dayChange: -0.78 },
  { id: '3', symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', qty: 80, avgCost: 1550.0, cmp: 1687.45, dayChange: 0.52 },
  { id: '4', symbol: 'TCS', name: 'TCS Ltd', sector: 'IT', qty: 30, avgCost: 3600.0, cmp: 3956.20, dayChange: -1.12 },
  { id: '5', symbol: 'NESTLEIND', name: 'Nestle India', sector: 'FMCG', qty: 15, avgCost: 2100.0, cmp: 2298.75, dayChange: 0.18 },
  { id: '6', symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', qty: 40, avgCost: 3100.0, cmp: 3398.00, dayChange: -0.23 },
  { id: '7', symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Auto', qty: 10, avgCost: 10200.0, cmp: 13240.00, dayChange: 2.12 },
  { id: '8', symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', qty: 500, avgCost: 390.0, cmp: 453.80, dayChange: 0.34 },
]

const SPARKLINE_DATA = [
  { t: '9:15', v: 4820000 },
  { t: '10:00', v: 4835000 },
  { t: '11:00', v: 4798000 },
  { t: '12:00', v: 4862000 },
  { t: '13:00', v: 4880000 },
  { t: '14:00', v: 4841000 },
  { t: '15:00', v: 4892000 },
  { t: '15:30', v: 4910432 },
]

const SECTOR_COLORS: Record<string, string> = {
  Energy: '#1D4ED8',
  IT: '#7C3AED',
  Banking: '#0891B2',
  FMCG: '#16A34A',
  Consumer: '#EA580C',
  Auto: '#D97706',
}

function computeHoldings(holdings: Holding[]) {
  return holdings.map((h) => {
    const totalCost = h.qty * h.avgCost
    const currentValue = h.qty * h.cmp
    const totalPnl = currentValue - totalCost
    const totalPnlPct = (totalPnl / totalCost) * 100
    const dayPnl = h.qty * h.cmp * (h.dayChange / 100)
    return { ...h, totalCost, currentValue, totalPnl, totalPnlPct, dayPnl }
  })
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Portfolio() {
  const computed = computeHoldings(HOLDINGS)
  const totalValue = computed.reduce((s, h) => s + h.currentValue, 0)
  const totalCost = computed.reduce((s, h) => s + h.totalCost, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = (totalPnl / totalCost) * 100
  const todayPnl = computed.reduce((s, h) => s + h.dayPnl, 0)
  const buyingPower = 142800

  // Sector allocation for pie
  const sectorMap: Record<string, number> = {}
  computed.forEach((h) => {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.currentValue
  })
  const pieData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }))

  // Summary stats
  const totalStocks = HOLDINGS.length
  const profitStocks = computed.filter((h) => h.totalPnl > 0).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4">
        <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
          <Link to="/" className="hover:text-accent transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Text as="span" variant="bodyMuted" className="text-xs">Portfolio</Text>
        </nav>
        <Heading level={1} variant="pageTitle">My Portfolio</Heading>
      </div>

      <div className="p-6 space-y-6">
        {/* Sparkline */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Text variant="body" className="font-semibold text-textSecondary">Today&apos;s Performance</Text>
            <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${todayPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
              {todayPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {todayPnl >= 0 ? '+' : ''}{formatCurrency(todayPnl)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={SPARKLINE_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <RechartsTooltip
                formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#1D4ED8"
                strokeWidth={2}
                fill="url(#portfolioGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Portfolio Value"
            value={formatCurrency(totalValue)}
            sub={`${totalStocks} holdings · ${profitStocks} in profit`}
            color={totalPnl >= 0 ? 'green' : 'red'}
            delta={`${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)} (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%)`}
          />
          <SummaryCard
            label="Buying Power"
            value={formatCurrency(buyingPower)}
            sub="Available margin"
            color="blue"
          />
          <SummaryCard
            label="Today's P&L"
            value={`${todayPnl >= 0 ? '+' : ''}${formatCurrency(todayPnl)}`}
            sub="Intraday change"
            color={todayPnl >= 0 ? 'green' : 'red'}
          />
          <SummaryCard
            label="Risk Score"
            value="6.2 / 10"
            sub="Moderate risk portfolio"
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Holdings Table */}
          <div className="xl:col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <Heading level={3} variant="sectionTitle" className="text-sm font-semibold text-textPrimary">Holdings</Heading>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surfaceMuted border-b border-border/50">
                    <th className="px-4 py-2 text-left text-xs text-textSecondary font-semibold">Symbol</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-semibold">Qty</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-semibold">Avg Cost</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-semibold">CMP</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-semibold">Day %</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-semibold">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {computed.map((h) => (
                    <tr key={h.id} className="hover:bg-tableRowHover transition-colors">
                      <td className="px-4 py-2.5">
                        <Link to={`/company/${h.symbol.toLowerCase()}`}>
                          <Text variant="body" className="font-semibold text-textPrimary hover:text-accent transition-colors">
                            {h.symbol}
                          </Text>
                          <Text variant="caption" className="text-textMuted text-xs">{h.name}</Text>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Text variant="numeric" className="text-textSecondary">{h.qty}</Text>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Text variant="numeric" className="text-textSecondary">₹{formatPrice(h.avgCost)}</Text>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Text variant="numeric" className="text-textPrimary">₹{formatPrice(h.cmp)}</Text>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs tabular-nums ${h.dayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {h.dayChange >= 0 ? '+' : ''}{h.dayChange.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${h.totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                        <div className="font-mono text-sm font-semibold">
                          {h.totalPnl >= 0 ? '+' : ''}{formatCurrency(h.totalPnl)}
                        </div>
                        <div className="font-mono text-xs opacity-75">
                          ({h.totalPnlPct >= 0 ? '+' : ''}{h.totalPnlPct.toFixed(2)}%)
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-surfaceMuted border-t border-border font-semibold">
                    <td className="px-4 py-3" colSpan={5}>
                      <Text variant="body" className="font-semibold text-textPrimary">Total Portfolio</Text>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                      <div className="font-bold">
                        {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                      </div>
                      <div className="text-xs opacity-75">
                        ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <Heading level={3} variant="sectionTitle" className="text-sm font-semibold text-textPrimary mb-3">Allocation</Heading>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SECTOR_COLORS[entry.name] ?? '#94A3B8'}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [formatCurrency(value), 'Value']}
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Sector breakdown */}
              <div className="space-y-2 mt-2">
                {pieData.map((d) => {
                  const pct = (d.value / totalValue) * 100
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: SECTOR_COLORS[d.name] ?? '#94A3B8' }}
                        />
                        <Text variant="caption" className="text-textSecondary text-xs">{d.name}</Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-surfaceMuted rounded-full h-1.5 border border-border/20">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: SECTOR_COLORS[d.name] ?? '#94A3B8',
                            }}
                          />
                        </div>
                        <Text variant="numeric" className="text-xs text-textMuted w-10 text-right">
                          {pct.toFixed(1)}%
                        </Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Risk alert */}
            <div className="bg-warning-soft border border-warning/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <Text variant="body" className="font-semibold text-warning">Concentration Risk</Text>
                  <Text variant="caption" className="text-textSecondary mt-1 leading-snug text-xs font-medium">
                    IT sector accounts for {((sectorMap['IT'] ?? 0) / totalValue * 100).toFixed(0)}% of your portfolio. Consider diversifying.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: string
  sub: string
  color: 'green' | 'red' | 'blue' | 'amber'
  delta?: string
}

const cardColors = {
  green: 'text-positive',
  red: 'text-negative',
  blue: 'text-accent',
  amber: 'text-warning',
}

function SummaryCard({ label, value, sub, color, delta }: SummaryCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-none">
      <Text variant="caption" className="text-textSecondary font-semibold text-xs">{label}</Text>
      <Text variant="pageTitle" className={`text-xl font-bold font-mono mt-1 ${cardColors[color]}`}>{value}</Text>
      {delta && <Text variant="numeric" className="text-xs text-textSecondary mt-0.5">{delta}</Text>}
      <Text variant="caption" className="text-textMuted mt-0.5 text-xs">{sub}</Text>
    </div>
  )
}

export default Portfolio

