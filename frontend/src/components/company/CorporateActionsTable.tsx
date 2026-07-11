
import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  corporateActions, upcomingEvents, dividendHistory,
  type CorporateAction,
} from '@/lib/data/corporate-actions'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type TabKey = 'all' | 'dividends' | 'bonuses' | 'splits'
const TABS: { id: TabKey; label: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'splits', label: 'Splits' },
]

const YEARS = ['All', '2025', '2024', '2023', '2022', '2021', '2020']

export function CorporateActionsTable() {
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [yearFilter, setYearFilter] = useState('2023')
  const itemsPerPage = 6

  const storeActions = useAppSelector((state) => state.company?.corporateActions)
  const companyData = useAppSelector((state) => state.company?.data)
  const activeActions = storeActions?.corporateActions || corporateActions
  const activeUpcoming = storeActions?.upcomingEvents || upcomingEvents
  const activeDividends = storeActions?.dividendHistory || dividendHistory

  // Filter by tab
  const tabFiltered = activeActions.filter((a: CorporateAction) => {
    if (activeTab === 'dividends') return a.type === 'Dividend'
    if (activeTab === 'bonuses') return a.type === 'Bonus'
    if (activeTab === 'splits') return a.type === 'Split'
    return true
  })

  // Filter by year
  const filtered = yearFilter === 'All'
    ? tabFiltered
    : tabFiltered.filter((a: CorporateAction) => a.announcementDate.startsWith(yearFilter))

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedActions = filtered.slice(startIndex, startIndex + itemsPerPage)

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'Dividend': return 'bg-accentSoft text-accent border-blue-200 dark:border-blue-800'
      case 'Bonus': return 'bg-positive-soft/40 text-positive border-green-200 dark:border-green-800'
      case 'Split': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'
      default: return 'bg-warning-soft/40 text-warning border-amber-200 dark:border-amber-800'
    }
  }

  // Quick stat calculations
  const dividends = activeActions.filter((a: CorporateAction) => a.type === 'Dividend')
  const lastDividend = dividends[0]
  const bonuses = activeActions.filter((a: CorporateAction) => a.type === 'Bonus')
  const maxBar = Math.max(...activeDividends.map((d: any) => d.amount))

  // Dynamic stat values derived from real data
  const dividendYield = typeof companyData?.dividendYield === 'number'
    ? companyData.dividendYield.toFixed(2) + '%'
    : '—'
  // Parse dividend amount from details string like "₹15 per share" or use amount field
  const lastDivAmount = lastDividend
    ? (lastDividend as any).amount
      ? `₹${(lastDividend as any).amount}`
      : (lastDividend.details?.match(/₹?([\.\d]+)/)?.[0] ?? '—')
    : '—'
  const bonusRatio = bonuses[0]
    ? (bonuses[0].details || (bonuses[0] as any).ratio || '—')
    : '—'

  return (
    <div className="space-y-5 select-none">

      {/* ── Quick Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border/40 rounded-xl px-5 py-4 shadow-xs hover:shadow-sm transition-all duration-200">
          <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Dividend Yield</p>
          <p className="text-2xl font-medium font-mono text-textPrimary tabular-nums">{dividendYield}</p>
          <p className="text-xs text-positive font-medium mt-0.5">From company profile</p>
        </div>
        <div className="bg-surface border border-border/40 rounded-xl px-5 py-4 shadow-xs hover:shadow-sm transition-all duration-200">
          <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Last Dividend</p>
          <p className="text-2xl font-medium font-mono text-textPrimary tabular-nums">{lastDivAmount}</p>
          <p className="text-xs text-textMuted font-mono mt-0.5">{lastDividend ? formatDate(lastDividend.exDate) : '—'}</p>
        </div>
        <div className="bg-surface border border-border/40 rounded-xl px-5 py-4 shadow-xs hover:shadow-sm transition-all duration-200">
          <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Bonus Ratio</p>
          <p className="text-2xl font-medium font-mono text-textPrimary tabular-nums">{bonusRatio}</p>
          <p className="text-xs text-textMuted font-mono mt-0.5">Last: {bonuses[0] ? formatDate(bonuses[0].exDate) : '—'}</p>
        </div>
        <div className="bg-surface border border-border/40 rounded-xl px-5 py-4 shadow-xs hover:shadow-sm transition-all duration-200">
          <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Total Events</p>
          <p className="text-2xl font-medium font-mono text-textPrimary tabular-nums">{activeActions.length}</p>
          <p className="text-xs text-textMuted font-medium mt-0.5">Since IPO</p>
        </div>
      </div>

      {/* ── Main panel ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">

        {/* Left: Actions table */}
        <div className="bg-surface border border-border/40 shadow-xs rounded-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-medium text-textPrimary">Corporate Actions</h3>
            <p className="text-xs text-textMuted mt-0.5">
              Historical record of dividends, bonuses, splits, and rights issues
            </p>
          </div>

          {/* Tabs + Year filter */}
          <div className="flex items-center justify-between border-b border-border/40 px-3 bg-surfaceMuted/5">
            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setCurrentPage(1) }}
                  className={cn(
                    'px-4 py-3 text-xs font-medium uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-textSecondary hover:text-textPrimary'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-textMuted font-medium">Filter by year:</span>
              <select
                value={yearFilter}
                onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1) }}
                className="text-xs font-mono font-medium text-textPrimary bg-surface border border-border rounded-md px-2 py-1 focus:outline-none focus:border-accent"
              >
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-surfaceMuted">
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Event Type</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Announcement Date</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Record Date</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Ex-Date</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedActions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs text-textMuted">
                      No events found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedActions.map((action: CorporateAction) => (
                    <TableRow key={action.id} className="hover:bg-surfaceMuted/50 transition-colors">
                      <TableCell className="py-3">
                        <Badge variant="outline" className={cn('text-xs font-medium uppercase tracking-wide rounded-md', getBadgeColor(action.type))}>
                          {action.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-textSecondary font-mono py-3">{formatDate(action.announcementDate)}</TableCell>
                      <TableCell className="text-xs text-textSecondary font-mono py-3">{formatDate(action.recordDate)}</TableCell>
                      <TableCell className="text-xs text-textSecondary font-mono py-3">{formatDate(action.exDate)}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-textPrimary py-3">{action.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 border-t border-border/40 flex items-center justify-between bg-surfaceMuted/5 shrink-0">
            <span className="text-xs text-textSecondary font-medium">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} records
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0 border-border">
                <ChevronLeft className="size-4" />
              </Button>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(p)}
                  className={cn("h-8 w-8 p-0 text-xs font-medium", currentPage === p ? "bg-accent text-white" : "border-border")}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0 border-border">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Upcoming Events + CSS Dividend Chart */}
        <div className="space-y-4">
          {/* Upcoming Events */}
          <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-accent" />
              <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">Upcoming Events</span>
            </div>
            <CardContent className="p-4 space-y-4">
              {activeUpcoming.map((evt: any) => {
                const d = new Date(evt.date)
                const day = d.toLocaleDateString('en-IN', { day: '2-digit' })
                const mon = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
                return (
                  <div key={evt.title} className="flex gap-3 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <div className="size-10 rounded-xl bg-accentSoft border border-accent/20 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-accent uppercase leading-none">{mon}</span>
                      <span className="text-sm font-medium text-accent leading-tight">{day}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-medium text-textPrimary leading-snug">{evt.title}</h4>
                      <p className="text-xs text-accent font-mono font-medium mt-0.5">{formatDate(evt.date)} &nbsp;·&nbsp; {evt.type === 'EarningsCall' ? '5:00 PM IST' : '11:00 AM IST'}</p>
                      <p className="text-xs text-textSecondary leading-relaxed mt-1">{evt.description.slice(0, 80)}…</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Pure-CSS Dividend History Chart */}
          <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Download className="size-3.5 text-accent" />
                <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">Dividend History (₹/Share)</span>
              </div>
            </div>
            <CardContent className="p-4">
              {/* Pure CSS bar chart */}
              <div className="flex items-end gap-1.5 h-36 w-full">
                {activeDividends.map((d: any, i: number) => {
                  const heightPct = maxBar > 0 ? (d.amount / maxBar) * 100 : 0
                  const isLast = i === activeDividends.length - 1
                  return (
                    <div key={d.year} className="flex flex-col items-center flex-1 gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-gray-900 text-white text-xs font-mono px-2 py-1 rounded-md whitespace-nowrap">
                          ₹{d.amount.toFixed(2)}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all",
                          isLast ? "bg-accent/40 border-2 border-dashed border-accent" : "bg-accent group-hover:bg-accent/80"
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-xs font-mono text-textMuted whitespace-nowrap">{d.year}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-textMuted">
                <span className="flex items-center gap-1"><span className="size-2 bg-accent rounded-sm inline-block" /> Paid</span>
                <span className="flex items-center gap-1"><span className="size-2 bg-accent/30 border border-dashed border-accent rounded-sm inline-block" /> Estimated</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CorporateActionsTable
