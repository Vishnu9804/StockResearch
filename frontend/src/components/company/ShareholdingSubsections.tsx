import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, History, BarChart2, RefreshCw, AlertCircle, Inbox } from 'lucide-react'
import { finscreenClient } from '@/services/finscreenApi'

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

interface OwnershipItem {
  shareholder_name?: string
  shareholdingPct?: number
  dematEquityShares?: number
  pledgedShares?: number
  pledgedSharesPct?: number
  lockedInShares?: number
  lockedInSharesPct?: number
  paidUpEquityShares?: number
  subCategory1?: string
}

interface DeclarationItem {
  header?: string
  equitySharesWithDifferentialVotingRights?: boolean
  issuedConvertibleSecurities?: boolean
  differentialVotingRightsPromoter?: boolean
  differentialVotingRightsNonPublic?: boolean
  differentialVotingRightsPublic?: boolean
}

interface HistoryGroup {
  header?: string
  data?: OwnershipItem[]
}

const TABS = [
  { id: 'beneficial', label: 'Beneficial Owners', icon: Users },
  { id: 'declaration', label: 'Declarations', icon: FileText },
  { id: 'current', label: 'Current Holdings', icon: BarChart2 },
  { id: 'history', label: 'Flow History', icon: History },
] as const

type TabId = typeof TABS[number]['id']

const PAGE_SIZE = 10

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (n == null) return '—'
  return n.toLocaleString('en-IN')
}
function pct(n?: number) {
  if (n == null) return '—'
  return `${n.toFixed(4)}%`
}
function bool(v?: boolean) {
  return v ? <span className="text-positive font-semibold">Yes</span> : <span className="text-textMuted">No</span>
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-textMuted gap-2">
      <Inbox className="size-8 opacity-40" />
      <p className="text-xs">No records found for this section.</p>
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
  if (!item) return <Empty />

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

function CurrentHoldingsTab({ items, page, setPage }: { items: OwnershipItem[]; page: number; setPage: (p: number) => void }) {
  if (!items.length) return <Empty />

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-2">
      {pagedItems.map((o, i) => (
        <div key={i} className="p-3 border border-border/30 rounded-xl bg-surfaceMuted/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-textPrimary truncate max-w-[60%]">
              {o.shareholder_name || o.subCategory1 || `Holder ${i + 1}`}
            </p>
            <Badge variant="outline" className="text-xs font-bold text-accent bg-accentSoft border-accent/20">
              {pct(o.shareholdingPct)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[10px] text-textMuted pt-1.5 border-t border-border/10">
            <span>Demat: <span className="text-textSecondary font-mono">{fmt(o.dematEquityShares)}</span></span>
            <span>Paid-up: <span className="text-textSecondary font-mono">{fmt(o.paidUpEquityShares)}</span></span>
            <span>Pledged: <span className="text-textSecondary font-mono">{fmt(o.pledgedShares)} ({pct(o.pledgedSharesPct)})</span></span>
            <span>Locked: <span className="text-textSecondary font-mono">{fmt(o.lockedInShares)} ({pct(o.lockedInSharesPct)})</span></span>
          </div>
        </div>
      ))}
      <Pagination current={page} total={totalPages} onChange={setPage} />
    </div>
  )
}

function FlowHistoryTab({ items, page, setPage }: { items: OwnershipItem[]; page: number; setPage: (p: number) => void }) {
  if (!items.length) return <Empty />

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-2">
      {pagedItems.map((o, i) => (
        <div key={i} className="flex items-center justify-between p-3 border border-border/30 rounded-xl bg-surfaceMuted/10 gap-4">
          <span className="text-xs text-textPrimary truncate max-w-[55%] font-medium">
            {o.shareholder_name || o.subCategory1 || `Holder ${i + 1}`}
          </span>
          <div className="flex items-center gap-3 text-[10px] text-textMuted shrink-0">
            <span>Demat: <span className="text-textSecondary font-mono">{fmt(o.dematEquityShares)}</span></span>
            <Badge variant="outline" className="text-[10px] font-bold text-accent bg-accentSoft border-accent/20 px-1.5">
              {pct(o.shareholdingPct)}
            </Badge>
          </div>
        </div>
      ))}
      <Pagination current={page} total={totalPages} onChange={setPage} />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ShareholdingSubsections({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useState<TabId>('beneficial')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter & Pagination state
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [page, setPage] = useState(1)

  const load = async (tab: TabId = activeTab) => {
    if (!symbol || symbol === 'STOCK') return
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedPeriod('')
    setPage(1)
    try {
      const endpoint =
        tab === 'beneficial'   ? `/company/${symbol}/shareholding/beneficial-owners` :
        tab === 'declaration'  ? `/company/${symbol}/shareholding/declaration` :
        tab === 'current'      ? `/company/${symbol}/shareholding/ownership-current` :
                                 `/company/${symbol}/shareholding/ownership-history`

      const res = await finscreenClient.get(endpoint)
      setData(res.data)

      // Set initial selected period based on loaded tab data
      const loaded = res.data
      if (tab === 'beneficial' && Array.isArray(loaded?.beneficial_owners)) {
        const first = loaded.beneficial_owners.map((g: any) => g.header).filter(Boolean)[0]
        if (first) setSelectedPeriod(first)
      } else if (tab === 'declaration' && Array.isArray(loaded?.declaration)) {
        const first = loaded.declaration.map((i: any) => i.header).filter(Boolean)[0]
        if (first) setSelectedPeriod(first)
      } else if (tab === 'history' && Array.isArray(loaded?.ownership_history)) {
        const first = loaded.ownership_history.map((g: any) => g.header).filter(Boolean)[0]
        if (first) setSelectedPeriod(first)
      }
    } catch (err: any) {
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
      setLoading(false)
    }
  }

  useEffect(() => {
    load(activeTab)
  }, [symbol, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extract all periods for current active tab
  const periods: string[] = (() => {
    if (!data) return []
    if (activeTab === 'beneficial' && Array.isArray(data.beneficial_owners)) {
      return data.beneficial_owners.map((g: any) => g.header).filter(Boolean)
    }
    if (activeTab === 'declaration' && Array.isArray(data.declaration)) {
      return data.declaration.map((i: any) => i.header).filter(Boolean)
    }
    if (activeTab === 'history' && Array.isArray(data.ownership_history)) {
      return data.ownership_history.map((g: any) => g.header).filter(Boolean)
    }
    return []
  })()

  const renderContent = () => {
    if (loading) {
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
        const group = data.beneficial_owners?.find((g: any) => g.header === selectedPeriod) || data.beneficial_owners?.[0]
        return <BeneficialOwnersTab owners={group?.beneficial_owners || []} page={page} setPage={setPage} />
      }
      case 'declaration': {
        const item = data.declaration?.find((i: any) => i.header === selectedPeriod) || data.declaration?.[0] || null
        return <DeclarationTab item={item} />
      }
      case 'current': {
        return <CurrentHoldingsTab items={data.ownerships || []} page={page} setPage={setPage} />
      }
      case 'history': {
        const group = data.ownership_history?.find((g: any) => g.header === selectedPeriod) || data.ownership_history?.[0]
        return <FlowHistoryTab items={group?.data || []} page={page} setPage={setPage} />
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
            {activeTab === 'current' && data?.quarter && (
              <span className="text-xs font-normal text-textMuted font-mono">({data.quarter})</span>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Dropdown Filter */}
            {!loading && periods.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider hidden sm:inline">Quarter:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => {
                    setSelectedPeriod(e.target.value)
                    setPage(1)
                  }}
                  className="bg-surfaceMuted/60 text-xs font-semibold text-textPrimary px-2.5 py-1.5 rounded-lg border border-border/30 outline-none cursor-pointer focus:border-accent/40 focus:ring-1 focus:ring-accent/15"
                >
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
