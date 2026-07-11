import { useState, useMemo, useEffect } from 'react'
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
import { fetchStockSymbols } from '@/store/slices/searchSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  createWatchlist,
  deleteWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  setActiveWatchlist,
} from '@/store/slices/watchlistSlice'
import finscreenApi from '@/services/finscreenApi'

interface UpcomingEvent {
  id: string
  title: string
  date: string
  type: 'results' | 'agm' | 'dividend' | 'bonus'
}

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
  const dispatch = useAppDispatch()
  const { watchlists, activeWatchlistId } = useAppSelector((state) => state.watchlist)
  const stockSymbols = useAppSelector((state) => (state as any).search?.symbols ?? [])
  
  const [isEditing, setIsEditing] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [stockSearchQuery, setStockSearchQuery] = useState('')

  const selected = watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0]
  
  // Live quotes state for watchlist symbols
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  const [quotesLoading, setQuotesLoading] = useState(false)

  // Live upcoming events from results-calendar API
  const [liveEvents, setLiveEvents] = useState<UpcomingEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Get all unique symbols across all watchlists to fetch quotes
  const allSymbols = useMemo(() => {
    const symbolsSet = new Set<string>()
    watchlists.forEach(wl => {
      wl.items.forEach(item => {
        symbolsSet.add(item.symbol)
      })
    })
    return Array.from(symbolsSet)
  }, [watchlists])

  useEffect(() => {
    if (allSymbols.length === 0) return
    async function loadQuotes() {
      try {
        setQuotesLoading(true)
        const response = await finscreenApi.fetchMultipleQuotes(allSymbols)
        if (response) {
          setQuotes(response)
        }
      } catch (err) {
        console.error('Failed to load quotes for watchlists:', err)
      } finally {
        setQuotesLoading(false)
      }
    }
    loadQuotes()
  }, [allSymbols])

  // Fetch live upcoming events from results-calendar filtered to watchlist symbols
  useEffect(() => {
    async function loadEvents() {
      setEventsLoading(true)
      try {
        const res = await finscreenApi.fetchResultsCalendar()
        const raw: any[] = Array.isArray(res) ? res : []
        const symbolSet = new Set(allSymbols.map(s => s.toUpperCase()))
        const mapped: UpcomingEvent[] = raw
          .filter(e => !symbolSet.size || symbolSet.has((e.symbol || '').toUpperCase()))
          .slice(0, 6)
          .map((e, i) => {
            const dt = e.result_date || e.date || ''
            const d = dt ? new Date(dt) : null
            const dateStr = d && !isNaN(d.getTime())
              ? d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
              : dt.slice(0, 10)
            const sym = (e.symbol || '').toUpperCase()
            const name = e.company_name || e.name || sym
            return {
              id: `live-${i}`,
              title: `${sym} Results`,
              date: dateStr,
              type: 'results' as const,
            }
          })
        setLiveEvents(mapped)
      } catch (err) {
        console.error('Failed to load results calendar:', err)
        setLiveEvents([])
      } finally {
        setEventsLoading(false)
      }
    }
    loadEvents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Map Redux watchlist items to local model with live quotes
  const selectedStocks = useMemo(() => {
    if (!selected) return []
    return selected.items.map((item) => {
      const q = quotes[item.symbol] || {}
      const changeVal = typeof q.pct_change === 'number' ? q.pct_change
        : typeof q.change === 'number' ? q.change
        : parseFloat(String(q.pct_change || q.change || '0').replace('%', ''))
      const price = q.current_price || q.close_price || 0
      return {
        id: item.symbol, // use symbol as target stock ID
        symbol: item.symbol,
        name: item.name,
        cmp: price,
        dayChange: changeVal,
        targetPrice: item.targetPrice || 0,
        alertEnabled: item.alertEnabled,
      }
    })
  }, [selected, quotes])

  // Create new watchlist
  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWatchlistName.trim()) return
    dispatch(createWatchlist({ name: newWatchlistName.trim() }))
    setNewWatchlistName('')
    setIsCreateModalOpen(false)
  }

  // Delete watchlist
  const handleDeleteWatchlist = (id: string) => {
    if (watchlists.length <= 1) {
      alert("You must keep at least one watchlist.")
      return
    }
    dispatch(deleteWatchlist(id))
  }

  // Load stock symbols on mount (cached in Redux after first call)
  useEffect(() => {
    dispatch(fetchStockSymbols() as any)
  }, [dispatch])

  // Add stock to current watchlist
  const addStockToWatchlist = (comp: any) => {
    dispatch(addToWatchlist({
      item: {
        symbol: comp.symbol,
        name: comp.name,
        sector: comp.sector,
      }
    }))
    setStockSearchQuery('')
  }

  // Delete stock from current watchlist
  const removeStockFromWatchlist = (stockId: string) => {
    dispatch(removeFromWatchlist({ symbol: stockId }))
  }

  // Search filter — uses full symbol list from Redux (5000+ companies)
  const filteredSearchStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return []
    const query = stockSearchQuery.toLowerCase()
    return stockSymbols.filter((c: any) =>
      (c.symbol || '').toLowerCase().includes(query) ||
      (c.name || c.company_name || '').toLowerCase().includes(query)
    ).slice(0, 8)
  }, [stockSearchQuery, stockSymbols])

  // Update target price
  const updateTarget = (stockId: string, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    dispatch(setTargetPrice({ symbol: stockId, price: num }))
  }

  // Toggle alert switch
  const handleToggleAlert = (stockId: string) => {
    dispatch(toggleAlert({ symbol: stockId }))
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <div className="text-xs text-textSecondary/70 mb-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-accent font-medium">Watchlists</span>
        </div>
        <Heading level={1} variant="pageTitle" className="text-textPrimary">
          Watchlists
        </Heading>
        <p className="text-body text-textSecondary mt-1">
          Monitor your favorite assets and manage real-time alerts ·{' '}
          <span className="font-medium text-accent">
            {allSymbols.length} {allSymbols.length === 1 ? 'Asset' : 'Assets'} Tracked
          </span>
        </p>
      </div>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {/* Left Sidebar */}
        <div className="w-full md:w-64 bg-surface border-b md:border-b-0 md:border-r border-border/40 flex-shrink-0 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Target className="size-3.5 text-textMuted" />
            <span className="font-medium text-textMuted uppercase tracking-wider text-xs">
              My Watchlists
            </span>
          </div>
          {watchlists.map((wl) => (
            <div key={wl.id} className="flex items-center justify-between group rounded-lg hover:bg-surfaceMuted transition-colors pr-2">
              <button
                onClick={() => {
                  dispatch(setActiveWatchlist(wl.id))
                  setIsEditing(false)
                }}
                className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                  selected?.id === wl.id
                    ? 'text-accent font-medium'
                    : 'text-textSecondary'
                }`}
              >
                <span className="truncate">{wl.name}</span>
                <Badge
                  variant="secondary"
                  className={`text-xs min-w-[20px] px-1 text-center shadow-none ${
                    selected?.id === wl.id ? 'bg-accent/15 text-accent font-medium' : 'bg-surfaceMuted/50 text-textSecondary border border-border/30'
                  }`}
                >
                  {wl.items.length}
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
            className="flex items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-accentSoft rounded-lg transition-colors font-medium uppercase tracking-wider"
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
              <Heading level={2} className="text-lg font-semibold text-textPrimary">{selected?.name}</Heading>
              <Text variant="bodyMuted" className="text-sm">{selected?.items.length} stocks tracked</Text>
            </div>
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? 'destructive' : 'outline'}
              size="sm"
              className="gap-1.5 h-8 text-xs border-border font-medium uppercase"
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
                    {filteredSearchStocks.map((comp: any) => (
                      <button
                        key={comp.symbol}
                        onClick={() => addStockToWatchlist(comp)}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-surfaceMuted transition-colors flex items-center justify-between border-b last:border-0 border-border/50"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-textPrimary font-mono">{comp.symbol}</span>
                          <span className="text-xs text-textMuted truncate max-w-[240px]">{comp.name}</span>
                        </div>
                        <span className="text-xs font-medium text-accent uppercase tracking-wider flex items-center gap-1">
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
          <div className="bg-surface border border-border/40 shadow-xs rounded-2xl overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-surfaceMuted/50 border-b border-border/40">
                  <th className="px-4 py-2.5 text-left text-xs text-textSecondary font-medium">Company</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-medium">CMP (₹)</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-medium">Day Change</th>
                  <th className="px-4 py-2.5 text-right text-xs text-textSecondary font-medium">Target Price (₹)</th>
                  <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-medium">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-medium">Alerts</th>
                  {isEditing && <th className="px-4 py-2.5 text-center text-xs text-textSecondary font-medium">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {quotesLoading && selectedStocks.length === 0 ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-border/40 shimmer-skeleton rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 bg-border/40 shimmer-skeleton rounded ml-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 bg-border/40 shimmer-skeleton rounded ml-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 bg-border/40 shimmer-skeleton rounded ml-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 bg-border/40 shimmer-skeleton rounded mx-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-10 bg-border/40 shimmer-skeleton rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : (
                  selectedStocks.map((stock) => {
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
                            <Text variant="body" className="font-medium hover:text-accent transition-colors text-xs text-textPrimary">
                              {stock.name}
                            </Text>
                            <Text variant="caption" className="font-mono text-textMuted mt-0.5 text-xs">{stock.symbol}</Text>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Text variant="numeric" className="text-xs text-textPrimary font-medium font-mono tabular-nums">
                            {stock.cmp > 0 ? formatPrice(stock.cmp) : '0.00'}
                          </Text>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono tabular-nums text-xs font-medium ${stock.dayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
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
                              value={stock.targetPrice || ''}
                              onChange={(e) => updateTarget(stock.id, e.target.value)}
                              className="h-7 w-24 text-xs font-mono text-right border-border bg-surfaceMuted"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium shadow-none ${
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
                            onCheckedChange={() => handleToggleAlert(stock.id)}
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
                  })
                )}
                {selectedStocks.length === 0 && !quotesLoading && (
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
              <Heading level={3} className="text-lg font-semibold text-textPrimary">
                Upcoming Results
              </Heading>
              {eventsLoading && <span className="text-xs text-textMuted animate-pulse ml-1">Loading…</span>}
            </div>
            {liveEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {liveEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-surface border border-border/40 shadow-xs rounded-xl p-5 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <Badge variant="outline" className={`text-xs font-medium capitalize shadow-none border-none ${EVENT_COLORS[event.type]}`}>
                        {event.type}
                      </Badge>
                      <Text variant="caption" className="text-textSecondary font-medium">{event.date}</Text>
                    </div>
                    <Text variant="body" className="font-medium text-textPrimary">{event.title}</Text>
                  </div>
                ))}
              </div>
            ) : !eventsLoading ? (
              <p className="text-xs text-textMuted border border-dashed border-border/40 rounded-xl px-4 py-6 text-center">
                No upcoming results events found for your watchlist symbols.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-surface border border-border/30 rounded-xl animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Watchlist Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border/40 w-full max-w-sm rounded-2xl p-6 shadow-lg animate-in zoom-in-95 duration-150">
            <h3 className="text-xs font-medium text-textPrimary uppercase tracking-wider mb-3">Create New Watchlist</h3>
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <Label htmlFor="wl-name" className="text-xs font-medium text-textSecondary uppercase tracking-wider">Watchlist Name</Label>
                <Input
                  id="wl-name"
                  type="text"
                  placeholder="e.g. Core Portfolio"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  className="mt-1.5 h-9 text-xs border-border bg-surfaceMuted font-medium"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-8 text-xs border-border text-textSecondary font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-medium bg-accent hover:bg-accent/90 text-white shadow-none"
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
