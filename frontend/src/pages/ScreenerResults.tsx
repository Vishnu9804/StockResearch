import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Bell, Columns3, Download, ChevronDown, SlidersHorizontal, Edit3 } from 'lucide-react'
import { ScreenerResultsTable } from '@/components/screener/results-table'
import { useAppSelector } from '@/store/hooks'
import { toast } from 'react-hot-toast'

const SLIDER_CONFIG = {
  pe: { min: 5, max: 55, init: 35.8, step: 0.1, label: 'P/E Ratio', display: (v: number) => `< ${v.toFixed(1)}x`, color: 'brand' },
  pb: { min: 1, max: 12, init: 6.0, step: 0.1, label: 'P/B Ratio', display: (v: number) => `< ${v.toFixed(1)}x`, color: 'brand' },
  roe: { min: 0, max: 50, init: 20.0, step: 0.1, label: 'Return on Equity (ROE)', display: (v: number) => `> ${v.toFixed(1)}%`, color: 'positive' },
  roce: { min: 0, max: 50, init: 15.0, step: 0.1, label: 'Return on Capital (ROCE)', display: (v: number) => `> ${v.toFixed(1)}%`, color: 'positive' },
  divYield: { min: 0, max: 6, init: 1.5, step: 0.1, label: 'Dividend Yield', display: (v: number) => `> ${v.toFixed(1)}%`, color: 'brand' },
}

export function ScreenerResults() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [peLimit, setPeLimit] = useState(SLIDER_CONFIG.pe.init)
  const [pbLimit, setPbLimit] = useState(SLIDER_CONFIG.pb.init)
  const [roeLimit, setRoeLimit] = useState(SLIDER_CONFIG.roe.init)
  const [roceLimit, setRoceLimit] = useState(SLIDER_CONFIG.roce.init)
  const [divYieldLimit, setDivYieldLimit] = useState(SLIDER_CONFIG.divYield.init)

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      {/* ── Page Header Section ── */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="max-w-[1400px] mx-auto w-full">
          {/* Breadcrumb row */}
          <div className="text-xs text-textMuted mb-1 flex items-center gap-1 select-none">
            <Link to="/" className="hover:underline">Home</Link>
            <span className="text-textMuted/60 font-normal">›</span>
            <Link to="/screener" className="hover:underline">Screeners</Link>
            <span className="text-textMuted/60 font-normal">›</span>
            <span className="text-accent font-medium">High Growth Multi-Cap</span>
          </div>

          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }} className="w-full flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-textPrimary tracking-tight">
                Screener Results: <span className="text-accent">High Growth Multi-Cap</span>
              </h1>
              <p className="text-body font-normal text-textSecondary mt-1">
                Showing <span className="text-accent font-medium">243 results</span> matching: P/E &lt; 15, ROE &gt; 20%
              </p>
            </div>

            {/* Header Buttons */}
            <div style={{ display: 'flex', gap: '7px' }} className="flex-wrap items-center">
              <button
                style={{
                  padding: 'var(--fs-space-xs) var(--fs-space-md)',
                  border: 'var(--fs-border)',
                  borderRadius: 'var(--fs-radius-sm)',
                  background: 'var(--fs-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onClick={() => toast.success('Columns editing dialog opened')}
                className="text-textSecondary hover:bg-surfaceMuted transition-colors text-sm font-medium"
              >
                <Columns3 className="size-4 text-textSecondary" />
                Edit Columns
              </button>
              <button
                style={{
                  padding: 'var(--fs-space-xs) var(--fs-space-md)',
                  border: 'var(--fs-border)',
                  borderRadius: 'var(--fs-radius-sm)',
                  background: 'var(--fs-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onClick={() => toast.success('✓ Exported to Excel')}
                className="text-textSecondary hover:bg-surfaceMuted transition-colors text-sm font-medium"
              >
                <Download className="size-4 text-textSecondary" />
                Export to Excel
              </button>
              <button
                style={{
                  padding: 'var(--fs-space-xs) var(--fs-space-md)',
                  border: 'var(--fs-border)',
                  borderRadius: 'var(--fs-radius-sm)',
                  background: 'var(--fs-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.error('Please sign in to create alerts.')
                    const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
                    navigate(`/login?redirect=${redirectPath}`)
                  } else {
                    toast.success('✓ Alert dialog opened (mock)')
                  }
                }}
                className="text-textSecondary hover:bg-surfaceMuted transition-colors text-sm font-medium"
              >
                <Bell className="size-4 text-textSecondary" />
                Create Alert
              </button>
              <Link
                to="/screener"
                style={{
                  background: 'var(--fs-brand)',
                  color: 'var(--fs-surface)',
                  border: 'none',
                  borderRadius: 'var(--fs-radius-sm)',
                  padding: '7px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--fs-space-xs)',
                }}
                className="hover:bg-[var(--fs-brand)]/90 transition-colors shadow-sm select-none text-sm font-medium"
              >
                <Edit3 className="size-3.5" />
                Edit Screen
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* ── TWO COLUMN MAIN LAYOUT ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '14px', alignItems: 'start' }} className="w-full">
          {/* Left Column: Filter Panel */}
          <div
            style={{
              background: 'var(--fs-surface)',
              border: 'var(--fs-border)',
              borderRadius: 'var(--fs-radius-md)',
              padding: '16px',
              position: 'sticky',
              top: '90px',
            }}
            className="flex flex-col select-none shadow-sm"
          >
            {/* Panel Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: 'var(--fs-size-sm)', letterSpacing: '0.06em', fontWeight: 'var(--fs-weight-medium)' }} className="text-textSecondary uppercase flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-[var(--fs-brand)]" /> FILTER CRITERIA
              </span>
              <span
                style={{
                  background: 'var(--fs-positive-soft)',
                  color: '#27500A',
                  fontSize: 'var(--fs-size-xs)',
                  fontWeight: 'var(--fs-weight-medium)',
                  padding: '2px 8px',
                  borderRadius: 'var(--fs-radius-xl)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--fs-positive)' }} />
                Live
              </span>
            </div>

            {/* Section 1: Valuation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-textMuted uppercase tracking-wider">Valuation</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3.5 pl-1">
                {/* PE Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-textPrimary font-medium">P/E Ratio</span>
                    <span className="font-mono font-medium text-[var(--fs-brand)]">&lt; {peLimit.toFixed(1)}x</span>
                  </div>
                  <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }} className="w-full">
                    <div style={{ height: '4px', background: 'var(--fs-info-soft)', borderRadius: '2px', position: 'relative', width: '100%' }}>
                      <div style={{ background: 'var(--fs-brand)', height: '4px', borderRadius: '2px', position: 'absolute', left: 0, width: `${(peLimit / 55) * 100}%` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--fs-brand)', border: '2px solid white', boxShadow: '0 0 0 1px var(--fs-brand)', position: 'absolute', top: '-5px', left: `calc(${(peLimit / 55) * 100}% - 7px)`, cursor: 'pointer', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="55"
                      step="0.1"
                      value={peLimit}
                      onChange={(e) => setPeLimit(parseFloat(e.target.value))}
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* PB Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-textPrimary font-medium">P/B Ratio</span>
                    <span className="font-mono font-medium text-[var(--fs-brand)]">&lt; {pbLimit.toFixed(1)}x</span>
                  </div>
                  <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }} className="w-full">
                    <div style={{ height: '4px', background: 'var(--fs-info-soft)', borderRadius: '2px', position: 'relative', width: '100%' }}>
                      <div style={{ background: 'var(--fs-brand)', height: '4px', borderRadius: '2px', position: 'absolute', left: 0, width: `${(pbLimit / 12) * 100}%` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--fs-brand)', border: '2px solid white', boxShadow: '0 0 0 1px var(--fs-brand)', position: 'absolute', top: '-5px', left: `calc(${(pbLimit / 12) * 100}% - 7px)`, cursor: 'pointer', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="0.1"
                      value={pbLimit}
                      onChange={(e) => setPbLimit(parseFloat(e.target.value))}
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: 'var(--fs-border)', margin: '12px 0' }} />

            {/* Section 2: Profitability */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-textMuted uppercase tracking-wider">Profitability</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3.5 pl-1">
                {/* ROE Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-textPrimary font-medium">Return on Equity (ROE)</span>
                    <span className="font-mono font-medium text-[var(--fs-positive)]">&gt; {roeLimit.toFixed(1)}%</span>
                  </div>
                  <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }} className="w-full">
                    <div style={{ height: '4px', background: 'var(--fs-info-soft)', borderRadius: '2px', position: 'relative', width: '100%' }}>
                      <div style={{ background: 'var(--fs-brand)', height: '4px', borderRadius: '2px', position: 'absolute', left: 0, width: `${(roeLimit / 50) * 100}%` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--fs-brand)', border: '2px solid white', boxShadow: '0 0 0 1px var(--fs-brand)', position: 'absolute', top: '-5px', left: `calc(${(roeLimit / 50) * 100}% - 7px)`, cursor: 'pointer', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.1"
                      value={roeLimit}
                      onChange={(e) => setRoeLimit(parseFloat(e.target.value))}
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* ROCE Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-textPrimary font-medium">Return on Capital (ROCE)</span>
                    <span className="font-mono font-medium text-[var(--fs-positive)]">&gt; {roceLimit.toFixed(1)}%</span>
                  </div>
                  <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }} className="w-full">
                    <div style={{ height: '4px', background: 'var(--fs-info-soft)', borderRadius: '2px', position: 'relative', width: '100%' }}>
                      <div style={{ background: 'var(--fs-brand)', height: '4px', borderRadius: '2px', position: 'absolute', left: 0, width: `${(roceLimit / 50) * 100}%` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--fs-brand)', border: '2px solid white', boxShadow: '0 0 0 1px var(--fs-brand)', position: 'absolute', top: '-5px', left: `calc(${(roceLimit / 50) * 100}% - 7px)`, cursor: 'pointer', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.1"
                      value={roceLimit}
                      onChange={(e) => setRoceLimit(parseFloat(e.target.value))}
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: 'var(--fs-border)', margin: '12px 0' }} />

            {/* Section 3: Dividend & Yield */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-textMuted uppercase tracking-wider">Dividend & Yield</span>
                <ChevronDown className="size-3 text-textMuted" />
              </div>
              <div className="space-y-3.5 pl-1">
                {/* Dividend Yield Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-textPrimary font-medium">Dividend Yield</span>
                    <span className="font-mono font-medium text-[var(--fs-brand)]">&gt; {divYieldLimit.toFixed(1)}%</span>
                  </div>
                  <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }} className="w-full">
                    <div style={{ height: '4px', background: 'var(--fs-info-soft)', borderRadius: '2px', position: 'relative', width: '100%' }}>
                      <div style={{ background: 'var(--fs-brand)', height: '4px', borderRadius: '2px', position: 'absolute', left: 0, width: `${(divYieldLimit / 6) * 100}%` }} />
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--fs-brand)', border: '2px solid white', boxShadow: '0 0 0 1px var(--fs-brand)', position: 'absolute', top: '-5px', left: `calc(${(divYieldLimit / 6) * 100}% - 7px)`, cursor: 'pointer', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.1"
                      value={divYieldLimit}
                      onChange={(e) => setDivYieldLimit(parseFloat(e.target.value))}
                      style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => toast.success('Filters applied successfully!')}
              style={{
                width: '100%',
                padding: '9px',
                background: 'var(--fs-brand)',
                color: 'var(--fs-surface)',
                border: 'none',
                borderRadius: 'var(--fs-radius-sm)',
                fontSize: 'var(--fs-size-body)',
                fontWeight: 'var(--fs-weight-medium)',
                cursor: 'pointer',
                letterSpacing: '0.03em',
                marginTop: '16px',
              }}
              className="hover:bg-[var(--fs-brand)]/90 transition-colors"
            >
              Apply Filters
            </button>
          </div>

          {/* Right Column: Stat Cards + Filter Chips + Results Table */}
          <div>
            <ScreenerResultsTable />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenerResults
