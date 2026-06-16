import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import { toast } from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight,
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RESULTS: StockResult[] = [
  { id: '1', name: 'Reliance Industries', symbol: 'RELIANCE', sector: 'Energy', cmp: 2847.35, change: 1.24, pe: 24.6, marketCap: 1926432, divYield: 0.42, netProfit: 19945, netProfitChange: 12.3, roce: 11.8 },
  { id: '2', name: 'Infosys Ltd', symbol: 'INFY', sector: 'IT', cmp: 1521.80, change: -0.78, pe: 21.4, marketCap: 633142, divYield: 2.61, netProfit: 6548, netProfitChange: 8.9, roce: 33.2 },
  { id: '3', name: 'HDFC Bank', symbol: 'HDFCBANK', sector: 'Banking', cmp: 1687.45, change: 0.52, pe: 18.2, marketCap: 1276543, divYield: 1.18, netProfit: 16511, netProfitChange: 21.7, roce: 17.4 },
  { id: '4', name: 'TCS Ltd', symbol: 'TCS', sector: 'IT', cmp: 3956.20, change: -1.12, pe: 28.3, marketCap: 1432876, divYield: 1.52, netProfit: 12434, netProfitChange: 11.2, roce: 55.3 },
  { id: '5', name: 'Avenue Supermarts', symbol: 'DMART', sector: 'Retail', cmp: 4213.60, change: 2.34, pe: 86.4, marketCap: 273498, divYield: 0.00, netProfit: 2278, netProfitChange: 17.8, roce: 18.9 },
  { id: '6', name: 'Bajaj Finance', symbol: 'BAJFINANCE', sector: 'NBFC', cmp: 7856.90, change: 1.87, pe: 31.2, marketCap: 473921, divYield: 0.26, netProfit: 5658, netProfitChange: 31.4, roce: 10.2 },
  { id: '7', name: 'Asian Paints', symbol: 'ASIANPAINT', sector: 'Consumer', cmp: 2934.15, change: -0.34, pe: 52.1, marketCap: 280896, divYield: 1.16, netProfit: 1512, netProfitChange: 4.5, roce: 29.7 },
  { id: '8', name: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK', sector: 'Banking', cmp: 1923.75, change: 0.91, pe: 22.7, marketCap: 383429, divYield: 0.10, netProfit: 4133, netProfitChange: 26.3, roce: 13.2 },
  { id: '9', name: 'Larsen & Toubro', symbol: 'LT', sector: 'Engineering', cmp: 3512.40, change: 1.56, pe: 33.8, marketCap: 494632, divYield: 0.91, netProfit: 10472, netProfitChange: 17.5, roce: 14.7 },
  { id: '10', name: 'Titan Company', symbol: 'TITAN', sector: 'Consumer', cmp: 3398.00, change: -0.23, pe: 71.6, marketCap: 301754, divYield: 0.31, netProfit: 3497, netProfitChange: 22.1, roce: 28.4 },
  { id: '11', name: 'Sun Pharmaceutical', symbol: 'SUNPHARMA', sector: 'Pharma', cmp: 1648.90, change: 0.67, pe: 38.2, marketCap: 395232, divYield: 0.91, netProfit: 3892, netProfitChange: 19.6, roce: 19.3 },
  { id: '12', name: 'Wipro Ltd', symbol: 'WIPRO', sector: 'IT', cmp: 459.35, change: -1.44, pe: 19.8, marketCap: 239891, divYield: 0.22, netProfit: 3053, netProfitChange: -2.8, roce: 24.1 },
  { id: '13', name: 'HCL Technologies', symbol: 'HCLTECH', sector: 'IT', cmp: 1578.60, change: 0.89, pe: 22.6, marketCap: 428243, divYield: 3.80, netProfit: 4350, netProfitChange: 14.3, roce: 30.7 },
  { id: '14', name: 'Maruti Suzuki', symbol: 'MARUTI', sector: 'Auto', cmp: 13240.00, change: 2.12, pe: 25.4, marketCap: 400368, divYield: 1.13, netProfit: 13490, netProfitChange: 64.2, roce: 21.8 },
  { id: '15', name: 'Nestle India', symbol: 'NESTLEIND', sector: 'FMCG', cmp: 2298.75, change: 0.18, pe: 71.9, marketCap: 221632, divYield: 1.93, netProfit: 3143, netProfitChange: 37.9, roce: 122.3 },
  { id: '16', name: 'Pidilite Industries', symbol: 'PIDILITIND', sector: 'Chemicals', cmp: 2876.40, change: -0.67, pe: 84.3, marketCap: 145987, divYield: 0.49, netProfit: 1387, netProfitChange: 11.7, roce: 33.8 },
  { id: '17', name: 'Hindustan Unilever', symbol: 'HINDUNILVR', sector: 'FMCG', cmp: 2412.30, change: -0.52, pe: 53.7, marketCap: 566432, divYield: 2.09, netProfit: 10143, netProfitChange: 5.6, roce: 22.6 },
  { id: '18', name: 'Divis Laboratories', symbol: 'DIVISLAB', sector: 'Pharma', cmp: 5342.10, change: 1.23, pe: 43.2, marketCap: 142176, divYield: 0.75, netProfit: 1891, netProfitChange: 35.8, roce: 26.4 },
  { id: '19', name: 'ITC Ltd', symbol: 'ITC', sector: 'FMCG', cmp: 453.80, change: 0.34, pe: 26.1, marketCap: 567892, divYield: 3.28, netProfit: 20458, netProfitChange: 11.2, roce: 35.8 },
  { id: '20', name: 'ICICI Bank', symbol: 'ICICIBANK', sector: 'Banking', cmp: 1245.60, change: 1.03, pe: 17.8, marketCap: 876543, divYield: 0.80, netProfit: 11059, netProfitChange: 38.5, roce: 14.3 },
  { id: '21', name: 'SBI Life Insurance', symbol: 'SBILIFE', sector: 'Insurance', cmp: 1643.20, change: -0.41, pe: 67.8, marketCap: 164320, divYield: 0.18, netProfit: 1894, netProfitChange: 29.7, roce: 16.8 },
  { id: '22', name: 'Tata Consultancy', symbol: 'TCS', sector: 'IT', cmp: 3945.10, change: 0.44, pe: 27.9, marketCap: 1429834, divYield: 1.54, netProfit: 12103, netProfitChange: 9.8, roce: 54.7 },
  { id: '23', name: 'Polycab India', symbol: 'POLYCAB', sector: 'Electricals', cmp: 6234.50, change: 3.21, pe: 38.9, marketCap: 93432, divYield: 0.64, netProfit: 1698, netProfitChange: 28.4, roce: 31.2 },
  { id: '24', name: 'Delhivery Ltd', symbol: 'DELHIVERY', sector: 'Logistics', cmp: 412.35, change: -2.15, pe: null, marketCap: 30432, divYield: 0.00, netProfit: -109, netProfitChange: 87.3, roce: 5.2 },
  { id: '25', name: 'Laurus Labs', symbol: 'LAURUSLABS', sector: 'Pharma', cmp: 789.20, change: 1.78, pe: 22.3, marketCap: 42432, divYield: 0.13, netProfit: 678, netProfitChange: -14.2, roce: 17.4 },
  { id: '26', name: 'Cholafin', symbol: 'CHOLAFIN', sector: 'NBFC', cmp: 1342.60, change: 0.89, pe: 28.4, marketCap: 111543, divYield: 0.08, netProfit: 2140, netProfitChange: 27.1, roce: 8.9 },
  { id: '27', name: 'Havells India', symbol: 'HAVELLS', sector: 'Electricals', cmp: 1567.80, change: -0.87, pe: 62.8, marketCap: 98456, divYield: 0.64, netProfit: 1312, netProfitChange: 10.4, roce: 27.3 },
  { id: '28', name: 'Page Industries', symbol: 'PAGEIND', sector: 'Consumer', cmp: 43210.00, change: 0.31, pe: 68.4, marketCap: 48234, divYield: 0.83, netProfit: 716, netProfitChange: 7.9, roce: 76.2 },
  { id: '29', name: 'Bata India', symbol: 'BATAINDIA', sector: 'Consumer', cmp: 1567.40, change: -1.23, pe: 52.3, marketCap: 20232, divYield: 0.51, netProfit: 186, netProfitChange: 32.6, roce: 18.7 },
  { id: '30', name: 'Astral Ltd', symbol: 'ASTRAL', sector: 'Building Mat.', cmp: 2143.70, change: 1.67, pe: 78.2, marketCap: 57432, divYield: 0.14, netProfit: 521, netProfitChange: 15.8, roce: 25.3 },
]

const DEFAULT_ACTIVE_FILTERS: ActiveFilter[] = [
  { id: 'f1', label: 'Market Cap ≥ 500 Cr' },
  { id: 'f2', label: 'ROE > 15%' },
  { id: 'f3', label: 'D/E Ratio < 1' },
  { id: 'f4', label: 'Profit Growth 3Y > 10%' },
]

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
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(DEFAULT_ACTIVE_FILTERS)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['name', 'cmp', 'change', 'pe', 'marketCap', 'divYield', 'netProfit', 'roce'])
  )
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const [tempColumns, setTempColumns] = useState<Set<string>>(new Set(visibleColumns))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...MOCK_RESULTS]
    const activeIds = new Set(activeFilters.map((f) => f.id))

    if (activeIds.has('f1')) {
      list = list.filter((r) => r.marketCap >= 500)
    }
    if (activeIds.has('f2')) {
      list = list.filter((r) => r.roce > 15)
    }
    if (activeIds.has('f3')) {
      list = list.filter((r) => r.sector !== 'Banking' && r.sector !== 'NBFC')
    }
    if (activeIds.has('f4')) {
      list = list.filter((r) => r.netProfitChange > 10)
    }
    return list
  }, [activeFilters])

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const removeFilter = (id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id))
    setPage(1)
  }

  const clearFilters = () => {
    setActiveFilters([])
    setPage(1)
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

  // Summary stats
  const avgPE = useMemo(() => {
    const withPE = filtered.filter((r) => r.pe !== null)
    if (withPE.length === 0) return 0
    return withPE.reduce((s, r) => s + (r.pe ?? 0), 0) / withPE.length
  }, [filtered])
  const totalMktCap = useMemo(() => filtered.reduce((s, r) => s + r.marketCap, 0), [filtered])
  const medianROCE = useMemo(() => {
    if (filtered.length === 0) return 0
    const arr = [...filtered].map((r) => r.roce).sort((a, b) => a - b)
    return arr[Math.floor(arr.length / 2)]
  }, [filtered])

  const pageNums = useMemo(() => {
    const nums: number[] = []
    let start = Math.max(1, page - 2)
    let end = Math.min(totalPages, start + 4)
    start = Math.max(1, end - 4)
    for (let i = start; i <= end; i++) nums.push(i)
    return nums
  }, [page, totalPages])

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
        <MiniSummaryCard label="Matches" value={String(filtered.length)} sub="companies" color="blue" />
        <MiniSummaryCard label="Avg P/E Ratio" value={`${avgPE.toFixed(1)}x`} sub="industry avg 28.3x" color="gray" />
        <MiniSummaryCard label="Total Market Cap" value={formatCap(totalMktCap)} sub="combined" color="gray" />
        <MiniSummaryCard label="Median ROCE" value={`${medianROCE.toFixed(1)}%`} sub="annualized" color="purple" />
        <MiniSummaryCard label="Sector Lead" value="Tech (14%)" sub="2nd: Finance (12%)" color="indigo" />
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
              {pageData.map((row, idx, arr) => (
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
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[13px] font-medium text-textPrimary tabular-nums">
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
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[12px] text-textPrimary tabular-nums">
                      {row.pe !== null ? row.pe.toFixed(1) : <span className="text-textMuted">—</span>}
                    </td>
                  )}
                  {visibleColumns.has('marketCap') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[12px] text-textPrimary tabular-nums">
                      {formatCap(row.marketCap)}
                    </td>
                  )}
                  {visibleColumns.has('divYield') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[12px] text-textPrimary tabular-nums">
                      {row.divYield.toFixed(2)}%
                    </td>
                  )}
                  {visibleColumns.has('netProfit') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[12px] font-medium text-[var(--fs-positive)] tabular-nums">
                      {row.netProfit >= 0 ? '' : '−'}₹{Math.abs(row.netProfit).toLocaleString('en-IN')}
                    </td>
                  )}
                  {visibleColumns.has('roce') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-right font-mono text-[12px] font-medium text-[var(--fs-brand)] tabular-nums">
                      {row.roce.toFixed(1)}%
                    </td>
                  )}
                  {visibleColumns.has('sector') && (
                    <td style={{ padding: '11px 12px', verticalAlign: 'middle' }} className="text-left font-mono text-[12px] text-textSecondary">
                      {row.sector}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderTop: 'var(--fs-border)'
          }}
          className="select-none"
        >
          <span style={{ fontSize: 'var(--fs-size-body)' }} className="text-textMuted font-medium">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--fs-radius-sm)',
                border: 'var(--fs-border)',
                background: 'var(--fs-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1,
              }}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="hover:bg-surfaceMuted transition-colors"
            >
              <ChevronLeft className="size-4 text-textSecondary" />
            </button>
            {pageNums.map((n) => {
              const isActive = n === page
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--fs-radius-sm)',
                    border: isActive ? '1px solid var(--fs-brand)' : '0.5px solid var(--fs-border-color)',
                    background: isActive ? 'var(--fs-brand)' : 'var(--fs-surface)',
                    color: isActive ? 'var(--fs-surface)' : 'var(--fs-text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-size-body)',
                    fontWeight: isActive ? 600 : 500,
                  }}
                  className={isActive ? '' : 'hover:bg-surfaceMuted transition-colors'}
                >
                  {n}
                </button>
              )
            })}
            <button
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--fs-radius-sm)',
                border: 'var(--fs-border)',
                background: 'var(--fs-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1,
              }}
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="hover:bg-surfaceMuted transition-colors"
            >
              <ChevronRight className="size-4 text-textSecondary" />
            </button>
          </div>
        </div>
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
          fontSize: label === 'Total Market Cap' ? '15px' : '18px',
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
