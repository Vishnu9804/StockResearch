import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, AlertCircle, Plus, Trash2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { companies } from '@/lib/data/companies'
import {
  PieChart, Pie, Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis,
} from 'recharts'

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

type SparklinePeriod = 'Today' | '1W' | '1M' | '1Y'

const INITIAL_HOLDINGS: Holding[] = [
  { id: '1', symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', qty: 50, avgCost: 2450.0, cmp: 2847.35, dayChange: 1.24 },
  { id: '2', symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', qty: 120, avgCost: 1380.5, cmp: 1521.80, dayChange: -0.78 },
  { id: '3', symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking', qty: 80, avgCost: 1550.0, cmp: 1687.45, dayChange: 0.52 },
  { id: '4', symbol: 'TCS', name: 'TCS Ltd', sector: 'IT', qty: 30, avgCost: 3600.0, cmp: 3956.20, dayChange: -1.12 },
  { id: '5', symbol: 'NESTLEIND', name: 'Nestle India', sector: 'FMCG', qty: 15, avgCost: 2100.0, cmp: 2298.75, dayChange: 0.18 },
  { id: '6', symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', qty: 40, avgCost: 3100.0, cmp: 3398.00, dayChange: -0.23 },
  { id: '7', symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Auto', qty: 10, avgCost: 10200.0, cmp: 13240.00, dayChange: 2.12 },
  { id: '8', symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', qty: 500, avgCost: 390.0, cmp: 453.80, dayChange: 0.34 },
]

const SPARKLINE_SETS: Record<SparklinePeriod, { t: string; v: number }[]> = {
  Today: [
    { t: '9:15', v: 4820000 }, { t: '10:00', v: 4835000 }, { t: '11:00', v: 4798000 },
    { t: '12:00', v: 4862000 }, { t: '13:00', v: 4880000 }, { t: '14:00', v: 4841000 },
    { t: '15:00', v: 4892000 }, { t: '15:30', v: 4910432 },
  ],
  '1W': [
    { t: 'Mon', v: 4720000 }, { t: 'Tue', v: 4780000 }, { t: 'Wed', v: 4750000 },
    { t: 'Thu', v: 4820000 }, { t: 'Fri', v: 4910432 },
  ],
  '1M': [
    { t: 'W1', v: 4560000 }, { t: 'W2', v: 4620000 }, { t: 'W3', v: 4700000 },
    { t: 'W4', v: 4850000 }, { t: 'W5', v: 4910432 },
  ],
  '1Y': [
    { t: 'Jun', v: 3800000 }, { t: 'Aug', v: 4050000 }, { t: 'Oct', v: 4200000 },
    { t: 'Dec', v: 4450000 }, { t: 'Feb', v: 4650000 }, { t: 'Apr', v: 4810000 },
    { t: 'May', v: 4910432 },
  ],
}

const SECTOR_COLORS: Record<string, string> = {
  Energy: '#1D4ED8', IT: '#7C3AED', Banking: '#0891B2',
  FMCG: '#16A34A', Consumer: '#EA580C', Auto: '#D97706',
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
  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_HOLDINGS)
  const [period, setPeriod] = useState<SparklinePeriod>('Today')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addCost, setAddCost] = useState('')
  const [addSelected, setAddSelected] = useState<typeof companies[0] | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const computed = computeHoldings(holdings)
  const totalValue = computed.reduce((s, h) => s + h.currentValue, 0)
  const totalCost = computed.reduce((s, h) => s + h.totalCost, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = (totalPnl / totalCost) * 100
  const todayPnl = computed.reduce((s, h) => s + h.dayPnl, 0)
  const buyingPower = 142800
  const profitStocks = computed.filter((h) => h.totalPnl > 0).length

  const sectorMap: Record<string, number> = {}
  computed.forEach((h) => { sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.currentValue })
  const pieData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }))

  const sparklineData = SPARKLINE_SETS[period]

  const searchResults = useMemo(() => {
    if (!addSearch.trim()) return []
    const q = addSearch.toLowerCase()
    return companies
      .filter(c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .slice(0, 5)
  }, [addSearch])

  const handleAddHolding = () => {
    if (!addSelected || !addQty || !addCost) return
    const qty = parseFloat(addQty)
    const cost = parseFloat(addCost)
    if (isNaN(qty) || isNaN(cost) || qty <= 0 || cost <= 0) return
    const existing = holdings.findIndex(h => h.symbol === addSelected.symbol)
    if (existing >= 0) {
      // Merge — weighted avg cost
      setHoldings(prev => prev.map((h, i) => {
        if (i !== existing) return h
        const totalShares = h.qty + qty
        const newAvg = (h.qty * h.avgCost + qty * cost) / totalShares
        return { ...h, qty: totalShares, avgCost: newAvg }
      }))
    } else {
      const newHolding: Holding = {
        id: `hold-${Date.now()}`,
        symbol: addSelected.symbol,
        name: addSelected.name,
        sector: addSelected.sector,
        qty,
        avgCost: cost,
        cmp: addSelected.price,
        dayChange: addSelected.changePct,
      }
      setHoldings(prev => [...prev, newHolding])
    }
    setShowAddModal(false)
    setAddSearch('')
    setAddQty('')
    setAddCost('')
    setAddSelected(null)
  }

  const handleDelete = (id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  const MOCK_TRANSACTIONS = [
    { date: '2024-01-15', symbol: 'RELIANCE', type: 'BUY', qty: 30, price: 2380.0 },
    { date: '2024-02-20', symbol: 'INFY', type: 'BUY', qty: 120, price: 1380.5 },
    { date: '2024-03-05', symbol: 'RELIANCE', type: 'BUY', qty: 20, price: 2560.0 },
    { date: '2024-04-11', symbol: 'TCS', type: 'BUY', qty: 30, price: 3600.0 },
    { date: '2024-05-22', symbol: 'MARUTI', type: 'BUY', qty: 10, price: 10200.0 },
    { date: '2024-06-08', symbol: 'ITC', type: 'BUY', qty: 500, price: 390.0 },
    { date: '2024-09-14', symbol: 'HDFCBANK', type: 'BUY', qty: 80, price: 1550.0 },
    { date: '2025-01-20', symbol: 'NESTLEIND', type: 'BUY', qty: 15, price: 2100.0 },
    { date: '2025-03-03', symbol: 'TITAN', type: 'BUY', qty: 40, price: 3100.0 },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-xs text-textSecondary/70 mb-1.5">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <span className="mx-1.5">›</span>
            <span className="text-accent font-medium">Portfolio</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Heading level={1} variant="pageTitle" className="text-textPrimary">
                My Portfolio
              </Heading>
              <p className="text-body text-textSecondary mt-1">
                Track and analyze your investments ·{' '}
                <span className="font-medium text-accent">
                  {holdings.length} Positions
                </span>
              </p>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="gap-1.5 h-8 text-xs font-medium bg-accent text-white hover:bg-accent/90 shadow-none"
            >
              <Plus className="w-3.5 h-3.5" /> Add Holding
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Sparkline with period selector */}
        <div className="bg-surface border border-border/40 shadow-xs rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Text variant="body" className="font-medium text-textSecondary">Portfolio Value Performance</Text>
              <div className={`flex items-center gap-1 text-sm font-mono font-medium mt-0.5 ${todayPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                {todayPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {todayPnl >= 0 ? '+' : ''}{formatCurrency(todayPnl)} today
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(['Today', '1W', '1M', '1Y'] as SparklinePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    period === p ? 'bg-accent text-white' : 'text-textMuted hover:bg-surfaceMuted'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
              <Area type="monotone" dataKey="v" stroke="#1D4ED8" strokeWidth={2} fill="url(#portfolioGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Portfolio Value" value={formatCurrency(totalValue)}
            sub={`${holdings.length} holdings · ${profitStocks} in profit`} color={totalPnl >= 0 ? 'green' : 'red'}
            delta={`${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)} (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%)`} />
          <SummaryCard label="Buying Power" value={formatCurrency(buyingPower)} sub="Available margin" color="blue" />
          <SummaryCard label="Today's P&L" value={`${todayPnl >= 0 ? '+' : ''}${formatCurrency(todayPnl)}`}
            sub="Intraday change" color={todayPnl >= 0 ? 'green' : 'red'} />
          <SummaryCard label="Risk Score" value="6.2 / 10" sub="Moderate risk portfolio" color="amber" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Holdings Table */}
          <div className="xl:col-span-2 bg-surface border border-border/40 shadow-xs rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <Heading level={3} className="text-lg font-semibold text-textPrimary">Holdings</Heading>
              <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)}
                className="h-7 text-xs text-accent hover:text-accent gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-surfaceMuted/50 border-b border-border/40">
                    <th className="px-4 py-2.5 text-left text-xs text-textSecondary font-medium">Symbol</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-medium">Qty</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-medium">Avg Cost</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-medium">CMP</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-medium">Day %</th>
                    <th className="px-4 py-2 text-right text-xs text-textSecondary font-medium">Total P&L</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {computed.map((h) => (
                    <tr key={h.id} className="hover:bg-tableRowHover transition-colors group">
                      <td className="px-4 py-2.5">
                        <Link to={`/company/${h.symbol.toLowerCase()}`}>
                          <Text variant="body" className="font-medium text-textPrimary hover:text-accent transition-colors">{h.symbol}</Text>
                          <Text variant="caption" className="text-textMuted text-xs">{h.name}</Text>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right"><Text variant="numeric" className="text-textSecondary">{h.qty}</Text></td>
                      <td className="px-4 py-2.5 text-right"><Text variant="numeric" className="text-textSecondary">₹{formatPrice(h.avgCost)}</Text></td>
                      <td className="px-4 py-2.5 text-right"><Text variant="numeric" className="text-textPrimary">₹{formatPrice(h.cmp)}</Text></td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs tabular-nums ${h.dayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {h.dayChange >= 0 ? '+' : ''}{h.dayChange.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${h.totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                        <div className="font-mono text-sm font-medium">{h.totalPnl >= 0 ? '+' : ''}{formatCurrency(h.totalPnl)}</div>
                        <div className="font-mono text-xs opacity-75">({h.totalPnlPct >= 0 ? '+' : ''}{h.totalPnlPct.toFixed(2)}%)</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-textMuted hover:text-negative hover:bg-red-50 transition-all"
                          title="Remove holding"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surfaceMuted border-t border-border font-medium">
                    <td className="px-4 py-3" colSpan={5}><Text variant="body" className="font-medium text-textPrimary">Total Portfolio</Text></td>
                    <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${totalPnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                      <div className="font-medium">{totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}</div>
                      <div className="text-xs opacity-75">({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)</div>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="bg-surface border border-border/40 shadow-xs rounded-2xl p-5">
              <Heading level={3} className="text-lg font-semibold text-textPrimary mb-3">Allocation</Heading>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((entry) => <Cell key={entry.name} fill={SECTOR_COLORS[entry.name] ?? '#94A3B8'} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => [formatCurrency(value), 'Value']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d) => {
                  const pct = (d.value / totalValue) * 100
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SECTOR_COLORS[d.name] ?? '#94A3B8' }} />
                        <Text variant="caption" className="text-textSecondary text-xs">{d.name}</Text>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-surfaceMuted rounded-full h-1.5 border border-border/20">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[d.name] ?? '#94A3B8' }} />
                        </div>
                        <Text variant="numeric" className="text-xs text-textMuted w-10 text-right">{pct.toFixed(1)}%</Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Risk alert */}
            <div className="bg-warning-soft border border-warning/10 rounded-2xl p-4.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <Text variant="body" className="font-medium text-warning">Concentration Risk</Text>
                  <Text variant="caption" className="text-textSecondary mt-1 leading-snug text-xs font-medium">
                    IT sector accounts for {((sectorMap['IT'] ?? 0) / totalValue * 100).toFixed(0)}% of your portfolio. Consider diversifying.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-surface border border-border/40 shadow-xs rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-border/40 hover:bg-surfaceMuted transition-colors"
          >
            <Heading level={3} className="text-lg font-semibold text-textPrimary">Transaction History</Heading>
            <span className="text-xs text-textMuted font-medium">{showHistory ? '▲ Hide' : '▼ Show'} {MOCK_TRANSACTIONS.length} entries</span>
          </button>
          {showHistory && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="bg-surfaceMuted/50 border-b border-border/40">
                    <th className="px-4 py-2.5 text-left text-textSecondary font-medium">Date</th>
                    <th className="px-4 py-2 text-left text-textSecondary font-medium">Symbol</th>
                    <th className="px-4 py-2 text-center text-textSecondary font-medium">Type</th>
                    <th className="px-4 py-2 text-right text-textSecondary font-medium">Qty</th>
                    <th className="px-4 py-2 text-right text-textSecondary font-medium">Price</th>
                    <th className="px-4 py-2 text-right text-textSecondary font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {MOCK_TRANSACTIONS.map((tx, i) => (
                    <tr key={i} className="hover:bg-tableRowHover transition-colors">
                      <td className="px-4 py-2.5 font-mono text-textMuted">{tx.date}</td>
                      <td className="px-4 py-2.5">
                        <Link to={`/company/${tx.symbol}`} className="font-medium text-accent hover:underline font-mono">{tx.symbol}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${tx.type === 'BUY' ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-textSecondary">{tx.qty}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-textSecondary">₹{formatPrice(tx.price)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-textPrimary">{formatCurrency(tx.qty * tx.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Holding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wider">Add Holding</h3>
              <button onClick={() => setShowAddModal(false)} className="text-textMuted hover:text-textPrimary transition-colors">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Stock Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-textSecondary uppercase tracking-wider">Search Stock</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-textMuted" />
                  <Input
                    placeholder="e.g. RELIANCE, HDFC..."
                    value={addSelected ? addSelected.symbol : addSearch}
                    onChange={e => { setAddSearch(e.target.value); setAddSelected(null) }}
                    className="pl-8 h-9 text-xs border-border bg-surfaceMuted"
                  />
                </div>
                {searchResults.length > 0 && !addSelected && (
                  <div className="border border-border rounded-lg bg-surface shadow-sm max-h-36 overflow-y-auto">
                    {searchResults.map(c => (
                      <button key={c.symbol} onClick={() => { setAddSelected(c); setAddSearch(''); setAddCost(c.price.toFixed(2)) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-surfaceMuted transition-colors flex items-center justify-between border-b last:border-0 border-border/50">
                        <div>
                          <span className="font-medium text-textPrimary font-mono">{c.symbol}</span>
                          <span className="text-textMuted ml-2 text-xs">{c.name}</span>
                        </div>
                        <span className="text-xs text-accent font-medium">₹{c.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-textSecondary uppercase tracking-wider">Quantity</Label>
                  <Input type="number" min="1" placeholder="e.g. 50" value={addQty}
                    onChange={e => setAddQty(e.target.value)} className="h-9 text-xs border-border bg-surfaceMuted" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-textSecondary uppercase tracking-wider">Avg Buy Price (₹)</Label>
                  <Input type="number" min="0.01" step="0.01" placeholder="e.g. 2450.00" value={addCost}
                    onChange={e => setAddCost(e.target.value)} className="h-9 text-xs border-border bg-surfaceMuted" />
                </div>
              </div>

              {addSelected && addQty && addCost && (
                <div className="p-3 bg-accentSoft/40 border border-accent/20 rounded-lg text-xs">
                  <p className="font-medium text-textPrimary">Summary: {addQty} × {addSelected.symbol} @ ₹{addCost}</p>
                  <p className="text-textSecondary mt-0.5">Total investment: {formatCurrency(parseFloat(addQty) * parseFloat(addCost))}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}
                  className="h-8 text-xs font-medium border-border">Cancel</Button>
                <Button type="button" size="sm" onClick={handleAddHolding}
                  disabled={!addSelected || !addQty || !addCost}
                  className="h-8 text-xs font-medium bg-accent text-white hover:bg-accent/90 shadow-none gap-1.5">
                  <Plus className="size-3.5" /> Add to Portfolio
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SummaryCardProps { label: string; value: string; sub: string; color: 'green' | 'red' | 'blue' | 'amber'; delta?: string }
const cardColors = { green: 'text-positive', red: 'text-negative', blue: 'text-accent', amber: 'text-warning' }

function SummaryCard({ label, value, sub, color, delta }: SummaryCardProps) {
  return (
    <div className="bg-surface border border-border/40 shadow-xs rounded-2xl p-5 hover:shadow-sm transition-all duration-200">
      <Text variant="caption" className="text-textSecondary font-medium text-xs">{label}</Text>
      <Text variant="pageTitle" className={`text-xl font-medium font-mono mt-1.5 ${cardColors[color]}`}>{value}</Text>
      {delta && <Text variant="numeric" className="text-xs text-textSecondary mt-0.5">{delta}</Text>}
      <Text variant="caption" className="text-textMuted mt-1 text-xs">{sub}</Text>
    </div>
  )
}

export default Portfolio
