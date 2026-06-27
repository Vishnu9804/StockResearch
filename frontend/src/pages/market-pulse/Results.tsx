import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { quarterlyResults } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'

const allSectors = ['All', ...Array.from(new Set(quarterlyResults.map(r => r.sector)))]

type SortField = 'company' | 'resultDate' | 'revenue' | 'revenueChange' | 'pat' | 'patChange' | 'ebitdaMargin'

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sector = searchParams.get('sector') ?? 'All'
  const sortBy = (searchParams.get('sortBy') ?? 'resultDate') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = (showError = false) => {
    setLoading(true)
    setError(null)
    const delay = setTimeout(() => {
      if (showError) {
        setError('Failed to fetch quarterly results. Please retry.')
      } else {
        setLoading(false)
      }
    }, 450)
    return () => clearTimeout(delay)
  }

  useEffect(() => {
    const mockError = searchParams.get('error') === 'true'
    const cleanup = handleFetch(mockError)
    return cleanup
  }, [searchParams])

  const handleRetry = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('error')
    setSearchParams(newParams)
    handleFetch(false)
  }

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

  const handleSectorChange = (sec: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sector', sec)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const filtered = quarterlyResults.filter(r =>
      sector === 'All' || r.sector === sector
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
  }, [sector, sortBy, sortOrder])

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
          <span className="text-accent font-medium">Quarterly Results</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Latest Quarterly Results
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Two-column responsive grid */
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
            {/* LEFT: Table card */}
            <div className="lg:col-span-7 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                {loading ? (
                  <TableRowsSkeleton rows={6} cols={9} />
                ) : sortedData.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Inbox className="size-6 text-textMuted" />
                      </EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No records match the current filters</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Try changing the selected Sector checkbox.
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
                          <div className="flex items-center">
                            Company {renderSortIcon('company')}
                          </div>
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Quarter</TableHead>
                        <TableHead 
                          onClick={() => handleSort('resultDate')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Result Date {renderSortIcon('resultDate')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('revenue')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Revenue (Cr) {renderSortIcon('revenue')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('revenueChange')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Rev Chg % {renderSortIcon('revenueChange')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('pat')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            PAT (Cr) {renderSortIcon('pat')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('patChange')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            PAT Chg % {renderSortIcon('patChange')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('ebitdaMargin')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            EBITDA % {renderSortIcon('ebitdaMargin')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((r, idx) => {
                        const isRevPos = r.revenueChange >= 0
                        const isPatPos = r.patChange >= 0
                        return (
                          <TableRow key={idx} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                            <TableCell className="text-sm text-textMuted px-4 py-3">{idx + 1}</TableCell>
                            <TableCell className="text-sm px-4 py-3">
                              <Link to={`/company/${r.symbol}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                                {r.company}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-3">{r.quarter}</TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{r.resultDate}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{r.revenue.toLocaleString('en-IN')}</TableCell>
                            <TableCell className={`text-right text-sm font-semibold px-4 py-3 tabular ${isRevPos ? 'text-positive' : 'text-negative'}`}>
                              {isRevPos ? '+' : ''}{r.revenueChange}%
                            </TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{r.pat.toLocaleString('en-IN')}</TableCell>
                            <TableCell className={`text-right text-sm font-semibold px-4 py-3 tabular ${isPatPos ? 'text-positive' : 'text-negative'}`}>
                              {isPatPos ? '+' : ''}{r.patChange}%
                            </TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{r.ebitdaMargin}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
              {!loading && (
                <div className="px-4 py-3 text-xs text-textMuted border-t border-border/40 bg-surfaceMuted/10">
                  Showing {sortedData.length} results
                </div>
              )}
            </div>

            {/* RIGHT: Filter sidebar */}
            <div className="lg:col-span-3 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs lg:sticky lg:top-6">
              <div className="p-4 border-b border-border/40 bg-surfaceMuted/20">
                <span className="text-sm font-semibold text-textPrimary">Filter</span>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-3">
                  Sector
                </div>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {allSectors.map(s => (
                    <label key={s} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-surfaceMuted/40 cursor-pointer text-sm text-textPrimary select-none">
                      <input
                        type="checkbox"
                        checked={sector === s}
                        onChange={() => handleSectorChange(s)}
                        className="accent-accent cursor-pointer size-3.5 outline-ring/45 focus-visible:outline"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
