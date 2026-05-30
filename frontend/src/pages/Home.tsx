import { MarketOverview, BreadthCards } from "@/components/dashboard/market-overview"
import { IntradayChart } from "@/components/dashboard/intraday-chart"
import { GainersLosers } from "@/components/dashboard/gainers-losers"
import { NewsFeed } from "@/components/dashboard/news-feed"
import { SectorPerformance } from "@/components/dashboard/sector-performance"
import { SavedScans } from "@/components/dashboard/saved-scans"
import { Heading } from "@/components/ui/Heading"
import { Text } from "@/components/ui/Text"

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

      <MarketOverview />

      <BreadthCards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <IntradayChart />
          <SectorPerformance />
        </div>
        <div className="space-y-4">
          <GainersLosers />
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
