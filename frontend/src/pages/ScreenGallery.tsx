import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Filter, TrendingUp, BarChart2, Star, Clock,
  ArrowRight, Search, Plus, ChevronRight, Sparkles, Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SCREENER_TEMPLATES, type ScreenerTemplate } from '@/lib/data/screener'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { cn } from '@/lib/utils'

const CATEGORIES = ['All', 'Valuation', 'Profitability', 'Growth', 'Technical', 'Dividends', 'Debt & Liquidity', 'Shareholding'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_ICON: Record<string, React.ElementType> = {
  All: Filter,
  Valuation: BarChart2,
  Profitability: TrendingUp,
  Growth: Zap,
  Technical: BarChart2,
  Dividends: Star,
  'Debt & Liquidity': Filter,
  Shareholding: Filter,
}

const CATEGORY_COLOR: Record<string, string> = {
  Valuation: 'bg-blue-50 text-blue-700 border-blue-200',
  Profitability: 'bg-green-50 text-green-700 border-green-200',
  Growth: 'bg-violet-50 text-violet-700 border-violet-200',
  Technical: 'bg-amber-50 text-amber-700 border-amber-200',
  Dividends: 'bg-pink-50 text-pink-700 border-pink-200',
  'Debt & Liquidity': 'bg-red-50 text-red-700 border-red-200',
  Shareholding: 'bg-teal-50 text-teal-700 border-teal-200',
  'Management Quality': 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

function ScreenCard({ screen }: { screen: ScreenerTemplate }) {
  const colorClass = CATEGORY_COLOR[screen.category] ?? 'bg-surfaceMuted text-textSecondary border-border'

  return (
    <Link
      to="/screener/results"
      className="group flex flex-col justify-between rounded-xl border border-border bg-surface hover:border-accent/40 hover:shadow-md transition-all duration-200 p-5 h-48"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={cn('text-[9px] font-bold uppercase tracking-wider border shadow-none', colorClass)}
            >
              {screen.category}
            </Badge>
            {screen.popular && (
              <Badge
                variant="outline"
                className="text-[9px] font-bold uppercase tracking-wider bg-warning-soft text-amber-700 border-amber-200 shadow-none"
              >
                <Star className="size-2.5 mr-0.5 fill-amber-500" /> Popular
              </Badge>
            )}
          </div>
          <ArrowRight className="size-4 text-accent opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0" />
        </div>
        <h3 className="text-sm font-bold text-textPrimary group-hover:text-accent transition-colors leading-tight">
          {screen.name}
        </h3>
        <p className="text-[11px] text-textMuted mt-1.5 line-clamp-2 leading-relaxed">
          {screen.description}
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-accent tabular-nums">{screen.matchCount}</span>
          <span className="text-[10px] text-textMuted font-medium">stocks matched</span>
        </div>
        <div className="flex items-center gap-1 text-textMuted text-[10px] font-medium">
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
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1.5">
              <Link to="/" className="hover:text-accent transition-colors">Home</Link>
              <ChevronRight className="size-3" />
              <span className="text-textPrimary font-medium">Screen Gallery</span>
            </nav>
            <Heading level={1} variant="pageTitle">Screen Gallery</Heading>
            <Text variant="bodyMuted" className="mt-0.5">
              {SCREENER_TEMPLATES.length} pre-built screeners crafted by expert analysts · click any to view results
            </Text>
          </div>
          <Button
            asChild
            className="bg-accent hover:bg-accent/90 text-white font-bold text-xs h-9 shadow-none gap-1.5"
          >
            <Link to="/screener">
              <Plus className="size-3.5" /> Build Custom Screen
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Popular Screens ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-sm font-bold text-textPrimary uppercase tracking-wide">Popular Screens</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {popular.slice(0, 4).map((screen) => (
              <ScreenCard key={screen.id} screen={screen} />
            ))}
          </div>
        </section>

        {/* ── Browse All ── */}
        <section>
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <h2 className="text-sm font-bold text-textPrimary uppercase tracking-wide flex items-center gap-2">
              <Filter className="size-4 text-accent" /> Browse All Screens
            </h2>
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-textMuted" />
              <Input
                placeholder="Search screens…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs border-border bg-surfaceMuted shadow-none"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICON[cat] ?? Filter
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    activeCategory === cat
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface border-border text-textSecondary hover:border-accent/30 hover:text-textPrimary'
                  )}
                >
                  <Icon className="size-3.5" />
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Filter className="size-10 text-textMuted mb-3" />
              <h3 className="text-sm font-bold text-textPrimary">No screens found</h3>
              <p className="text-xs text-textMuted mt-1">Try a different category or search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((screen) => (
                <ScreenCard key={screen.id} screen={screen} />
              ))}
            </div>
          )}

          <p className="text-xs text-textMuted mt-6 text-center">
            Showing {filtered.length} of {SCREENER_TEMPLATES.length} screens
          </p>
        </section>
      </div>
    </div>
  )
}

export default ScreenGallery
