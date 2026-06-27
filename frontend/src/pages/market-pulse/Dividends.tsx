import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { dividendsAll } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'

const YEARS = ['2026', '2025', '2024']
const DIV_TYPES = ['All', 'Final', 'Interim', 'Special']

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Final: { bg: 'var(--fs-positive-soft)', color: 'var(--fs-positive)' },
  Interim: { bg: 'var(--fs-info-soft)', color: 'var(--fs-info)' },
  Special: { bg: 'var(--fs-warning-soft)', color: 'var(--fs-warning)' },
}

type SortField = 'company' | 'exDate' | 'recordDate' | 'dividendType' | 'dividendPerShare' | 'fy'

export default function Dividends() {
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? '2026'
  const divType = searchParams.get('divType') ?? 'All'
  const sortBy = (searchParams.get('sortBy') ?? 'exDate') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = (showError = false) => {
    setLoading(true)
    setError(null)
    const delay = setTimeout(() => {
      if (showError) {
        setError('Failed to fetch dividends data. Please retry.')
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

  const handleYearChange = (y: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('year', y)
    setSearchParams(newParams)
  }

  const handleTypeChange = (t: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('divType', t)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const filtered = dividendsAll.filter(row => {
      const matchesType = divType === 'All' || row.dividendType === divType
      const matchesYear = row.exDate?.startsWith(year)
      return matchesType && matchesYear
    })

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
  }, [year, divType, sortBy, sortOrder])

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
          <span className="text-accent font-medium">Dividends</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-4">
          Dividends
        </Heading>

        {/* Year Chips */}
        <div className="flex gap-2 mb-6">
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                year === y
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-surface border-border hover:bg-surfaceMuted/65 text-textPrimary'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Two-column responsive grid */
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
            {/* LEFT: Table card */}
            <div className="lg:col-span-7 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                {loading ? (
                  <TableRowsSkeleton rows={6} cols={7} />
                ) : sortedData.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Inbox className="size-6 text-textMuted" />
                      </EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No dividends found for selected filters</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Try changing the Dividend Type checkbox or selecting another year chip.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table className="min-w-[640px] animate-[fadeInUp_0.18s_ease-out]">
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
                        <TableHead 
                          onClick={() => handleSort('exDate')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Ex-Date {renderSortIcon('exDate')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('recordDate')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Record Date {renderSortIcon('recordDate')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('dividendType')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Type {renderSortIcon('dividendType')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('dividendPerShare')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Dividend/Share (₹) {renderSortIcon('dividendPerShare')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('fy')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            FY {renderSortIcon('fy')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((row, idx) => {
                        const badgeColors = TYPE_COLORS[row.dividendType] ?? { bg: 'var(--fs-surface-muted)', color: 'var(--fs-text-secondary)' }
                        return (
                          <TableRow key={idx} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                            <TableCell className="text-sm text-textMuted px-4 py-3">{idx + 1}</TableCell>
                            <TableCell className="text-sm px-4 py-3">
                              <Link to={`/company/${row.symbol}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                                {row.company}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{row.exDate}</TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{row.recordDate}</TableCell>
                            <TableCell className="text-sm px-4 py-3">
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: badgeColors.bg, color: badgeColors.color }}
                              >
                                {row.dividendType}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-textPrimary font-semibold px-4 py-3 tabular">
                              ₹{row.dividendPerShare}
                            </TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-3">{row.fy}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* RIGHT: Filter sidebar */}
            <div className="lg:col-span-3 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs lg:sticky lg:top-6">
              <div className="p-4 border-b border-border/40 bg-surfaceMuted/20">
                <span className="text-sm font-semibold text-textPrimary">Filter</span>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-3">
                  Dividend Type
                </div>
                <div className="flex flex-col gap-2">
                  {DIV_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-surfaceMuted/40 cursor-pointer text-sm text-textPrimary select-none">
                      <input
                        type="checkbox"
                        checked={divType === t}
                        onChange={() => handleTypeChange(t)}
                        className="accent-accent cursor-pointer size-3.5 outline-ring/45 focus-visible:outline"
                      />
                      <span>{t}</span>
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
