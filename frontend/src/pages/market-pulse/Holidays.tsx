import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import finscreenApi from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'

interface Holiday {
  sr_no?: number
  trading_date?: string
  day?: string
  description?: string
}

export function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await finscreenApi.fetchMarketHolidays()
      setHolidays(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Failed to fetch market holidays. Please try again.')
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
          <span className="text-accent font-medium">Trading Holidays</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Trading Holidays
        </Heading>
        <p className="text-sm text-textSecondary mb-6">
          Official NSE & BSE trading holidays calendar for the current year.
        </p>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-surface rounded-xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface border border-border/40 rounded-xl p-8 text-center">
            <p className="text-sm text-negative font-medium">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : holidays.length === 0 ? (
          <div className="bg-surface border border-border/40 rounded-xl p-12 text-center text-textMuted text-xs font-semibold">
            No holidays found in calendar.
          </div>
        ) : (
          <Card className="border-border/40 bg-surface shadow-xs rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40">
              <CardTitle className="text-sm font-semibold text-textPrimary flex items-center gap-1.5">
                <Calendar className="size-4 text-accent" /> Upcoming Holidays List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surfaceMuted/50 border-b border-border/40 font-medium text-textSecondary">
                      <th className="px-5 py-3 text-left">No.</th>
                      <th className="px-5 py-3 text-left">Holiday Name</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {holidays.map((h, i) => (
                      <tr key={i} className="hover:bg-tableRowHover transition-colors">
                        <td className="px-5 py-3.5 text-textMuted font-mono">{h.sr_no || i + 1}</td>
                        <td className="px-5 py-3.5 font-semibold text-textPrimary">{h.description}</td>
                        <td className="px-5 py-3.5 text-textSecondary font-medium">
                          {h.trading_date ? new Date(h.trading_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        </td>
                        <td className="px-5 py-3.5 text-textSecondary font-medium">{h.day}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AppFooter />
    </div>
  )
}

export default Holidays
