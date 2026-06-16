import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { companies } from '@/lib/data/companies'
import { formatNumber, formatPct, changeClass } from '@/lib/formatters'
import { ArrowUpRight, ArrowDownRight, Download, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import finscreenApi from '@/services/finscreenApi'

type ViewMode = 'financial-ratios' | 'quarterly'

export function PeerComparison({ symbol, sector }: { symbol: string; sector: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('financial-ratios')
  const [selectedSector, setSelectedSector] = useState(sector)
  const [peerSymbols, setPeerSymbols] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPeers() {
      try {
        setLoading(true)
        const response = await finscreenApi.fetchPeersList(symbol)
        if (response && Array.isArray(response.peers)) {
          setPeerSymbols(response.peers)
        } else {
          setPeerSymbols([])
        }
      } catch (err) {
        console.error('Failed to fetch peers:', err)
        setPeerSymbols([])
      } finally {
        setLoading(false)
      }
    }
    loadPeers()
  }, [symbol])

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

  // Map symbols to local companies data
  let peersList = peerSymbols
    .map(sym => companies.find(c => c.symbol === sym.toUpperCase()))
    .filter((c): c is typeof companies[0] => c !== undefined)

  const isFallbackUsed = peersList.length === 0
  if (isFallbackUsed) {
    // Fallback to sector filtering
    peersList = companies.filter((c) => c.sector === selectedSector && c.symbol !== symbol).slice(0, 8)
  }

  // Include current company at the top of comparison if not present
  const currentCompany = companies.find(c => c.symbol === symbol.toUpperCase())
  if (currentCompany && !peersList.some(p => p.symbol === symbol.toUpperCase())) {
    peersList.unshift(currentCompany)
  }

  const peerMedianPE = peersList.reduce((sum, p) => sum + p.pe, 0) / (peersList.length || 1)
  const currentPE = currentCompany?.pe ?? peerMedianPE
  const pePremiumPct = peerMedianPE > 0 ? ((currentPE - peerMedianPE) / peerMedianPE * 100) : 0
  const totalMarketCap = peersList.reduce((s, p) => s + p.marketCap, 0)
  const currentMcap = currentCompany?.marketCap ?? 0
  const currentMcapPct = totalMarketCap > 0 ? (currentMcap / totalMarketCap * 100) : 100

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
              Sector: <span className="font-medium text-textSecondary">{selectedSector}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Sector selector */}
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="text-xs font-medium text-textPrimary bg-surface border border-border/40 rounded-md px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              {Array.from(new Set(companies.map(c => c.sector))).map(s => (
                <option key={s}>{s}</option>
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
          <div className="overflow-x-auto">
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
                {peersList.map((peer) => {
                  const isCurrent = peer.symbol === symbol.toUpperCase()
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
                        {formatNumber(peer.marketCap, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums py-3">
                        <span className={cn(isCurrent ? 'font-medium text-textPrimary' : 'text-textSecondary')}>
                          {formatNumber(peer.pe, 2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                        {formatNumber(peer.debtToEquity ?? 0, 2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                        N/A
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-textSecondary py-3">
                        {formatNumber(peer.dividendYield, 2)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-5 py-2 border-t border-border/40 text-xs text-textMuted">
            Showing {peersList.length} peers &nbsp;·&nbsp;
            <button className="text-accent hover:underline font-medium">VIEW ALL PEERS →</button>
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
              <p className="text-xs text-textMuted font-medium mb-1">{currentCompany?.name ?? symbol} vs. Industry Median P/E</p>
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
    </div>
  )
}

export default PeerComparison
