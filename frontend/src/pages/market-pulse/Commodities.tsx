import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ChevronRight, Coins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import finscreenApi from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'

interface Commodity {
  name: string
  price: number
  unit: string
  change: number
  updatedAt: string
}

export function Commodities() {
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await finscreenApi.fetchCommodities()
      setCommodities(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Failed to fetch commodities prices. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-background font-sans select-none flex flex-col justify-between">
      <div className="max-w-[1200px] mx-auto px-6 py-6 w-full">
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Commodities</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Commodities Board
        </Heading>
        <p className="text-sm text-textSecondary mb-6">
          Live MCX and global commodities market rates (Gold, Silver, energy, metals).
        </p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface border border-border/40 rounded-xl p-8 text-center">
            <p className="text-sm text-negative font-medium">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : commodities.length === 0 ? (
          <div className="bg-surface border border-border/40 rounded-xl p-12 text-center text-textMuted text-xs font-semibold">
            No commodities prices found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {commodities.map((c, i) => {
              const positive = c.change >= 0
              return (
                <Card key={i} className="border-border/40 bg-surface shadow-xs rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="border-b border-border/40 flex flex-row items-center justify-between py-3.5 px-5">
                    <CardTitle className="text-xs font-semibold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="size-4 text-accent" /> {c.name}
                    </CardTitle>
                    <span className="text-[10px] text-textMuted font-mono uppercase tracking-wider">
                      {c.unit}
                    </span>
                  </CardHeader>
                  <CardContent className="p-5 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-semibold font-mono tracking-tight text-textPrimary">
                        {c.unit === 'INR' ? '₹' : '$'}{c.price.toLocaleString('en-IN')}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-mono font-medium ${positive ? 'text-positive bg-positive-soft px-1.5 py-0.5 rounded' : 'text-negative bg-negative-soft px-1.5 py-0.5 rounded'}`}>
                        {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {positive ? '+' : ''}{c.change.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-[10px] text-textMuted font-medium">
                      Last Updated: {new Date(c.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  )
}

export default Commodities
