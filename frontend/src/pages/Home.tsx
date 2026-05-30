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

export function Home() {
  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading level={1} variant="pageTitle" className="text-balance">
            Markets Today
          </Heading>
          <Text variant="bodyMuted" className="mt-1">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/30 bg-positive-soft px-2.5 py-1 font-medium text-positive">
            <span className="size-1.5 rounded-full bg-positive animate-pulse" />
            Markets Open
          </span>
          <Text as="span" variant="caption" className="font-mono text-textSecondary">
            NSE · 09:15 – 15:30 IST
          </Text>
        </div>
      </header>

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
  )
}

export default Home
