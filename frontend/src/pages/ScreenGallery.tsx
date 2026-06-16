import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  ArrowRight,
  Search,
  Plus,
  Flame,
  SlidersHorizontal,
  BarChart2,
  TrendingUp,
  Rocket,
  Activity,
  Star,
  Scale,
  Users,
  LayoutGrid
} from 'lucide-react'
import { SCREENER_TEMPLATES, type ScreenerTemplate } from '@/lib/data/screener'
import { cn } from '@/lib/utils'

const CATEGORIES = ['All', 'Valuation', 'Profitability', 'Growth', 'Technical', 'Dividends', 'Debt & Liquidity', 'Shareholding'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_ICONS: Record<Category, React.ElementType> = {
  All: SlidersHorizontal,
  Valuation: BarChart2,
  Profitability: TrendingUp,
  Growth: Rocket,
  Technical: Activity,
  Dividends: Star,
  'Debt & Liquidity': Scale,
  Shareholding: Users,
}

const CATEGORY_COLOR_TINTS: Record<string, { bg: string; text: string }> = {
  'Debt & Liquidity': { bg: 'var(--fs-info-soft)', text: 'var(--fs-info)' },
  'Dividends': { bg: 'var(--fs-positive-soft)', text: '#27500A' },
  'Technical': { bg: '#EEEDFE', text: '#3C3489' },
  'Valuation': { bg: '#E1F5EE', text: '#085041' },
  'Management Quality': { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Shareholding': { bg: '#FBEAF0', text: '#72243E' },
  'Growth': { bg: 'var(--fs-negative-soft)', text: '#791F1F' },
  'Profitability': { bg: '#F1EFE8', text: '#444441' },
}

function FeaturedScreenCard({ screen }: { screen: ScreenerTemplate }) {
  const isHighlighted = screen.id === 'high-dividend'
  const colors = CATEGORY_COLOR_TINTS[screen.category] || { bg: '#e5e7eb', text: 'var(--fs-text-primary)' }

  return (
    <Link
      to="/screener/results"
      className="group flex flex-col justify-between transition-all duration-200"
      style={{
        borderRadius: 'var(--fs-radius-md)',
        border: isHighlighted ? '1.5px solid var(--fs-brand)' : '0.5px solid var(--fs-border-color)',
        padding: '20px',
        background: isHighlighted ? '#f0f6ff' : 'var(--fs-surface)',
        cursor: 'pointer',
        height: '100%',
        minHeight: '190px',
        boxShadow: isHighlighted ? '0 2px 8px rgba(26, 86, 219, 0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.22)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'var(--fs-border-color)'
        }
      }}
    >
      <div>
        {/* Row 1 (category + popular badge row) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fs-space-xs)', marginBottom: '12px' }} className="w-full">
          <span
            style={{
              borderRadius: 'var(--fs-radius-xl)',
              background: colors.bg,
              color: colors.text,
            }}
            className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 leading-none"
          >
            {screen.category}
          </span>
          <span
            style={{
              borderRadius: 'var(--fs-radius-xl)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            className="bg-warning-soft text-warning text-xs font-medium px-2 py-0.5 leading-none"
          >
            <Star className="size-2.5 text-[var(--fs-warning)] fill-[var(--fs-warning)]" />
            Popular
          </span>
          {isHighlighted && (
            <ArrowRight className="size-4 text-[var(--fs-brand)] ml-auto shrink-0 transition-transform group-hover:translate-x-1" />
          )}
        </div>

        {/* Row 2 (title) */}
        <h3
          style={{
            marginBottom: '5px'
          }}
          className={cn(
            "text-lg font-semibold leading-snug",
            isHighlighted ? "text-accent" : "text-textPrimary"
          )}
        >
          {screen.name}
        </h3>

        {/* Row 3 (description) */}
        <p
          style={{
            marginBottom: '16px',
          }}
          className="text-body font-normal text-textSecondary leading-normal"
        >
          {screen.description}
        </p>
      </div>

      {/* Row 4 (footer) */}
      <div className="mt-auto w-full flex items-center justify-between">
        <span className="text-accent text-sm font-normal">
          {screen.matchCount} stocks matched
        </span>
        <div className="text-textMuted text-sm font-normal flex items-center gap-1">
          <Clock className="size-3" /> Recently run
        </div>
      </div>
    </Link>
  )
}

function BrowseScreenCard({ screen }: { screen: ScreenerTemplate }) {
  const isHighlighted = screen.id === 'high-dividend' || screen.id === 'promoter-buying'
  const colors = CATEGORY_COLOR_TINTS[screen.category] || { bg: '#e5e7eb', text: 'var(--fs-text-primary)' }

  return (
    <Link
      to="/screener/results"
      className="group flex flex-col justify-between transition-all duration-200"
      style={{
        borderRadius: 'var(--fs-radius-md)',
        border: isHighlighted ? '1.5px solid var(--fs-brand)' : '0.5px solid var(--fs-border-color)',
        padding: 'var(--fs-space-lg) var(--fs-space-lg) var(--fs-space-md)',
        background: isHighlighted ? '#f0f6ff' : 'var(--fs-surface)',
        cursor: 'pointer',
        height: '100%',
        minHeight: '180px',
        boxShadow: isHighlighted ? '0 2px 8px rgba(26, 86, 219, 0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.22)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'var(--fs-border-color)'
        }
      }}
    >
      <div>
        {/* Row 1 (category pills row) */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }} className="w-full">
          <span
            style={{
              borderRadius: 'var(--fs-radius-xl)',
              background: colors.bg,
              color: colors.text,
            }}
            className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 leading-none"
          >
            {screen.category}
          </span>
          {screen.popular && (
            <span
              style={{
                borderRadius: 'var(--fs-radius-xl)',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
              className="bg-warning-soft text-warning text-xs font-medium px-2 py-0.5 leading-none"
            >
              <Star className="size-2.5 text-[var(--fs-warning)] fill-[var(--fs-warning)]" />
              Popular
            </span>
          )}
        </div>

        {/* Row 2 (title) */}
        <h3
          style={{
            marginBottom: '5px'
          }}
          className={cn(
            "text-lg font-semibold leading-snug",
            isHighlighted ? "text-accent" : "text-textPrimary"
          )}
        >
          {screen.name}
        </h3>

        {/* Row 3 (description) */}
        <p
          style={{
            marginBottom: '14px',
          }}
          className="text-body font-normal text-textSecondary leading-normal line-clamp-2"
        >
          {screen.description}
        </p>
      </div>

      {/* Row 4 (footer) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: 'var(--fs-border)',
          paddingTop: '10px',
          marginTop: 'auto'
        }}
        className="w-full"
      >
        <span className="text-accent text-sm font-normal">
          {screen.matchCount} stocks matched
        </span>
        <div className="text-textMuted text-sm font-normal flex items-center gap-1">
          <Clock className="size-3" /> Recently run
        </div>
      </div>
    </Link>
  )
}

export function ScreenGallery() {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let list = SCREENER_TEMPLATES
    if (activeCategory !== 'All') {
      list = list.filter((s) => s.category === activeCategory || s.category.includes(activeCategory.replace(' & ', ' ')))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.query.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeCategory, searchQuery])

  const popular = useMemo(() => SCREENER_TEMPLATES.filter((s) => s.popular), [])

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-5">
        <div
          className="max-w-[1400px] mx-auto w-full"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}
        >
          <div>
            <div className="text-sm text-textMuted mb-1 flex items-center gap-1 select-none">
              <Link to="/" className="hover:underline">Home</Link>
              <span className="text-textMuted/60 font-normal">›</span>
              <span className="text-textSecondary">Screen Gallery</span>
            </div>
            <h1 className="text-3xl font-semibold text-textPrimary tracking-tight">
              Screen Gallery
            </h1>
            <p className="text-body font-normal text-textSecondary mt-1">
              {SCREENER_TEMPLATES.length} pre-built screeners crafted by expert analysts · click any to view results
            </p>
          </div>
          <Link
            to="/screener"
            style={{
              background: 'var(--fs-brand)',
              color: 'var(--fs-surface)',
              border: 'none',
              borderRadius: 'var(--fs-radius-sm)',
              padding: 'var(--fs-space-sm) var(--fs-space-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--fs-space-xs)'
            }}
            className="hover:bg-[var(--fs-brand)]/90 transition-colors shadow-sm select-none shrink-0 text-sm font-medium"
          >
            <Plus className="size-3.5" /> Build Custom Screen
          </Link>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-12">
        {/* ── SECTION 1 — POPULAR SCREENS (Featured Row) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fs-space-xs)', marginBottom: '14px' }}>
            <Flame className="size-4 text-[#BA7517] fill-[#BA7517]/20" />
            <h2 className="text-xl font-semibold text-textPrimary tracking-tight">
              Popular Screens
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[32px]">
            {popular.slice(0, 3).map((screen) => (
              <FeaturedScreenCard key={screen.id} screen={screen} />
            ))}
          </div>
        </section>

        {/* Separator / Differentiator */}
        <hr className="border-border/40" />

        {/* ── SECTION 2 — BROWSE ALL SCREENS ── */}
        <section>
          {/* Browse Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }} className="w-full flex-wrap gap-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--fs-space-xs)' }}>
              <LayoutGrid className="size-4 text-textSecondary" />
              <h2 className="text-xl font-semibold text-textPrimary tracking-tight">
                Browse All Screens
              </h2>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'var(--fs-surface-muted)',
                borderRadius: 'var(--fs-radius-sm)',
                padding: 'var(--fs-space-xs) var(--fs-space-md)',
                border: 'var(--fs-border)',
                width: '100%',
                maxWidth: '280px'
              }}
              className="text-sm"
            >
              <Search className="size-3.5 text-textMuted shrink-0" />
              <input
                type="text"
                placeholder="Search screens…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--fs-text-primary)',
                  width: '100%',
                  padding: 0,
                }}
                className="placeholder:text-textMuted text-body font-normal"
              />
            </div>
          </div>

          {/* Filter tab bar */}
          <div style={{ display: 'flex', gap: 'var(--fs-space-xs)', flexWrap: 'wrap', marginBottom: '18px' }} className="w-full select-none">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat]
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 'var(--fs-radius-xl)',
                    border: isActive ? '0.5px solid var(--fs-brand)' : '0.5px solid var(--fs-border-color)',
                    background: isActive ? 'var(--fs-brand)' : 'var(--fs-surface)',
                    color: isActive ? 'var(--fs-surface)' : 'var(--fs-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  className="transition-colors hover:bg-surfaceMuted text-sm font-medium"
                >
                  <Icon className="size-3.5" />
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Results grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutGrid className="size-10 text-textMuted mb-3" />
              <h3 className="text-sm font-medium text-textPrimary">No screens found</h3>
              <p className="text-xs text-textMuted mt-1">Try a different category or search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
              {filtered.map((screen) => (
                <BrowseScreenCard key={screen.id} screen={screen} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: 'var(--fs-border)'
            }}
            className="text-textMuted text-sm font-normal select-none"
          >
            Showing {filtered.length} of {SCREENER_TEMPLATES.length} screens
          </div>
        </section>
      </div>
    </div>
  )
}

export default ScreenGallery
