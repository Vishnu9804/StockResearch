import { useState, useEffect, useRef, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, History, BarChart2, RefreshCw, AlertCircle, Inbox, ChevronRight } from 'lucide-react'
import { finscreenClient } from '@/services/finscreenApi'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BeneficialOwnerItem {
  registeredOwnerName?: string
  significantOwnersName?: string
  registeredOwnerNationality?: string
  registeredOwnerPAN?: string
  sBODateOfAcquisition?: string
  sBOExerciseByShares?: boolean
  sBOExerciseByControl?: boolean
  sBOExerciseByInfluence?: boolean
}

interface DeclarationItem {
  header?: string
  equitySharesWithDifferentialVotingRights?: boolean
  issuedConvertibleSecurities?: boolean
  differentialVotingRightsPromoter?: boolean
  differentialVotingRightsNonPublic?: boolean
  differentialVotingRightsPublic?: boolean
}

interface QuarterlyHolder {
  name: string
  pctByQuarter: Record<string, number>
}
interface QuarterlyCategory {
  totals: Record<string, number>
  holders: QuarterlyHolder[]
}
interface QuarterlyBreakdown {
  symbol: string
  quarters: string[]
  categories: Record<'promoter' | 'fii' | 'dii' | 'government' | 'public', QuarterlyCategory>
}

const TABS = [
  { id: 'beneficial', label: 'Beneficial Owners', icon: Users },
  { id: 'declaration', label: 'Declarations', icon: FileText },
  { id: 'current', label: 'Current Holdings', icon: BarChart2 },
  { id: 'history', label: 'Flow History', icon: History },
] as const

type TabId = typeof TABS[number]['id']

const PAGE_SIZE = 10

const CATEGORY_ORDER: (keyof QuarterlyBreakdown['categories'])[] = ['promoter', 'fii', 'dii', 'government', 'public']
const CATEGORY_LABEL: Record<keyof QuarterlyBreakdown['categories'], string> = {
  promoter: 'Promoters', fii: 'FIIs', dii: 'DIIs', government: 'Government', public: 'Public',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (n == null) return '—'
  return n.toLocaleString('en-IN')
}
function pct(n?: number) {
  if (n == null) return '—'
  // FinEdge reports these as a fraction (e.g. 0.1112 === 11.12%), not a percentage.
  return `${(n * 100).toFixed(2)}%`
}
function bool(v?: boolean) {
  return v ? <span className="text-positive font-semibold">Yes</span> : <span className="text-textMuted">No</span>
}

function Empty({ label = 'No records found for this section.' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-textMuted gap-2">
      <Inbox className="size-8 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  )
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-4 text-xs text-textSecondary">
      <span>Page {current} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)}
          disabled={current === 1}
          className="px-2.5 py-1.5 rounded-lg border border-border/40 hover:bg-surfaceMuted/50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-medium cursor-pointer"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(current + 1)}
          disabled={current === total}
          className="px-2.5 py-1.5 rounded-lg border border-border/40 hover:bg-surfaceMuted/50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-medium cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Sub-renderers ──────────────────────────────────────────────────────────────

function BeneficialOwnersTab({ owners, page, setPage }: { owners: BeneficialOwnerItem[]; page: number; setPage: (p: number) => void }) {
  if (!owners.length) return <Empty />

  const totalPages = Math.ceil(owners.length / PAGE_SIZE)
  const pagedOwners = owners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-2">
      {pagedOwners.map((o, i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-border/30 rounded-xl bg-surfaceMuted/10 gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-textPrimary">
              {o.registeredOwnerName || o.significantOwnersName || 'Owner'}
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-textMuted">
              {o.registeredOwnerNationality && <span>🌐 {o.registeredOwnerNationality}</span>}
              {o.sBODateOfAcquisition && <span>📅 Acquired: {o.sBODateOfAcquisition}</span>}
            </div>
            <div className="flex gap-3 text-[10px] text-textSecondary mt-0.5 flex-wrap">
              <span>Via Shares: {bool(o.sBOExerciseByShares)}</span>
              <span>Via Control: {bool(o.sBOExerciseByControl)}</span>
              <span>Via Influence: {bool(o.sBOExerciseByInfluence)}</span>
            </div>
          </div>
        </div>
      ))}
      <Pagination current={page} total={totalPages} onChange={setPage} />
    </div>
  )
}

function DeclarationTab({ item }: { item: DeclarationItem | null }) {
  if (!item) return <Empty label="No declaration filed for this quarter." />

  return (
    <div className="p-4 border border-border/30 rounded-xl bg-surfaceMuted/10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs">
        <div className="flex justify-between items-center py-1 border-b border-border/20">
          <span className="text-textMuted">Differential Voting Rights</span>
          {bool(item.equitySharesWithDifferentialVotingRights)}
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border/20">
          <span className="text-textMuted">Convertible Securities Issued</span>
          {bool(item.issuedConvertibleSecurities)}
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border/20">
          <span className="text-textMuted">DVR — Promoter</span>
          {bool(item.differentialVotingRightsPromoter)}
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border/20">
          <span className="text-textMuted">DVR — Non-Public</span>
          {bool(item.differentialVotingRightsNonPublic)}
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border/20">
          <span className="text-textMuted">DVR — Public</span>
          {bool(item.differentialVotingRightsPublic)}
        </div>
      </div>
    </div>
  )
}

// Quarter-wise category breakdown — Promoters/FIIs/DIIs/Government/Public totals
// per quarter, each expandable to its notable named holders' per-quarter %.
function QuarterlyBreakdownTable({ data }: { data: QuarterlyBreakdown | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (!data || data.quarters.length === 0) return <Empty label="No shareholding history available." />

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left font-medium text-textMuted uppercase tracking-wider pb-2 pr-4 sticky left-0 bg-surface min-w-55">
              Holders
            </th>
            {data.quarters.map((q) => (
              <th key={q} className="text-right font-medium text-textMuted uppercase tracking-wider pb-2 px-3 whitespace-nowrap">
                {q}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((cat) => {
            const category = data.categories[cat]
            if (!category) return null
            const isOpen = expanded.has(cat)
            const hasHolders = category.holders.length > 0
            return (
              <Fragment key={cat}>
                <tr
                  onClick={() => hasHolders && toggle(cat)}
                  className={cn(
                    "border-b border-border/20 transition-colors",
                    hasHolders ? "cursor-pointer hover:bg-surfaceMuted/40" : "",
                  )}
                >
                  <td className="py-2 pr-4 font-semibold text-textPrimary sticky left-0 bg-surface">
                    <span className="inline-flex items-center gap-1.5">
                      {hasHolders && (
                        <ChevronRight className={cn("size-3.5 text-textMuted transition-transform shrink-0", isOpen && "rotate-90")} />
                      )}
                      {CATEGORY_LABEL[cat]}
                    </span>
                  </td>
                  {data.quarters.map((q) => (
                    <td key={q} className="text-right py-2 px-3 font-mono font-semibold tabular-nums text-textPrimary whitespace-nowrap">
                      {category.totals[q] != null ? `${category.totals[q].toFixed(2)}%` : '—'}
                    </td>
                  ))}
                </tr>
                {isOpen && category.holders.map((h) => (
                  <tr key={h.name} className="border-b border-border/10 hover:bg-surfaceMuted/20 transition-colors">
                    <td className="py-1.5 pr-4 pl-6 text-textSecondary truncate max-w-55 sticky left-0 bg-surface" title={h.name}>
                      {h.name}
                    </td>
                    {data.quarters.map((q) => (
                      <td key={q} className="text-right py-1.5 px-3 font-mono tabular-nums text-textMuted whitespace-nowrap">
                        {h.pctByQuarter[q] != null ? `${h.pctByQuarter[q].toFixed(2)}%` : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-textMuted mt-3 leading-relaxed">
        Sub-rows show named significant shareholders who held at least 0.5% in one or more of the quarters shown — not exhaustive; pooled/omnibus and retail holdings aren't individually disclosed.
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ShareholdingSubsections({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useState<TabId>('beneficial')
  const [data, setData] = useState<any>(null)
  // Which tab `data` was fetched for — each tab's response has a different shape
  // (e.g. { declaration: [...] } vs { quarters: [...], categories: {...} }).
  // activeTab updates on click, but data/loading only update once the effect it
  // triggers actually runs — for one render in between, `loading` can still be
  // false and `data` can still hold the *previous* tab's (differently-shaped)
  // payload. Gating on dataTab, not just loading, stops that stale-shaped data
  // from ever reaching a renderer built for a different tab and crashing.
  const [dataTab, setDataTab] = useState<TabId | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter & Pagination state. selectedPeriod stays null until the user
  // explicitly picks a quarter — until then the latest quarter is shown.
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Guards against a slower, stale request (e.g. the heavier Beneficial Owners
  // call) resolving after a faster one and clobbering state for a tab the user
  // has since switched away from — was causing Declarations to appear empty.
  const requestIdRef = useRef(0)

  const load = async (tab: TabId = activeTab) => {
    if (!symbol || symbol === 'STOCK') return
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedPeriod(null)
    setPage(1)
    try {
      const endpoint =
        tab === 'beneficial'   ? `/company/${symbol}/shareholding/beneficial-owners` :
        tab === 'declaration'  ? `/company/${symbol}/shareholding/declaration` :
                                 `/company/${symbol}/shareholding/quarterly-breakdown` // 'current' + 'history'

      const res = await finscreenClient.get(endpoint)
      if (requestIdRef.current !== requestId) return // a newer request has since started — drop this one
      setData(res.data)
      setDataTab(tab)
    } catch (err: any) {
      if (requestIdRef.current !== requestId) return
      console.error('[ShareholdingSubsections] error:', err?.response?.data || err?.message)
      if (err.response?.status === 404) {
        setData(null)
      } else {
        const status = err.response?.status
        setError(
          status === 429 ? 'Rate limited. Please try again shortly.' :
          status === 403 ? 'This data requires a higher plan.' :
          'Failed to load ownership data. Please retry.'
        )
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false)
    }
  }

  useEffect(() => {
    load(activeTab)
  }, [symbol, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extract all periods for current active tab (only beneficial/declaration use
  // the quarter dropdown — current/history render every quarter side by side).
  const periods: string[] = (() => {
    if (!data) return []
    if (activeTab === 'beneficial' && Array.isArray(data.beneficial_owners)) {
      return data.beneficial_owners.map((g: any) => g.header).filter(Boolean)
    }
    if (activeTab === 'declaration' && Array.isArray(data.declaration)) {
      return data.declaration.map((i: any) => i.header).filter(Boolean)
    }
    return []
  })()
  const latestPeriod = periods[0] ?? ''
  const effectivePeriod = selectedPeriod ?? latestPeriod

  const renderContent = () => {
    if (loading || dataTab !== activeTab) {
      return (
        <div className="space-y-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-surfaceMuted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-negative/30 bg-negative-soft/20 text-negative">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 text-xs font-semibold border border-negative/30 px-3 py-1.5 rounded-lg hover:bg-negative/10 transition-colors"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </div>
      )
    }
    if (!data) return <Empty />

    switch (activeTab) {
      case 'beneficial': {
        const group = data.beneficial_owners?.find((g: any) => g.header === effectivePeriod) || data.beneficial_owners?.[0]
        return <BeneficialOwnersTab owners={group?.beneficial_owners || []} page={page} setPage={setPage} />
      }
      case 'declaration': {
        const item = data.declaration?.find((i: any) => i.header === effectivePeriod) || data.declaration?.[0] || null
        return <DeclarationTab item={item} />
      }
      case 'current':
      case 'history': {
        return <QuarterlyBreakdownTable data={data as QuarterlyBreakdown} />
      }
    }
  }

  return (
    <Card className="border-border/40 shadow-xs rounded-2xl overflow-hidden bg-surface">
      <CardHeader className="pb-0 px-5 pt-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-sm font-semibold text-textPrimary flex items-center gap-2">
            <Users className="size-4 text-accent" />
            Institutional Micro-Details
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Dropdown Filter — only for Beneficial Owners / Declarations */}
            {!loading && periods.length > 0 && (activeTab === 'beneficial' || activeTab === 'declaration') && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider hidden sm:inline">Quarter:</span>
                <select
                  value={selectedPeriod ?? ''}
                  onChange={(e) => {
                    setSelectedPeriod(e.target.value || null)
                    setPage(1)
                  }}
                  className="bg-surfaceMuted/60 text-xs font-semibold text-textPrimary px-2.5 py-1.5 rounded-lg border border-border/30 outline-none cursor-pointer focus:border-accent/40 focus:ring-1 focus:ring-accent/15"
                >
                  <option value="">Latest ({latestPeriod})</option>
                  {periods.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-0.5 bg-surfaceMuted/50 rounded-lg p-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-surface text-accent shadow-xs'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    <Icon className="size-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5">
        {renderContent()}
      </CardContent>
    </Card>
  )
}
