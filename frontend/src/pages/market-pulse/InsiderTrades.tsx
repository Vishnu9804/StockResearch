import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
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

type SortField = 'company' | 'insider' | 'designation' | 'quantity' | 'price' | 'valueCr' | 'date'

interface InsiderTrade {
  date: string
  company: string
  symbol: string
  insider: string
  designation: string
  tradeType: 'Buy' | 'Sell'
  quantity: number
  price: number
  valueCr: number
}

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
    const filtered = trades.filter((d) =>
      tradeType === 'All' ? true : d.tradeType === tradeType
    )

    return [...filtered].sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = valB.toLowerCase()
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
          <span className="text-accent font-medium">Insider Trades</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-4">
          Insider Trades
        </Heading>

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
          /* Table card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5">
                  <TableRowsSkeleton rows={6} cols={9} />
                </div>
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No insider trades found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try selecting a different filter.
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
                        <div className="flex items-center">
                          Date {renderSortIcon('date')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Company {renderSortIcon('company')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('insider')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Insider Name {renderSortIcon('insider')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('designation')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Designation {renderSortIcon('designation')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Trade Type</TableHead>
                      <TableHead 
                        onClick={() => handleSort('quantity')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Quantity {renderSortIcon('quantity')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('price')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Price (₹) {renderSortIcon('price')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('valueCr')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Value (Cr) {renderSortIcon('valueCr')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d: any, i: number) => {
                      const isBuy = d.tradeType === 'Buy'
                      const rowNum = (page - 1) * limit + i + 1
                      return (
                        <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{rowNum}</TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date || '—'}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                              {d.company}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 font-semibold">{d.insider}</TableCell>
                          <TableCell className="text-sm text-textSecondary px-4 py-3">{d.designation}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isBuy ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                            }`}>
                              {d.tradeType}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {d.quantity?.toLocaleString('en-IN') || '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {d.price ? `₹${d.price.toLocaleString('en-IN')}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular font-semibold">
                            {d.valueCr ? `₹${Number(d.valueCr).toFixed(2)}` : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination bar */}
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
