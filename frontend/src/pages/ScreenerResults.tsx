import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Columns3, Download, TrendingUp, TrendingDown, X, Filter, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScreenerResultsTable } from '@/components/screener/results-table'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { useAppSelector } from '@/store/hooks'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

const SUMMARY_STATS = [
  { label: "Matches", value: "243 Companies", sub: null, positive: null },
  { label: "Avg P/E Ratio", value: "24.5x", sub: "-0.2 pts", positive: false },
  { label: "Total Market Cap", value: "₹24.1L Cr", sub: null, positive: null },
  { label: "Median ROCE", value: "18.4%", sub: "Top 5%", positive: true },
  { label: "Sector Lead", value: "Tech (14%)", sub: "2nd: Finance (12%)", positive: true },
]

const INITIAL_FILTERS = [
  { label: "Market Cap > 1,00,000 Cr" },
  { label: "ROCE > 15%" },
  { label: "PE Ratio < 60" },
]

export function ScreenerResults() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTERS)

  const removeFilter = (label: string) => {
    setActiveFilters((f) => f.filter((x) => x.label !== label))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
              <Link to="/" className="hover:text-accent transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">Screeners</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-accent font-semibold">High Growth Multi-Cap</span>
            </nav>
            <Heading level={1} variant="pageTitle">
              Screener Results: <span className="text-accent">High Growth Multi-Cap</span>
            </Heading>
            <Text variant="bodyMuted" className="mt-0.5">
              Showing <span className="font-bold text-accent">243 results</span> matching: P/E &lt; 15, ROE &gt; 20%
            </Text>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <Button variant="outline" size="sm" className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2">
              <Columns3 className="w-3.5 h-3.5" />
              Edit Columns
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2">
              <Download className="w-3.5 h-3.5" />
              Export to Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to create alerts.')
                  const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
                  navigate(`/login?redirect=${redirectPath}`)
                } else {
                  toast.success('✓ Alert dialog opened (mock)')
                }
              }}
              className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2"
            >
              <Bell className="w-3.5 h-3.5" />
              Create Alert
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-white h-9 text-xs font-bold shadow-none">
              <Link to="/screener">Edit Screen</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── Summary Metrics Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {SUMMARY_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface border border-border rounded-xl px-4 py-4 shadow-[var(--shadow-sm)]"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-textMuted mb-1">{stat.label}</p>
              <p className="text-xl font-black font-mono tabular-nums text-textPrimary">{stat.value}</p>
              {stat.sub && (
                <div className="flex items-center gap-1 mt-1">
                  {stat.positive ? (
                    <TrendingUp className="size-2.5 text-positive" />
                  ) : (
                    <TrendingDown className="size-2.5 text-negative" />
                  )}
                  <span className={cn("text-[10px] font-semibold font-mono", stat.positive ? "text-positive" : "text-negative")}>
                    {stat.sub}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Filter Sidebar + Table Grid ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
          {/* Left Filter Sidebar */}
          <Card className="border-border shadow-[var(--shadow-sm)] bg-surface p-4 space-y-5 sticky top-24">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-xs font-bold uppercase tracking-wider text-textPrimary flex items-center gap-1.5">
                <Filter className="size-3.5 text-accent" /> Filter Criteria
              </span>
              <span className="text-[9px] font-bold text-accent bg-accentSoft px-1.5 py-0.5 rounded-full uppercase">Live</span>
            </div>

            {/* Valuation Dropdown/Sliders Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Valuation</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-textSecondary">
                    <span>P/E Ratio</span>
                    <span className="font-mono text-accent">&lt; 35.0x</span>
                  </div>
                  <input type="range" min="5" max="100" defaultValue="35" className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-textSecondary">
                    <span>P/B Ratio</span>
                    <span className="font-mono text-accent">&lt; 6.0x</span>
                  </div>
                  <input type="range" min="1" max="25" defaultValue="6" className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent" />
                </div>
              </div>
            </div>

            {/* Profitability Dropdown/Sliders Section */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Profitability</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-textSecondary">
                    <span>Return on Equity (ROE)</span>
                    <span className="font-mono text-accent">&gt; 20.0%</span>
                  </div>
                  <input type="range" min="0" max="50" defaultValue="20" className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-textSecondary">
                    <span>Return on Capital (ROCE)</span>
                    <span className="font-mono text-accent">&gt; 15.0%</span>
                  </div>
                  <input type="range" min="0" max="50" defaultValue="15" className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent" />
                </div>
              </div>
            </div>

            {/* Dividend Yield Dropdown/Sliders Section */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Dividend & Yield</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-textSecondary">
                    <span>Dividend Yield</span>
                    <span className="font-mono text-accent">&gt; 1.5%</span>
                  </div>
                  <input type="range" min="0" max="10" step="0.1" defaultValue="1.5" className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent" />
                </div>
              </div>
            </div>

            <Button className="w-full bg-accent hover:bg-accent/90 text-white font-bold text-[10px] uppercase tracking-wider h-8 shadow-none mt-2">
              Apply Filters
            </Button>
          </Card>

          {/* Right Stock Results table */}
          <div className="space-y-5">
            <ScreenerResultsTable />

            {/* ── Active Filters bar ────────────────────────────────────── */}
            {activeFilters.length > 0 && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-[var(--shadow-sm)]">
                <span className="text-[11px] font-bold text-textMuted uppercase tracking-wider shrink-0">Active Filters:</span>
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {activeFilters.map((f) => (
                    <span
                      key={f.label}
                      className="inline-flex items-center gap-1.5 bg-accentSoft border border-accent/20 text-accent rounded-full px-3 py-1 text-[11px] font-semibold"
                    >
                      {f.label}
                      <button
                        onClick={() => removeFilter(f.label)}
                        className="ml-0.5 hover:text-accent/60 transition-colors"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                {activeFilters.length > 0 && (
                  <button
                    onClick={() => setActiveFilters([])}
                    className="text-[11px] font-bold text-negative hover:text-negative/80 transition-colors shrink-0 ml-auto"
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenerResults
