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
import { fetchBlockDealsStart } from '@/store/slices/marketPulseSlice'
import type { RootState, AppDispatch } from '@/store'

const YEARS = ['2026', '2025', '2024']
type SortField = 'company' | 'action' | 'subject' | 'date'

const ACTION_COLORS: Record<string, string> = {
  Dividend: 'bg-amber-500/15 text-amber-500',
  Bonus: 'bg-green-500/15 text-green-500',
  Split: 'bg-blue-500/15 text-blue-500',
  Buyback: 'bg-purple-500/15 text-purple-500',
  'Rights Issue': 'bg-cyan-500/15 text-cyan-500',
}

export default function BlockDeals() {
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams, setSearchParams] = useSearchParams()

  const year      = searchParams.get('year')      ?? '2026'
  const sortBy    = (searchParams.get('sortBy')    ?? 'date') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const { items: deals, total, page, limit, status, error } =
    useSelector((s: RootState) => s.marketPulse.blockDeals)

  const loading = status === 'loading'

  useEffect(() => {
    dispatch(fetchBlockDealsStart({ page, limit }))
  }, [dispatch, page, limit])

  const handleRetry = () => dispatch(fetchBlockDealsStart({ page, limit }))

  const handleSort = (field: SortField) => {
    const p = new URLSearchParams(searchParams)
    if (sortBy === field) {
      p.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      p.set('sortBy', field)
      p.set('sortOrder', 'desc')
    }
    setSearchParams(p)
  }

  const handleYearChange = (y: string) => {
    const p = new URLSearchParams(searchParams)
    p.set('year', y)
    setSearchParams(p)
  }

  const sortedData = useMemo(() => {
    const filtered = deals.filter((d: any) => !d.date || d.date.startsWith(year))
    const base = filtered.length > 0 ? filtered : deals
    return [...base].sort((a: any, b: any) => {
      let vA: any = a[sortBy] ?? ''
      let vB: any = b[sortBy] ?? ''
      if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = String(vB).toLowerCase() }
      if (vA < vB) return sortOrder === 'asc' ? -1 : 1
      if (vA > vB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [deals, year, sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc'
      ? <ArrowUp className="size-3 ml-1 text-accent inline shrink-0" />
      : <ArrowDown className="size-3 ml-1 text-accent inline shrink-0" />
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
          <span className="text-accent font-medium">Corporate Actions</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Corporate Actions
        </Heading>
        <p className="text-sm text-textSecondary mb-4">Dividends, bonus issues, splits & buybacks from NSE/BSE</p>

        {/* Year chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                year === y
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-surface border-border hover:bg-surfaceMuted/65 text-textSecondary'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5"><TableRowsSkeleton rows={limit} cols={5} /></div>
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Inbox className="size-6 text-textMuted" /></EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No corporate actions found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try selecting a different year or page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[700px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead onClick={() => handleSort('date')} className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none">
                        <div className="flex items-center">Date {renderSortIcon('date')}</div>
                      </TableHead>
                      <TableHead onClick={() => handleSort('company')} className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none">
                        <div className="flex items-center">Company / Symbol {renderSortIcon('company')}</div>
                      </TableHead>
                      <TableHead onClick={() => handleSort('action')} className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none">
                        <div className="flex items-center">Action {renderSortIcon('action')}</div>
                      </TableHead>
                      <TableHead onClick={() => handleSort('subject')} className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none">
                        <div className="flex items-center">Details {renderSortIcon('subject')}</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d: any, i: number) => {
                      const rowNum = (page - 1) * limit + i + 1
                      const actionColor = ACTION_COLORS[d.action] ?? 'bg-surfaceMuted/50 text-textSecondary'
                      const displaySymbol = d.symbol && /^\d+$/.test(d.symbol) ? `BSE:${d.symbol}` : d.symbol
                      return (
                        <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{rowNum}</TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date || '—'}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            {d.symbol && !/^\d+$/.test(d.symbol) ? (
                              <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                                {d.company || d.symbol}
                              </Link>
                            ) : (
                              <span className="font-semibold text-textPrimary">{displaySymbol}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${actionColor}`}>
                              {d.action || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-textSecondary px-4 py-3 max-w-xs truncate" title={d.subject}>{d.subject || '—'}</TableCell>
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
                onPageChange={(p) => dispatch(fetchBlockDealsStart({ page: p, limit }))}
                onLimitChange={(l) => dispatch(fetchBlockDealsStart({ page: 1, limit: l }))}
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
