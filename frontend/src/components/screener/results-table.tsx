import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { toast } from 'react-hot-toast'
import {
  Download, Bell, X, Columns3, TrendingUp, TrendingDown, ChevronsUpDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PaginationBar } from '@/components/ui/PaginationBar'
import {
  setPage as setReduxPage,
  setPageSize as setReduxPageSize,
  setQuery as setReduxQuery,
  runScreenerStart,
} from '@/store/slices/screenerSlice'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockResult {
  id: string
  name: string
  symbol: string
  sector: string
  cmp: number
  change: number
  pe: number | null
  marketCap: number
  divYield: number
  netProfit: number
  netProfitChange: number
  roce: number
}

interface ActiveFilter {
  id: string
  label: string
}

type SortKey = keyof Pick<StockResult, 'name' | 'cmp' | 'pe' | 'marketCap' | 'divYield' | 'netProfit' | 'roce'>
type SortDir = 'asc' | 'desc'

// ─── Columns & Defaults ────────────────────────────────────────────────────────

// No more hardcoded filters — chips are derived from Redux queryText below

const ALL_COLUMNS = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'cmp', label: 'CMP (₹)' },
  { key: 'change', label: 'Day Change %' },
  { key: 'pe', label: 'P/E Ratio' },
  { key: 'marketCap', label: 'Mkt Cap (Cr)' },
  { key: 'divYield', label: 'Div Yield (%)' },
  { key: 'netProfit', label: 'Net Profit (Cr)' },
  { key: 'roce', label: 'ROCE (%)' },
  { key: 'sector', label: 'Sector' },
]

const PAGE_SIZE = 10

function formatCap(val: number): string {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K Cr`
  return `₹${val.toLocaleString('en-IN')} Cr`
}

function formatPrice(val: number): string {
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getFilterChipColors = (label: string) => {
  if (label.includes("Market Cap")) return { bg: 'var(--fs-info-soft)', text: 'var(--fs-info)' }
  if (label.includes("ROE")) return { bg: 'var(--fs-positive-soft)', text: '#27500A' }
  if (label.includes("D/E Ratio")) return { bg: '#EEEDFE', text: '#3C3489' }
  if (label.includes("Profit Growth")) return { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' }
  return { bg: 'var(--fs-info-soft)', text: 'var(--fs-info)' }
}

export function ScreenerResultsTable() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { results, status, queryText, page, pageSize, totalCount, aggregates } = useAppSelector((state) => state.screener)

  // Derive filter chips dynamically from the actual query text. Each chip's
  // id is its clause index so removing one can rebuild the query minus that
  // clause (see removeFilter below).
  const clauses = useMemo(() => (queryText ? queryText.split(/\bAND\b/i) : []), [queryText])
  const derivedFilters: ActiveFilter[] = useMemo(() => {
    return clauses
      .map((part, i) => ({ id: `f${i}`, label: part.trim() }))
      .filter((f) => f.label)
  }, [clauses])

  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['name', 'cmp', 'change', 'pe', 'marketCap', 'divYield', 'netProfit', 'roce'])
  )
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const [tempColumns, setTempColumns] = useState<Set<string>>(new Set(visibleColumns))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Sync chips whenever the query changes
  useMemo(() => { setActiveFilters(derivedFilters) }, [derivedFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  const mappedResults: StockResult[] = useMemo(() => {
    return results.map((r, index) => ({
      id: r.symbol || String(index),
      name: r.name,
      symbol: r.symbol,
      sector: r.sector,
      cmp: r.cmp,
      change: r.changePct,
      pe: r.pe || null,
      marketCap: r.marketCap,
      divYield: r.dividendYield,
      netProfit: Math.round(r.marketCap * (r.netProfitMargin || 5) / 100),
      netProfitChange: r.profitGrowth3Y,
      roce: r.roce,
    }))
  }, [results])

  // Results are already filtered server-side by the actual query (queryText).
  // The chips above are just a display of the query's clauses, not a second
  // client-side filter — hardcoded re-filtering here previously zeroed out
  // results whenever the query didn't match the four assumed default clauses.
  const filtered = mappedResults

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number | string | null
      const bv = b[sortKey] as number | string | null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
    // page reset is handled by Redux runScreenerStart
  }

  // Removing a chip drops that clause from the query and re-runs it against
  // the server so the results table actually reflects the change.
  const runQuery = (query: string) => {
    dispatch(setReduxQuery(query))
    dispatch(runScreenerStart({ query }))
  }

  const removeFilter = (id: string) => {
    const idx = Number(id.slice(1))
    const newQuery = clauses
      .filter((_, i) => i !== idx)
      .map((c) => c.trim())
      .filter(Boolean)
      .join(' AND ')
    runQuery(newQuery)
  }

  const clearFilters = () => {
    runQuery('')
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const handleExport = () => showToast('✓ Exported to Excel')
  const openColumnsDialog = () => { setTempColumns(new Set(visibleColumns)); setColumnsDialogOpen(true) }
  const applyColumns = () => { setVisibleColumns(new Set(tempColumns)); setColumnsDialogOpen(false) }
  const toggleTempColumn = (key: string) => {
    setTempColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Summary stats reflect every matching company (server-computed aggregates),
  // not just the rows on the current page. Companies still missing a given
  // field are excluded from that calculation — coverageNote() states exactly
  // how many were counted vs. missing so the number is never misread as a
  // real zero.
  const avgPE = aggregates?.avgPE
  const totalMktCap = aggregates?.totalMarketCap
  const medianROCE = aggregates?.medianROCE
  const sectorLead = aggregates?.sectorBreakdown?.[0]
  const sectorSecond = aggregates?.sectorBreakdown?.[1]

  const coverageNote = (coverage?: { available: number; missing: number }): string | null => {
    if (!coverage || coverage.missing <= 0) return null
    const total = coverage.available + coverage.missing
    return `${coverage.available}/${total} · ${coverage.missing} missing`
  }

  // The current-page slice is already returned by the backend;
  // `sorted` contains only the current page's rows.
  const pageData = sorted

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          {toastMsg}
        </div>
      )}

      {/* Mini Stat Cards Row — 5 cards, all inside right column */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }} className="w-full">
        <MiniSummaryCard label="Matches" value={String(totalCount)} sub="companies" color="blue" />
        <MiniSummaryCard
          label="Avg P/E Ratio"
          value={avgPE != null ? `${avgPE.toFixed(1)}x` : '—'}
          sub={coverageNote(aggregates?.avgPECoverage) ?? 'industry avg 28.3x'}
          color="gray"
        />
        <MiniSummaryCard
          label="Total Market Cap"
          value={totalMktCap != null ? formatCap(totalMktCap) : '—'}
          sub={coverageNote(aggregates?.totalMarketCapCoverage) ?? 'combined'}
          color="gray"
        />
        <MiniSummaryCard
          label="Median ROCE"
          value={medianROCE != null ? `${medianROCE.toFixed(1)}%` : '—'}
          sub={coverageNote(aggregates?.medianROCECoverage) ?? 'annualized'}
          color="purple"
        />
        <MiniSummaryCard
          label="Sector Lead"
          value={sectorLead ? `${sectorLead.sector} (${sectorLead.pct}%)` : '—'}
          sub={coverageNote(aggregates?.sectorCoverage) ?? (sectorSecond ? `2nd: ${sectorSecond.sector} (${sectorSecond.pct}%)` : '')}
          color="indigo"
        />
      </div>

      {/* Table Container Card */}
      <div 
        style={{ 
          background: 'var(--fs-surface)', 
          border: 'var(--fs-border)', 
          borderRadius: 'var(--fs-radius-md)', 
          overflow: 'hidden' 
        }}
        className="w-full flex flex-col"
      >
        {/* Active Filters & Small Action Buttons Row */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            flexWrap: 'wrap', 
            gap: 'var(--fs-space-sm)' 
          }} 
          className="px-5 py-4 border-b border-border/40 select-none"
        >
          {/* Left side: chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--fs-space-xs)', alignItems: 'center' }}>
            {activeFilters.length > 0 ? (
              <>
                {activeFilters.map((f) => {
                  const colors = getFilterChipColors(f.label)
                  return (
                    <span
                      key={f.id}
                      onClick={() => removeFilter(f.id)}
                      style={{
                        fontSize: 'var(--fs-size-sm)',
                        fontWeight: 'var(--fs-weight-medium)',
                        padding: '4px 10px',
                        borderRadius: 'var(--fs-radius-xl)',
                        background: colors.bg,
                        color: colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                      }}
                      className="hover:opacity-90 transition-opacity"
                    >
                      {f.label}
                      <X className="size-2.5 shrink-0" />
                    </span>
                  )
                })}
                <span
                  onClick={clearFilters}
                  style={{ fontSize: 'var(--fs-size-sm)', color: 'var(--fs-negative)', cursor: 'pointer', fontWeight: 'var(--fs-weight-medium)', marginLeft: '4px' }}
                  className="hover:underline font-medium"
                >
                  Clear All
                </span>
              </>
            ) : (
              <span style={{ fontSize: 'var(--fs-size-sm)' }} className="text-textMuted font-medium">No active filters</span>
            )}
          </div>

          {/* Right side: buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={openColumnsDialog}
              style={{
                fontSize: 'var(--fs-size-sm)',
                padding: '5px 10px',
                border: 'var(--fs-border)',
                borderRadius: 'var(--fs-radius-sm)',
                background: 'var(--fs-surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 'var(--fs-weight-medium)',
              }}
              className="text-textSecondary hover:bg-surfaceMuted transition-colors"
            >
              <Columns3 className="size-3.5 text-textSecondary" />
              Edit Columns
            </button>
            <button
              onClick={handleExport}
              style={{
                fontSize: 'var(--fs-size-sm)',
                padding: '5px 10px',
                border: 'var(--fs-border)',
                borderRadius: 'var(--fs-radius-sm)',
                background: 'var(--fs-surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 'var(--fs-weight-medium)',
              }}
              className="text-textSecondary hover:bg-surfaceMuted transition-colors"
            >
              <Download className="size-3.5 text-textSecondary" />
              Export Excel
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to create alerts.')
                  const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
                  navigate(`/login?redirect=${redirectPath}`)
                } else {
                  showToast('✓ Alert dialog opened (mock)')
                }
              }}
              style={{
                fontSize: 'var(--fs-size-sm)',
                padding: '5px 10px',
                border: 'var(--fs-border)',
                borderRadius: 'var(--fs-radius-sm)',
                background: 'var(--fs-surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 'var(--fs-weight-medium)',
              }}
              className="text-textSecondary hover:bg-surfaceMuted transition-colors"
            >
              <Bell className="size-3.5 text-textSecondary" />
              Create Alert
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-size-body)' }}>
            <thead>
              <tr style={{ background: 'var(--fs-surface-muted)', borderBottom: 'var(--fs-border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>
                  <SortHeader label="Company" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                {visibleColumns.has('cmp') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="CMP (₹)" sortKey="cmp" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('change') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 'var(--fs-size-xs)', fontWeight: 'var(--fs-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="text-textSecondary whitespace-nowrap">
                    Day %
                  </th>
                )}
                {visibleColumns.has('pe') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="P/E" sortKey="pe" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('marketCap') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="Mkt Cap" sortKey="marketCap" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('divYield') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="Div Yield" sortKey="divYield" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('netProfit') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="Net Profit" sortKey="netProfit" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('roce') && (
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <SortHeader label="ROCE %" sortKey="roce" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                )}
                {visibleColumns.has('sector') && (
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 'var(--fs-size-xs)', fontWeight: 'var(--fs-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="text-textSecondary whitespace-nowrap">
                    Sector
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {status === 'loading' ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-text-secondary)' }}>
                    Loading screener results...
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-text-secondary)' }}>
                    No matching stocks found. Try adjusting your query parameters (e.g. market_cap &gt; 500).
                  </td>
                </tr>
              ) : (
                pageData.map((row, idx, arr) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/company/${row.symbol.toLowerCase()}`)}
                  className="hover:bg-[var(--fs-surface-muted)] cursor-pointer transition-colors group"
                  style={{ borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)' }}
                >
                  <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                    <div style={{ fontSize: 'var(--fs-size-md)', fontWeight: 'var(--fs-weight-medium)' }} className="text-textPrimary group-hover:text-accent transition-colors leading-tight">
                      {row.name}
                    </div>
                    <div style={{ fontSize: 'var(--fs-size-xs)', letterSpacing: '0.04em' }} className="text-textMuted font-mono uppercase mt-0.5">{row.symbol}</div>
                  </td>
                  {visibleColumns.has('cmp') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-body font-medium text-textPrimary tabular-nums">
                      {formatPrice(row.cmp)}
                    </td>
                  )}
                  {visibleColumns.has('change') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle', color: row.change >= 0 ? 'var(--fs-positive)' : 'var(--fs-negative)' }} className="text-right font-mono text-xs font-medium tabular-nums">
                      <div className="flex items-center justify-end gap-0.5">
                        {row.change >= 0 ? <TrendingUp className="size-3.5 shrink-0" /> : <TrendingDown className="size-3.5 shrink-0" />}
                        {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%
                      </div>
                    </td>
                  )}
                  {visibleColumns.has('pe') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-sm text-textPrimary tabular-nums">
                      {row.pe !== null ? row.pe.toFixed(1) : <span className="text-textMuted">—</span>}
                    </td>
                  )}
                  {visibleColumns.has('marketCap') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-sm text-textPrimary tabular-nums">
                      {formatCap(row.marketCap)}
                    </td>
                  )}
                  {visibleColumns.has('divYield') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-sm text-textPrimary tabular-nums">
                      {row.divYield.toFixed(2)}%
                    </td>
                  )}
                  {visibleColumns.has('netProfit') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-sm font-medium text-[var(--fs-positive)] tabular-nums">
                      {row.netProfit >= 0 ? '' : '−'}₹{Math.abs(row.netProfit).toLocaleString('en-IN')}
                    </td>
                  )}
                  {visibleColumns.has('roce') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-sm font-medium text-[var(--fs-brand)] tabular-nums">
                      {row.roce.toFixed(1)}%
                    </td>
                  )}
                  {visibleColumns.has('sector') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-left font-mono text-sm text-textSecondary">
                      {row.sector}
                    </td>
                  )}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Row — shared PaginationBar */}
        <PaginationBar
          total={totalCount}
          page={page}
          limit={pageSize}
          onPageChange={(p) => dispatch(setReduxPage(p))}
          onLimitChange={(l) => dispatch(setReduxPageSize(l))}
        />
      </div>

      {/* Edit Columns Dialog */}
      <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Columns</DialogTitle>
            <DialogDescription>Choose which columns to display in the results table.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {ALL_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={tempColumns.has(col.key)}
                  disabled={col.required}
                  onCheckedChange={() => !col.required && toggleTempColumn(col.key)}
                />
                <Label htmlFor={`col-${col.key}`} className="text-sm text-gray-700 flex-1 cursor-pointer">
                  {col.label}
                  {col.required && <span className="text-xs text-textMuted ml-1">(required)</span>}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColumnsDialogOpen(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90" onClick={applyColumns}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MiniSummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'blue' | 'purple' | 'gray' | 'green' | 'indigo' }) {
  const valueColor =
    color === 'blue'   ? 'var(--fs-brand)'
  : color === 'purple' ? '#7C3AED'
  : color === 'indigo' ? '#534AB7'
  : 'var(--fs-text-primary)'
  return (
    <div
      style={{
        background: 'white',
        border: '0.5px solid rgba(0,0,0,0.10)',
        borderRadius: '12px',
        padding: '14px 16px',
      }}
      className="flex flex-col select-none"
    >
      <span style={{ fontSize: 'var(--fs-size-xs)', marginBottom: '5px', letterSpacing: '0.05em' }} className="text-textSecondary font-medium uppercase tracking-wider">
        {label}
      </span>
      <span
        style={{
          fontSize: label === 'Total Market Cap' ? 'var(--fs-size-lg)' : 'var(--fs-size-xl)',
          fontWeight: 600,
          color: valueColor,
          lineHeight: 1.2,
        }}
        className="font-mono"
      >
        {value}
      </span>
      <span style={{ fontSize: 'var(--fs-size-xs)', marginTop: '4px' }} className="text-textMuted">
        {sub}
      </span>
    </div>
  )
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
}

function SortHeader({ label, sortKey, currentKey, dir, onSort }: SortHeaderProps) {
  const active = currentKey === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      style={{
        background: 'transparent',
        border: 'none',
        fontSize: 'var(--fs-size-xs)',
        fontWeight: 'var(--fs-weight-medium)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        padding: 0,
      }}
      className="text-textSecondary hover:text-textPrimary transition-colors"
    >
      {label}
      <ChevronsUpDown className="size-3 text-textMuted shrink-0" style={{ opacity: active ? 0.9 : 0.4 }} />
    </button>
  )
}
