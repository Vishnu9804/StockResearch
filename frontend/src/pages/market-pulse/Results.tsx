import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { finscreenClient } from '@/services/finscreenApi'
import { useCompanyNameResolver } from '@/hooks/useCompanyNameResolver'

type SortField = 'company' | 'expectedResultDate' | 'lastQuarterRevenue' | 'lastQuarterPat' | 'lastQuarterEbitdaMargin'

interface ResultRow {
  symbol: string
  company: string
  expectedResultDate: string
  lastQuarter: string | null
  lastQuarterRevenue: number | null
  lastQuarterPat: number | null
  lastQuarterEbitdaMargin: number | null
}

export default function Results() {
  const resolveName = useCompanyNameResolver()
  const [searchParams, setSearchParams] = useSearchParams()
  const sortBy = (searchParams.get('sortBy') ?? 'expectedResultDate') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc'
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Number(searchParams.get('limit') ?? '15')

  const [results, setResults] = useState<ResultRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await finscreenClient.get('/market/results-calendar', {
        params: { page, limit }
      })
      setResults(res.data?.items || [])
      setTotal(res.data?.total || 0)
    } catch (err: any) {
      console.error('Failed to fetch results calendar:', err)
      setError('Failed to fetch quarterly results. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const handleSort = (field: SortField) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === field) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', field)
      newParams.set('sortOrder', 'asc')
    }
    setSearchParams(newParams)
  }

  const handlePageChange = (p: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', p.toString())
    setSearchParams(newParams)
  }

  const handleLimitChange = (l: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('limit', l.toString())
    newParams.set('page', '1')
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    return [...results].sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      // Nulls (companies we couldn't resolve last-quarter financials for)
      // always sort last regardless of direction.
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [results, sortBy, sortOrder])

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
          <span className="text-accent font-medium">Upcoming Results</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Upcoming Quarterly Results
        </Heading>
        <p className="text-sm text-textSecondary mb-6">
          Companies expected to report results soon. Revenue/PAT/EBITDA % shown are the most recently
          <span className="font-semibold text-textPrimary"> actually reported</span> quarter, not a forecast for the upcoming one.
        </p>

        {error ? (
          <InlineError message={error} onRetry={fetchResults} className="mb-8" />
        ) : (
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              {loading ? (
                <TableRowsSkeleton rows={limit} cols={6} />
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No upcoming results found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try a different page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[800px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">Company {renderSortIcon('company')}</div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('expectedResultDate')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">Expected Date {renderSortIcon('expectedResultDate')}</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Last Qtr</TableHead>
                      <TableHead
                        onClick={() => handleSort('lastQuarterRevenue')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">Last Qtr Revenue (Cr) {renderSortIcon('lastQuarterRevenue')}</div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('lastQuarterPat')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">Last Qtr PAT (Cr) {renderSortIcon('lastQuarterPat')}</div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort('lastQuarterEbitdaMargin')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">Last Qtr EBITDA % {renderSortIcon('lastQuarterEbitdaMargin')}</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((r, idx) => {
                      const globalIdx = (page - 1) * limit + idx + 1
                      return (
                        <TableRow key={`${r.symbol}-${idx}`} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{globalIdx}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            {r.symbol && !/^\d+$/.test(r.symbol) ? (
                              <div className="flex flex-col">
                                <Link to={`/company/${r.symbol}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline text-xs line-clamp-1" title={r.company && r.company !== r.symbol ? r.company : resolveName(r.symbol)}>
                                  {r.company && r.company !== r.symbol ? r.company : resolveName(r.symbol)}
                                </Link>
                                <span className="text-[10px] text-textSecondary mt-0.5 font-mono">{r.symbol}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-textPrimary">{r.company}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{r.expectedResultDate}</TableCell>
                          <TableCell className="text-sm text-textSecondary px-4 py-3">{r.lastQuarter || '—'}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {r.lastQuarterRevenue != null ? r.lastQuarterRevenue.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {r.lastQuarterPat != null ? r.lastQuarterPat.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {r.lastQuarterEbitdaMargin != null ? `${r.lastQuarterEbitdaMargin}%` : '—'}
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
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
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
