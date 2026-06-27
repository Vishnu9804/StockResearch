import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { industries } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'

type SortField = 'name' | 'stocks' | 'marketCapCr' | 'peRatio' | 'pbRatio' | 'roePercent' | 'rocePct' | 'changePercent'

export default function Industries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortBy = (searchParams.get('sortBy') ?? 'marketCapCr') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = (showError = false) => {
    setLoading(true)
    setError(null)
    const delay = setTimeout(() => {
      if (showError) {
        setError('Failed to fetch industries data. Please retry.')
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

  const sortedData = useMemo(() => {
    return [...industries].sort((a, b) => {
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
  }, [sortBy, sortOrder])

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
          <span className="text-accent font-medium">Industries Overview</span>
        </div>

        {/* H1 */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Industries Overview
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={9} />
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No industry details found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Industry overview records are currently empty.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[800px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead 
                        onClick={() => handleSort('name')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Industry {renderSortIcon('name')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('stocks')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Stocks {renderSortIcon('stocks')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('marketCapCr')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Market Cap (Cr) {renderSortIcon('marketCapCr')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('peRatio')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          P/E {renderSortIcon('peRatio')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('pbRatio')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          P/B {renderSortIcon('pbRatio')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('roePercent')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          ROE % {renderSortIcon('roePercent')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('rocePct')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          ROCE % {renderSortIcon('rocePct')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('changePercent')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Change % {renderSortIcon('changePercent')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((ind, idx) => {
                      const isPositive = ind.changePercent >= 0
                      return (
                        <TableRow key={ind.name} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-semibold text-textPrimary px-4 py-3">{ind.name}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.stocks}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            ₹{ind.marketCapCr.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.peRatio}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.pbRatio}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.roePercent}%</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.rocePct}%</TableCell>
                          <TableCell className={`text-right text-sm font-semibold px-4 py-3 tabular ${
                            isPositive ? 'text-positive' : 'text-negative'
                          }`}>
                            {isPositive ? '+' : ''}{ind.changePercent}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            {!loading && (
              <div className="px-4 py-3 text-xs text-textMuted border-t border-border/40 bg-surfaceMuted/10">
                Showing {sortedData.length} industries
              </div>
            )}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
