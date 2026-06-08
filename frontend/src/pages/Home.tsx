import { MarketOverview, BreadthCards } from "@/components/dashboard/market-overview"
import { IntradayChart } from "@/components/dashboard/intraday-chart"
import { TopMovers } from "@/components/dashboard/TopMovers"
import { MarketHeatmap } from "@/components/dashboard/MarketHeatmap"
import { NewsFeed } from "@/components/dashboard/news-feed"
import { SectorPerformance } from "@/components/dashboard/sector-performance"
import { SavedScans } from "@/components/dashboard/saved-scans"
import { Heading } from "@/components/ui/Heading"
import { Text } from "@/components/ui/Text"
import { marketBreadth } from "@/lib/data/market"
import { useMarketStatus } from "@/hooks/useMarketStatus"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import { useAppSelector } from "@/store/hooks"

export function Home() {
  const marketStatus = useMarketStatus()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
          <Text as="span" variant="bodyMuted" className="text-xs">Home</Text>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading level={1} variant="pageTitle" className="text-balance">
              Markets Today
            </Heading>
            <Text variant="bodyMuted" className="mt-0.5 text-xs">
              Live snapshot of Indian equity markets ·{" "}
              <Text as="span" variant="numeric">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </Text>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium',
                marketStatus.isOpen
                  ? 'border-positive/30 bg-positive-soft text-positive'
                  : 'border-border bg-surfaceMuted text-textSecondary'
              )}
              title={marketStatus.nextEvent}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  marketStatus.isOpen ? 'bg-positive animate-pulse' : 'bg-textMuted'
                )}
              />
              {marketStatus.label}
            </span>
            <Text as="span" variant="caption" className="font-mono text-textSecondary">
              NSE · 09:15 – 15:30 IST
            </Text>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-accentSoft/30 border border-accent/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-textSecondary select-none">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent shrink-0 animate-pulse" />
            <span>Track your personal watchlist, build custom screeners, and get real-time price alerts. Join FinScreen today.</span>
          </div>
          <Link to="/register" className="font-bold text-accent hover:underline uppercase tracking-wider text-[11px] shrink-0">
            Create Free Account
          </Link>
        </div>
      )}

      <div className="px-4 py-5 lg:px-6 lg:py-6 space-y-5">

      {/* Market Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Advances</span>
          <span className="text-sm font-mono font-bold text-positive mt-0.5">{marketBreadth.advances}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Declines</span>
          <span className="text-sm font-mono font-bold text-negative mt-0.5">{marketBreadth.declines}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Unchanged</span>
          <span className="text-sm font-mono font-bold text-textSecondary mt-0.5">{marketBreadth.unchanged}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Total Volume</span>
          <span className="text-sm font-mono font-bold text-textPrimary mt-0.5">142.8M shares</span>
        </div>
      </div>

      <MarketOverview />

      <BreadthCards />

      <MarketHeatmap />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <IntradayChart />
          <SectorPerformance />
        </div>
        <div className="space-y-4">
          <TopMovers />
        </div>
      </div>

      <SavedScans />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NewsFeed />
        </div>
      </div>
    </div>
    </div>
  )
}

export default Home
