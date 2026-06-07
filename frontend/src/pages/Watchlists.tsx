import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight, Plus, Edit2, TrendingUp, TrendingDown,
  Calendar, Target, Trash2, Search, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { Label } from '@/components/ui/label'
import { companies } from '@/lib/data/companies'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WatchlistStock {
  id: string
  symbol: string
  name: string
  cmp: number
  dayChange: number
  targetPrice: number
  alertEnabled: boolean
}

interface Watchlist {
  id: string
  name: string
  stocks: WatchlistStock[]
}

interface UpcomingEvent {
  id: string
  title: string
  date: string
  type: 'results' | 'agm' | 'dividend' | 'bonus'
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_WATCHLISTS: Watchlist[] = [
  {
    id: 'wl1',
    name: 'My Watchlist',
    stocks: [
      { id: 's1', symbol: 'RELIANCE', name: 'Reliance Industries', cmp: 2847.35, dayChange: 1.24, targetPrice: 3200, alertEnabled: true },
      { id: 's2', symbol: 'INFY', name: 'Infosys Ltd', cmp: 1521.80, dayChange: -0.78, targetPrice: 1400, alertEnabled: false },
      { id: 's3', symbol: 'HDFCBANK', name: 'HDFC Bank', cmp: 1687.45, dayChange: 0.52, targetPrice: 1800, alertEnabled: true },
      { id: 's4', symbol: 'TCS', name: 'TCS Ltd', cmp: 3956.20, dayChange: -1.12, targetPrice: 4200, alertEnabled: true },
      { id: 's5', symbol: 'ITC', name: 'ITC Ltd', cmp: 453.80, dayChange: 0.34, targetPrice: 430, alertEnabled: false },
      { id: 's6', symbol: 'NESTLEIND', name: 'Nestle India', cmp: 2298.75, dayChange: 0.18, targetPrice: 2500, alertEnabled: true },
      { id: 's7', symbol: 'MARUTI', name: 'Maruti Suzuki', cmp: 13240.00, dayChange: 2.12, targetPrice: 12000, alertEnabled: false },
      { id: 's8', symbol: 'TITAN', name: 'Titan Company', cmp: 3398.00, dayChange: -0.23, targetPrice: 3600, alertEnabled: true },
    ],
  },
  {
    id: 'wl2',
    name: 'Tech Stocks',
    stocks: [
      { id: 't1', symbol: 'INFY', name: 'Infosys Ltd', cmp: 1521.80, dayChange: -0.78, targetPrice: 1650, alertEnabled: true },
      { id: 't2', symbol: 'TCS', name: 'TCS Ltd', cmp: 3956.20, dayChange: -1.12, targetPrice: 4100, alertEnabled: false },
      { id: 't3', symbol: 'WIPRO', name: 'Wipro Ltd', cmp: 459.35, dayChange: -1.44, targetPrice: 500, alertEnabled: true },
      { id: 't4', symbol: 'HCLTECH', name: 'HCL Technologies', cmp: 1578.60, dayChange: 0.89, targetPrice: 1700, alertEnabled: true },
    ],
  },
  {
    id: 'wl3',
    name: 'High Dividend',
    stocks: [
      { id: 'h1', symbol: 'ITC', name: 'ITC Ltd', cmp: 453.80, dayChange: 0.34, targetPrice: 480, alertEnabled: false },
      { id: 'h2', symbol: 'HCLTECH', name: 'HCL Technologies', cmp: 1578.60, dayChange: 0.89, targetPrice: 1700, alertEnabled: true },
      { id: 'h3', symbol: 'HINDUNILVR', name: 'Hindustan Unilever', cmp: 2412.30, dayChange: -0.52, targetPrice: 2600, alertEnabled: false },
      { id: 'h4', symbol: 'NESTLEIND', name: 'Nestle India', cmp: 2298.75, dayChange: 0.18, targetPrice: 2400, alertEnabled: true },
    ],
  },
]

const UPCOMING_EVENTS: UpcomingEvent[] = [
  { id: 'e1', title: 'INFY Q4 Results', date: 'May 28', type: 'results' },
  { id: 'e2', title: 'TCS AGM', date: 'May 30', type: 'agm' },
  { id: 'e3', title: 'ITC Dividend Ex-Date', date: 'Jun 2', type: 'dividend' },
  { id: 'e4', title: 'RELIANCE Q4 Results', date: 'Jun 4', type: 'results' },
]

const EVENT_COLORS = {
  results: 'bg-info/10 text-info border border-info/20',
  agm: 'bg-purple-100 text-purple-700 border border-purple-200',
  dividend: 'bg-positive-soft text-positive border border-positive/20',
  bonus: 'bg-warning-soft text-warning border border-warning/20',
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Watchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>(INITIAL_WATCHLISTS)
  const [selectedId, setSelectedId] = useState('wl1')
  const [isEditing, setIsEditing] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [stockSearchQuery, setStockSearchQuery] = useState('')

  const selected = watchlists.find((w) => w.id === selectedId) || watchlists[0]
  const selectedStocks = selected?.stocks ?? []

  // Create new watchlist
  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWatchlistName.trim()) return
    const newId = `wl-${Date.now()}`
    const newWl: Watchlist = {
      id: newId,
      name: newWatchlistName.trim(),
      stocks: []
    }
    setWatchlists(prev => [...prev, newWl])
    setSelectedId(newId)
    setNewWatchlistName('')
    setIsCreateModalOpen(false)
  }

  // Delete watchlist
  const handleDeleteWatchlist = (id: string) => {
    if (watchlists.length <= 1) {
      alert("You must keep at least one watchlist.")
      return
    }
    const index = watchlists.findIndex(w => w.id === id)
    const nextWatchlists = watchlists.filter(w => w.id !== id)
    setWatchlists(nextWatchlists)
    if (selectedId === id) {
      const nextSelected = nextWatchlists[Math.max(0, index - 1)]?.id || nextWatchlists[0]?.id
      setSelectedId(nextSelected)
    }
  }

  // Add stock to current watchlist
  const addStockToWatchlist = (comp: typeof companies[0]) => {
    setWatchlists(prev => prev.map(wl => {
      if (wl.id !== selectedId) return wl
      if (wl.stocks.some(s => s.symbol === comp.symbol)) return wl
      const newStock: WatchlistStock = {
        id: `s-${Date.now()}`,
        symbol: comp.symbol,
        name: comp.name,
        cmp: comp.price,
        dayChange: comp.changePct,
        targetPrice: Math.round(comp.price * 1.1), // default target +10%
        alertEnabled: false
      }
      return {
        ...wl,
        stocks: [...wl.stocks, newStock]
      }
    }))
    setStockSearchQuery('')
  }

  // Delete stock from current watchlist
  const removeStockFromWatchlist = (stockId: string) => {
    setWatchlists(prev => prev.map(wl => {
      if (wl.id !== selectedId) return wl
      return {
        ...wl,
        stocks: wl.stocks.filter(s => s.id !== stockId)
      }
    }))
  }

  // Search filter
  const filteredSearchStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return []
    const query = stockSearchQuery.toLowerCase()
    return companies.filter(c =>
      c.symbol.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    ).slice(0, 5)
  }, [stockSearchQuery])

  // Update target price
  const updateTarget = (stockId: string, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    setWatchlists(prev => prev.map(wl => {
      if (wl.id !== selectedId) return wl
      return {
        ...wl,
        stocks: wl.stocks.map(s => s.id === stockId ? { ...s, targetPrice: num } : s)
      }
    }))
  }

  // Toggle alert switch
  const toggleAlert = (stockId: string) => {
    setWatchlists(prev => prev.map(wl => {
      if (wl.id !== selectedId) return wl
      return {
        ...wl,
        stocks: wl.stocks.map(s => s.id === stockId ? { ...s, alertEnabled: !s.alertEnabled } : s)
      }
    }))
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1 font-semibold">
          <Link to="/" className="hover:text-accent transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Text as="span" variant="bodyMuted" className="text-xs">Watchlists</Text>
        </nav>
        <Heading level={1} variant="pageTitle">Watchlists</Heading>
      </div>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {/* Left Sidebar */}
        <div className="w-full md:w-64 bg-surface border-b md:border-b-0 md:border-r border-border flex-shrink-0 p-4 flex flex-col gap-1">
          <Text variant="label" className="mb-2 font-bold text-textMuted uppercase tracking-wider text-[10px]">My Watchlists</Text>
          {watchlists.map((wl) => (
            <div key={wl.id} className="flex items-center justify-between group rounded-lg hover:bg-surfaceMuted transition-colors pr-2">
              <button
                onClick={() => { setSelectedId(wl.id); setIsEditing(false) }}
                className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                  selectedId === wl.id
                    ? 'text-accent font-bold'
                    : 'text-textSecondary'
                }`}
              >
                <span className="truncate">{wl.name}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] min-w-[20px] px-1 text-center shadow-none ${
                    selectedId === wl.id ? 'bg-accent/15 text-accent font-bold' : 'bg-surfaceMuted text-textSecondary border border-border/30'
                  }`}
                >
                  {wl.stocks.length}
                </Badge>
              </button>
              {watchlists.length > 1 && (
                <button
                  onClick={() => handleDeleteWatchlist(wl.id)}
                  className="opacity-0 group-hover:opacity-100 size-6 text-textMuted hover:text-negative hover:bg-red-50 rounded flex items-center justify-center transition-all"
                  title="Delete Watchlist"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}

          <Separator className="my-3 border-border" />

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-accentSoft rounded-lg transition-colors font-bold uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Watchlist
          </button>
        </div>

        {/* Main Area */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Watchlist Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <Heading level={2} variant="sectionTitle" className="text-base font-bold text-textPrimary">{selected.name}</Heading>
              <Text variant="bodyMuted" className="text-xs">{selectedStocks.length} stocks tracked</Text>
            </div>
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? 'destructive' : 'outline'}
              size="sm"
              className="gap-1.5 h-8 text-xs border-border font-bold uppercase"
            >
              {isEditing ? (
                <>
                  <X className="w-3.5 h-3.5" /> Close Editor
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" /> Edit List
                </>
              )}
            </Button>
          </div>

          {/* Edit List Controls */}
          {isEditing && (
            <div className="mb-4 p-4 bg-surfaceMuted/20 border border-border rounded-xl animate-in slide-in-from-top-2 duration-200">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-textMuted" />
                <Input
                  type="text"
                  placeholder="Type company name or ticker to add..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="pl-9 pr-3 h-9 text-xs border-border focus:border-accent bg-surface"
                />
                {/* Search suggestions */}
                {stockSearchQuery && filteredSearchStocks.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filteredSearchStocks.map((comp) => (
                      <button
                        key={comp.symbol}
                        onClick={() => addStockToWatchlist(comp)}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-surfaceMuted transition-colors flex items-center justify-between border-b last:border-0 border-border/50"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-textPrimary font-mono">{comp.symbol}</span>
                          <span className="text-[10px] text-textMuted truncate max-w-[240px]">{comp.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {stockSearchQuery && filteredSearchStocks.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg p-3 text-center text-xs text-textMuted">
                    No matching stocks found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stocks Table */}
          <div className="bg-surface border border-border rounded-xl overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-surfaceMuted border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs text-textSecondary font-semibold">Company</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-semibold">CMP (₹)</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-semibold">Day Change</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-semibold">Target Price (₹)</th>
                  <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-semibold">Alerts</th>
                  {isEditing && <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-semibold">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {selectedStocks.map((stock) => {
                  const aboveTarget = stock.cmp >= stock.targetPrice
                  return (
                    <tr
                      key={stock.id}
                      className={`transition-colors duration-150 ${
                        aboveTarget ? 'hover:bg-positive-soft/10' : 'hover:bg-negative-soft/10'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link to={`/company/${stock.symbol}`} className="block">
                          <Text variant="body" className="font-semibold hover:text-accent transition-colors text-xs text-textPrimary">
                            {stock.name}
                          </Text>
                          <Text variant="caption" className="font-mono text-textMuted mt-0.5 text-[10px]">{stock.symbol}</Text>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Text variant="numeric" className="text-xs text-textPrimary font-semibold font-mono tabular-nums">{formatPrice(stock.cmp)}</Text>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums text-xs font-semibold ${stock.dayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {stock.dayChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {stock.dayChange >= 0 ? '+' : ''}{stock.dayChange.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Target className="w-3.5 h-3.5 text-textMuted" />
                          <Input
                            type="number"
                            value={stock.targetPrice}
                            onChange={(e) => updateTarget(stock.id, e.target.value)}
                            className="h-7 w-24 text-xs font-mono text-right border-border bg-surfaceMuted"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold shadow-none ${
                            aboveTarget
                              ? 'bg-positive-soft text-positive border border-green-200'
                              : 'bg-negative-soft text-negative border border-red-200'
                          }`}
                        >
                          {aboveTarget ? '▲ Above Target' : '▼ Below Target'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={stock.alertEnabled}
                          onCheckedChange={() => toggleAlert(stock.id)}
                          className="data-[state=checked]:bg-accent size-sm"
                        />
                      </td>
                      {isEditing && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeStockFromWatchlist(stock.id)}
                            className="text-textMuted hover:text-negative p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            title="Remove from Watchlist"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {selectedStocks.length === 0 && (
                  <tr>
                    <td colSpan={isEditing ? 7 : 6} className="py-12 text-center text-xs text-textMuted">
                      No stocks in this watchlist. Click Edit List to add companies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-textSecondary" />
              <Heading level={3} variant="sectionTitle" className="text-sm font-semibold text-textPrimary">
                Upcoming Events This Week
              </Heading>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {UPCOMING_EVENTS.map((event) => (
                <div
                  key={event.id}
                  className="bg-surface border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={`text-xs font-semibold capitalize shadow-none ${EVENT_COLORS[event.type]}`}>
                      {event.type}
                    </Badge>
                    <Text variant="caption" className="text-textSecondary font-medium">{event.date}</Text>
                  </div>
                  <Text variant="body" className="font-semibold text-textPrimary">{event.title}</Text>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Watchlist Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-xl p-5 shadow-xl animate-in zoom-in-95 duration-150">
            <h3 className="text-xs font-bold text-textPrimary uppercase tracking-wider mb-3">Create New Watchlist</h3>
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <Label htmlFor="wl-name" className="text-xs font-bold text-textSecondary uppercase tracking-wider">Watchlist Name</Label>
                <Input
                  id="wl-name"
                  type="text"
                  placeholder="e.g. Core Portfolio"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  className="mt-1.5 h-9 text-xs border-border bg-surfaceMuted font-semibold"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-8 text-xs border-border text-textSecondary font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-none"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Watchlists
