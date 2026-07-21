import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/formatters'
import { ArrowUpRight, ArrowDownRight, Download, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import finscreenApi from '@/services/finscreenApi'
import type { Company } from '@/lib/data/companies'

type ViewMode = 'financial-ratios' | 'quarterly'

const ALL_PEERS_LIMIT = 50

interface PeerRatioRow {
  symbol: string
  name: string
  marketCap: number
  price: number
  change: number
  pe: number
  pb: number
  evEbitda: number | null
  dividendYield: number | null
  debtToEquity: number
}

// Shared row renderer for the Financial Ratios table — used by both the main
// card and the "View All Peers" dialog so the two stay visually identical.
function RatiosRow({ peer, isCurrent }: { peer: PeerRatioRow; isCurrent: boolean }) {
  return (
    <TableRow
      className={cn(
        'hover:bg-surfaceMuted transition-colors border-b border-border/40',
        isCurrent ? 'bg-accentSoft/30' : ''
      )}
    >
      <TableCell className="py-3">
        <Link to={`/company/${peer.symbol}`} className="flex items-center gap-2">
          {isCurrent && (
            <span className="size-1.5 rounded-full bg-accent shrink-0" />
          )}
          <div>
            <span className={cn('font-medium text-xs', isCurrent ? 'text-accent' : 'text-textPrimary hover:text-accent')}>
              {peer.symbol}
            </span>
            {isCurrent && (
              <span className="ml-1.5 text-xs font-medium bg-accentSoft text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase">NSE</span>
            )}
            <div className="text-xs text-textMuted">{peer.name}</div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
        {peer.marketCap > 0 ? formatNumber(peer.marketCap, 0) : 'N/A'}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums py-3">
        <span className={cn(isCurrent ? 'font-medium text-textPrimary' : 'text-textSecondary')}>
          {peer.pe > 0 ? formatNumber(peer.pe, 2) : 'N/A'}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
        {peer.pb > 0 ? formatNumber(peer.pb, 2) : 'N/A'}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
        {peer.evEbitda != null && peer.evEbitda > 0 ? formatNumber(peer.evEbitda, 2) : 'N/A'}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
        {peer.dividendYield != null ? formatNumber(peer.dividendYield, 2) : 'N/A'}
      </TableCell>
    </TableRow>
  )
}

interface PeerQuarterlyRow {
  symbol: string
  quarter: string | null
  revenue: number | null
  netProfit: number | null
  revenueYoY: number | null
  profitYoY: number | null
}

export function PeerComparison({ company }: { company: Company }) {
  const symbol = company.symbol
  const sector = company.sector

  const [viewMode, setViewMode] = useState<ViewMode>('financial-ratios')
  const [selectedSector, setSelectedSector] = useState(sector)
  const [availableSectors, setAvailableSectors] = useState<string[]>([])
  const [peers, setPeers] = useState<PeerRatioRow[]>([])
  const [isFallbackUsed, setIsFallbackUsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedOnce = useRef(false)

  const [quarterlyMap, setQuarterlyMap] = useState<Record<string, PeerQuarterlyRow>>({})
  const [quarterlyLoading, setQuarterlyLoading] = useState(false)
  const [quarterlyLoadedFor, setQuarterlyLoadedFor] = useState<string>('')

  const [allPeersOpen, setAllPeersOpen] = useState(false)
  const [allPeers, setAllPeers] = useState<PeerRatioRow[]>([])
  const [allPeersLoading, setAllPeersLoading] = useState(false)
  const [allPeersError, setAllPeersError] = useState(false)
  const [allPeersLoadedFor, setAllPeersLoadedFor] = useState<string>('')

  // Re-anchor the sector selection whenever the user navigates to a different
  // company, and force the full skeleton (not the lighter "refreshing" state)
  // so stale data from the previous company never flashes on screen.
  useEffect(() => {
    hasLoadedOnce.current = false
    setSelectedSector(sector)
  }, [symbol, sector])

  useEffect(() => {
    let cancelled = false
    async function loadPeers() {
      try {
        if (hasLoadedOnce.current) setRefreshing(true)
        else setLoading(true)
        const res = await finscreenApi.fetchPeerComparison(symbol, selectedSector)
        if (cancelled) return
        setPeers(Array.isArray(res.peers) ? res.peers : [])
        setIsFallbackUsed(!!res.isFallback)
        setAvailableSectors(Array.isArray(res.availableSectors) ? res.availableSectors : [])
      } catch (err) {
        console.error('Failed to fetch peer comparison:', err)
        if (!cancelled) {
          setPeers([])
          setIsFallbackUsed(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
          hasLoadedOnce.current = true
        }
      }
    }
    loadPeers()
    return () => { cancelled = true }
  }, [symbol, selectedSector])

  // Current company's own row, built from the already-loaded profile — real
  // data, zero extra network cost (includes the one real evEbitda figure we have).
  const currentCompany: PeerRatioRow = useMemo(() => ({
    symbol: company.symbol,
    name: company.name,
    marketCap: company.marketCap || 0,
    price: company.price || 0,
    change: company.changePct || 0,
    pe: company.pe || 0,
    pb: company.bookValue > 0 ? company.price / company.bookValue : 0,
    evEbitda: company.ratios?.evEbitda ?? null,
    dividendYield: company.dividendYield ?? null,
    debtToEquity: company.debtToEquity || 0,
  }), [company])

  const peersList = useMemo(() => {
    const rest = peers.filter(p => p.symbol.toUpperCase() !== symbol.toUpperCase())
    return [currentCompany, ...rest]
  }, [peers, currentCompany, symbol])

  const symbolsKey = useMemo(() => peersList.map(p => p.symbol).join(','), [peersList])

  // Quarterly Performance data is only fetched once the user actually opens
  // that tab (it requires a live FinEdge call per peer), and cached per peer set.
  useEffect(() => {
    if (viewMode !== 'quarterly' || !symbolsKey || quarterlyLoadedFor === symbolsKey) return
    let cancelled = false
    async function loadQuarterly() {
      try {
        setQuarterlyLoading(true)
        const symbols = symbolsKey.split(',')
        const res = await finscreenApi.fetchPeerComparisonQuarterly(symbol, symbols)
        if (cancelled) return
        const map: Record<string, PeerQuarterlyRow> = {}
        for (const row of (res.quarters || [])) {
          if (row?.symbol) map[row.symbol.toUpperCase()] = row
        }
        setQuarterlyMap(map)
        setQuarterlyLoadedFor(symbolsKey)
      } catch (err) {
        console.error('Failed to fetch peer quarterly performance:', err)
      } finally {
        if (!cancelled) setQuarterlyLoading(false)
      }
    }
    loadQuarterly()
    return () => { cancelled = true }
  }, [viewMode, symbolsKey, quarterlyLoadedFor, symbol])

  // "View All Peers" dialog: fetch a much larger peer set for the currently
  // selected sector, only while the dialog is open, cached per sector so
  // reopening it without changing sectors doesn't refire the request.
  useEffect(() => {
    if (!allPeersOpen || allPeersLoadedFor === selectedSector) return
    let cancelled = false
    async function loadAllPeers() {
      try {
        setAllPeersLoading(true)
        setAllPeersError(false)
        const res = await finscreenApi.fetchPeerComparison(symbol, selectedSector, ALL_PEERS_LIMIT)
        if (cancelled) return
        setAllPeers(Array.isArray(res.peers) ? res.peers : [])
        setAllPeersLoadedFor(selectedSector)
      } catch (err) {
        console.error('Failed to fetch full peer list:', err)
        if (!cancelled) setAllPeersError(true)
      } finally {
        if (!cancelled) setAllPeersLoading(false)
      }
    }
    loadAllPeers()
    return () => { cancelled = true }
  }, [allPeersOpen, allPeersLoadedFor, selectedSector, symbol])

  const allPeersList = useMemo(() => {
    const rest = allPeers.filter(p => p.symbol.toUpperCase() !== symbol.toUpperCase())
    return [currentCompany, ...rest]
  }, [allPeers, currentCompany, symbol])

  if (loading) {
    return (
      <div className="w-full h-64 bg-surface border border-border rounded-2xl animate-pulse p-6 flex flex-col justify-between select-none">
        <div className="space-y-4">
          <div className="h-4 bg-border/40 shimmer-skeleton rounded w-1/4"></div>
          <div className="h-3 bg-border/40 shimmer-skeleton rounded w-3/4"></div>
          <div className="h-3 bg-border/40 shimmer-skeleton rounded w-1/2"></div>
        </div>
        <div className="space-y-2 pt-4">
          <div className="h-10 bg-border/40 shimmer-skeleton rounded w-full"></div>
          <div className="h-10 bg-border/40 shimmer-skeleton rounded w-full"></div>
        </div>
      </div>
    )
  }

  // The company's own real sector always stays pinned as the first option so
  // it's a one-click hop back after browsing other sectors in the dropdown.
  const sectorOptions = [
    sector,
    ...Array.from(new Set(availableSectors.filter(Boolean))).filter(s => s !== sector),
  ]

  const peerMedianPE = peersList.reduce((sum, p) => sum + p.pe, 0) / (peersList.length || 1)
  const currentPE = currentCompany.pe || peerMedianPE
  const pePremiumPct = peerMedianPE > 0 ? ((currentPE - peerMedianPE) / peerMedianPE * 100) : 0
  const totalMarketCap = peersList.reduce((s, p) => s + p.marketCap, 0)
  const currentMcapPct = totalMarketCap > 0 ? (currentCompany.marketCap / totalMarketCap * 100) : 100

  return (
    <div className="space-y-4 select-none">
      <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-textPrimary">Peer Comparison</h3>
              {isFallbackUsed && (
                <span className="text-xs font-medium bg-warning-soft text-warning border border-warning/20 px-1.5 py-0.5 rounded uppercase">
                  Sector Fallback
                </span>
              )}
            </div>
            <p className="text-xs text-textMuted mt-0.5">
              Sector: <span className="font-medium text-textSecondary">{sector}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Sector selector */}
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="text-xs font-medium text-textPrimary bg-surface border border-border/40 rounded-md px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              {sectorOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-surfaceMuted border border-border rounded-lg p-0.5">
              {([['financial-ratios', 'Financial Ratios'], ['quarterly', 'Quarterly Performance']] as [ViewMode, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                    viewMode === id ? 'bg-surface text-accent shadow-sm' : 'text-textSecondary hover:text-textPrimary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <CardContent className="p-0">
          <div className={cn('overflow-x-auto transition-opacity', refreshing ? 'opacity-50 pointer-events-none' : '')}>
            {viewMode === 'financial-ratios' ? (
              <Table>
                <TableHeader className="bg-surfaceMuted">
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Company</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Market Cap (Cr)</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">P/E</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">P/B</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">EV/EBITDA</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Div Yield (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peersList.map((peer) => (
                    <RatiosRow key={peer.symbol} peer={peer} isCurrent={peer.symbol.toUpperCase() === symbol.toUpperCase()} />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="bg-surfaceMuted">
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Company</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Latest Quarter</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Revenue (Cr)</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Revenue YoY</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Net Profit (Cr)</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Profit YoY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterlyLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-xs text-textMuted">
                        Loading quarterly performance…
                      </TableCell>
                    </TableRow>
                  ) : (
                    peersList.map((peer) => {
                      const isCurrent = peer.symbol.toUpperCase() === symbol.toUpperCase()
                      const q = quarterlyMap[peer.symbol.toUpperCase()]
                      return (
                        <TableRow
                          key={peer.symbol}
                          className={cn(
                            'hover:bg-surfaceMuted transition-colors border-b border-border/40',
                            isCurrent ? 'bg-accentSoft/30' : ''
                          )}
                        >
                          <TableCell className="py-3">
                            <Link to={`/company/${peer.symbol}`} className="flex items-center gap-2">
                              {isCurrent && (
                                <span className="size-1.5 rounded-full bg-accent shrink-0" />
                              )}
                              <div>
                                <span className={cn('font-medium text-xs', isCurrent ? 'text-accent' : 'text-textPrimary hover:text-accent')}>
                                  {peer.symbol}
                                </span>
                                {isCurrent && (
                                  <span className="ml-1.5 text-xs font-medium bg-accentSoft text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase">NSE</span>
                                )}
                                <div className="text-xs text-textMuted">{peer.name}</div>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                            {q?.quarter || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                            {q?.revenue != null ? formatNumber(q.revenue, 0) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums py-3">
                            {q?.revenueYoY != null ? (
                              <span className={q.revenueYoY >= 0 ? 'text-positive' : 'text-negative'}>
                                {q.revenueYoY >= 0 ? '+' : ''}{formatNumber(q.revenueYoY, 1)}%
                              </span>
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                            {q?.netProfit != null ? formatNumber(q.netProfit, 0) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums py-3">
                            {q?.profitYoY != null ? (
                              <span className={q.profitYoY >= 0 ? 'text-positive' : 'text-negative'}>
                                {q.profitYoY >= 0 ? '+' : ''}{formatNumber(q.profitYoY, 1)}%
                              </span>
                            ) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="px-5 py-2 border-t border-border/40 text-xs text-textMuted">
            Showing {peersList.length} peers &nbsp;·&nbsp;
            <button
              type="button"
              onClick={() => setAllPeersOpen(true)}
              className="text-accent hover:underline font-medium"
            >
              VIEW ALL PEERS →
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Sector Performance Analytics + Pro Insight */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {/* Sector Performance Analytics */}
        <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-1.5 mb-4">
            <Info className="size-3.5 text-accent" />
            <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">Sector Performance Analytics</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* P/E Comparison */}
            <div>
              <p className="text-xs text-textMuted font-medium mb-1">{currentCompany.name} vs. Industry Median P/E</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-medium font-mono text-textPrimary tabular-nums">{formatNumber(currentPE, 2)}</span>
                <span className={cn(
                  'flex items-center gap-0.5 text-sm font-medium font-mono',
                  pePremiumPct >= 0 ? 'text-positive' : 'text-negative'
                )}>
                  {pePremiumPct >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {pePremiumPct >= 0 ? '+' : ''}{pePremiumPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-textMuted font-mono mt-1">PEER MEDIAN: {formatNumber(peerMedianPE, 2)}</p>
            </div>

            {/* Market Cap Share */}
            <div>
              <p className="text-xs text-textMuted font-medium mb-2">Market Cap Share ({selectedSector})</p>
              <div className="h-6 w-full rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-accent flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${Math.min(currentMcapPct, 100)}%` }}
                >
                  {currentMcapPct > 15 ? `${symbol} (${currentMcapPct.toFixed(0)}%)` : ''}
                </div>
                <div
                  className="h-full bg-surfaceMuted flex items-center justify-center text-xs font-medium text-textMuted"
                  style={{ width: `${100 - Math.min(currentMcapPct, 100)}%` }}
                >
                  {(100 - currentMcapPct) > 15 ? `OTHERS (${(100 - currentMcapPct).toFixed(0)}%)` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pro Insight Card */}
        <div className="bg-accent rounded-2xl p-5 text-white shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-200 mb-2">PRO INSIGHT</p>
            <p className="text-sm font-medium leading-relaxed">
              {symbol} trading at a {Math.abs(pePremiumPct).toFixed(0)}% {pePremiumPct > 0 ? 'premium' : 'discount'} to industry peer P/E median.
            </p>
          </div>
          <button className="mt-4 w-full border border-white/30 text-white text-xs font-medium uppercase tracking-wider rounded-lg py-2 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5">
            <Download className="size-3" /> DOWNLOAD FULL REPORT
          </button>
        </div>
      </div>

      {/* View All Peers dialog — blurred/dimmed backdrop, scrollable body, closes via
          the corner ×, the Escape key, an outside click, or the Close button below. */}
      <Dialog open={allPeersOpen} onOpenChange={setAllPeersOpen}>
        <DialogContent
          className="sm:max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden"
          overlayClassName="backdrop-blur-sm"
        >
          <DialogHeader className="p-5 pb-3 border-b border-border/50">
            <DialogTitle className="text-sm font-medium text-textPrimary">All Peers</DialogTitle>
            <DialogDescription className="text-xs text-textMuted">
              Every company FinScreen has real data for in <span className="font-medium text-textSecondary">{selectedSector}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="bg-surfaceMuted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Company</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Market Cap (Cr)</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">P/E</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">P/B</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">EV/EBITDA</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Div Yield (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPeersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-textMuted">
                      Loading all peers…
                    </TableCell>
                  </TableRow>
                ) : allPeersError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-negative">
                      Failed to load the full peer list. Please try again.
                    </TableCell>
                  </TableRow>
                ) : (
                  allPeersList.map((peer) => (
                    <RatiosRow key={peer.symbol} peer={peer} isCurrent={peer.symbol.toUpperCase() === symbol.toUpperCase()} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="p-4 border-t border-border/50 flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-textMuted">
              {!allPeersLoading && !allPeersError ? `${allPeersList.length} companies` : ' '}
            </span>
            <DialogClose asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-xs font-medium h-8"
              >
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PeerComparison
