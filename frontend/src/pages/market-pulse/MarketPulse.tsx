/**
 * Market Pulse Hub — /market-pulse
 * Landing page with 3 list cards: Market Pulse, Latest Trades, Corporate Actions.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight, FileText, Building, Mic2, CalendarClock, BookOpen,
  DollarSign, BarChart3, TrendingUp, TrendingDown, RotateCcw,
  Scissors, Award, ShoppingCart, Activity
} from 'lucide-react'
import { Heading } from '@/components/ui/Heading'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { AppFooter } from '@/components/shared/AppFooter'
import { HubCardSkeleton } from '@/components/ui/SkeletonLoader'

interface HubRow {
  label: string
  badge: string
  href: string
  icon: React.ElementType
}

function ListCard({ title, icon: HeaderIcon, rows, loading }: { title: string; icon: React.ElementType; rows: HubRow[]; loading: boolean }) {
  return (
    <Card className="border-border/40 bg-surface shadow-xs rounded-xl overflow-hidden premium-card">
      <CardHeader className="border-b border-border/40 bg-surfaceMuted/20 px-5 py-4 flex flex-row items-center gap-2">
        <HeaderIcon className="size-4 text-accent shrink-0" aria-hidden="true" />
        <CardTitle className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      
      {loading ? (
        <HubCardSkeleton count={rows.length} />
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <Link
                key={row.href}
                to={row.href}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surfaceMuted/30 transition-colors group text-decoration-none focus-visible:bg-surfaceMuted/30 outline-ring/45 focus-visible:outline"
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-textSecondary group-hover:text-accent transition-colors shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold text-textPrimary">{row.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-accentSoft text-accent px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shrink-0">
                    {row.badge}
                  </span>
                  <ChevronRight className="size-3.5 text-textMuted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

const MARKET_PULSE_ROWS: HubRow[] = [
  { label: 'Announcements', badge: '12 today', href: '/market-pulse/announcements', icon: FileText },
  { label: 'Industries Overview', badge: '15 sectors', href: '/market-pulse/industries', icon: Building },
  { label: 'Concalls', badge: '12 recent', href: '/market-pulse/concalls', icon: Mic2 },
  { label: 'Upcoming Concalls', badge: '8 upcoming', href: '/market-pulse/upcoming-concalls', icon: CalendarClock },
  { label: 'Annual Reports', badge: '12 new', href: '/market-pulse/annual-reports', icon: BookOpen },
  { label: 'FII Investments', badge: 'Net ₹1,245 Cr', href: '/market-pulse/insider-trades', icon: DollarSign },
  { label: 'New Issues / IPO', badge: '8 upcoming', href: '/market-pulse/new-issues', icon: BarChart3 },
  { label: 'Upcoming Results', badge: '24 this week', href: '/market-pulse/results', icon: TrendingUp },
]

const TRADE_ROWS: HubRow[] = [
  { label: 'Bulk Deals', badge: '15 new', href: '/market-pulse/bulk-deals', icon: TrendingUp },
  { label: 'Block Deals', badge: '10 new', href: '/market-pulse/block-deals', icon: TrendingDown },
  { label: 'SAST Trades', badge: '10 entries', href: '/market-pulse/sast-trades', icon: ShoppingCart },
  { label: 'Insider Trades', badge: '15 entries', href: '/market-pulse/insider-trades', icon: DollarSign },
]

const CORP_ACTION_ROWS: HubRow[] = [
  { label: 'Bonus Issues', badge: '2 new', href: '/market-pulse/dividends', icon: Award },
  { label: 'Rights Issues', badge: '1 new', href: '/market-pulse/dividends', icon: RotateCcw },
  { label: 'Stock Splits', badge: '0 new', href: '/market-pulse/dividends', icon: Scissors },
  { label: 'Buybacks', badge: '3 new', href: '/market-pulse/dividends', icon: ShoppingCart },
  { label: 'Dividends', badge: '15 upcoming', href: '/market-pulse/dividends', icon: DollarSign },
]

export function MarketPulse() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1000px] mx-auto px-6 py-6 select-none">

        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-1.5 flex items-center gap-1">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Market Pulse</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Market Pulse
        </Heading>

        <div className="flex flex-col gap-6 pb-12">
          <ListCard title="Market Pulse" icon={Activity} rows={MARKET_PULSE_ROWS} loading={loading} />
          <ListCard title="Latest Trades" icon={TrendingUp} rows={TRADE_ROWS} loading={loading} />
          <ListCard title="Corporate Actions" icon={RotateCcw} rows={CORP_ACTION_ROWS} loading={loading} />
        </div>
      </div>

      <AppFooter />
    </div>
  )
}

export default MarketPulse
