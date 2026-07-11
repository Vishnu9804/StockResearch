import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ChevronRight, ArrowUp, ArrowDown, Inbox, FileText } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { fetchInsiderTradesStart } from '@/store/slices/marketPulseSlice'
import type { RootState, AppDispatch } from '@/store'

const TRADE_FILTERS = ['All', 'Buy', 'Sell'] as const
type TradeFilter = typeof TRADE_FILTERS[number]
type SortField = 'company' | 'category' | 'date'

export default function InsiderTrades() {
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tradeType = (searchParams.get('tradeType') ?? 'All') as TradeFilter
  const sortBy    = (searchParams.get('sortBy')    ?? 'date') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const { items: trades, total, page, limit, status, error } =
    useSelector((s: RootState) => s.marketPulse.insiderTrades)
  const loading = status === 'loading'

  useEffect(() => {
    dispatch(fetchInsiderTradesStart({ page, limit }))
  }, [dispatch, page, limit])

  const handleRetry = () => dispatch(fetchInsiderTradesStart({ page, limit }))

  const handleSort = (field: SortField) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === field) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', field)
      newParams.set('sortOrder', 'desc')
    }
    setSearchParams(newParams)
  }

  const handleTradeFilterChange = (f: TradeFilter) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tradeType', f)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    // Filter by trade type derived from description
    const filtered = trades.filter((d: any) =>
      tradeType === 'All' ? true : (d.tradeType === tradeType)
    )
    const base = filtered.length > 0 ? filtered : (tradeType === 'All' ? trades : [])

    return [...base].sort((a: any, b: any) => {
      let valA: any = a[sortBy] ?? ''
      let valB: any = b[sortBy] ?? ''
      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = String(valB).toLowerCase()
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [trades, tradeType, sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 ml-1 text-accent inline shrink-0" />
    ) : (
      <ArrowDown className="size-3 ml-1 text-accent inline shrink-0" />
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Insider Announcements</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Insider Announcements
        </Heading>
        <p className="text-sm text-textSecondary mb-4">SEBI PIT regulation filings from NSE corporate announcements</p>

        {/* Trade filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TRADE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => handleTradeFilterChange(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                tradeType === f
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-surface border-border hover:bg-surfaceMuted/65 text-textSecondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5"><TableRowsSkeleton rows={6} cols={5} /></div>
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Inbox className="size-6 text-textMuted" /></EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No insider announcements found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try changing the filter or page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[800px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead
                        onClick={() => handleSort('date')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">Date {renderSortIcon('date')}</div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">Company {renderSortIcon('company')}</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Trade Signal</TableHead>
                      <TableHead
                        onClick={() => handleSort('category')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">Category {renderSortIcon('category')}</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 text-center">Doc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d: any, i: number) => {
                      const rowNum = (page - 1) * limit + i + 1
                      const isBuy = d.tradeType === 'Buy'
                      return (
                        <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{rowNum}</TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date || '—'}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <div className="flex flex-col">
                              <Link
                                to={`/company/${(d.symbol || '').toLowerCase()}`}
                                className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline text-sm"
                              >
                                {d.symbol}
                              </Link>
                              {d.company && d.company !== d.symbol && (
                                <span className="text-xs text-textSecondary mt-0.5 line-clamp-1">{d.company}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isBuy ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'}`}>
                              {d.tradeType}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-surfaceMuted/50 text-textSecondary max-w-[160px] truncate" title={d.category}>
                              {d.category || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-textSecondary px-4 py-3 max-w-sm" title={d.description}>
                            <span className="line-clamp-2">{d.description || '—'}</span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {d.pdfLink ? (
                              <a
                                href={d.pdfLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center size-7 rounded hover:bg-accent/10 text-accent transition-colors"
                                title="View document"
                              >
                                <FileText className="size-4" />
                              </a>
                            ) : (
                              <span className="text-textMuted text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {!loading && total > 0 && (
              <PaginationBar
                total={total}
                page={page}
                limit={limit}
                onPageChange={(p) => dispatch(fetchInsiderTradesStart({ page: p, limit }))}
                onLimitChange={(l) => dispatch(fetchInsiderTradesStart({ page: 1, limit: l }))}
                limitOptions={[10, 15, 25, 50]}
              />
            )}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
