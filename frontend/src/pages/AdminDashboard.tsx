import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Users, CreditCard, FolderHeart, Database, RefreshCw, Activity, Layers, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppFooter } from '@/components/shared/AppFooter'
import { apiClient } from '@/services/finscreenApi'

interface Metrics {
  totalUsers: number
  proUsers: number
  totalWatchlists: number
  totalRevenue: number
  totalHoldings: number
}

interface Status {
  database: string
  scheduler: string
  cache: string
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/admin/summary')
      if (res.data?.success) {
        setMetrics(res.data.metrics)
        setStatus(res.data.status)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail?.message || 'Access denied or failed to load administrator summary.')
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
          <Link to="/" className="hover:text-accent transition-colors flex items-center gap-1">
            <ArrowLeft className="size-3" /> Dashboard
          </Link>
          <span className="text-textMuted">›</span>
          <span className="text-accent font-medium">Admin Panel</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1 flex items-center gap-2">
              <ShieldAlert className="size-6 text-accent" /> Admin Control Hub
            </Heading>
            <p className="text-sm text-textSecondary">
              Real-time platform statistics, user conversions, and micro-services health.
            </p>
          </div>
          <Button
            onClick={load}
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-8 border-border hover:bg-surfaceMuted text-textSecondary gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload Stats
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-surface rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-surface border border-border/40 rounded-2xl p-12 text-center max-w-md mx-auto my-12">
            <ShieldAlert className="size-12 text-negative mx-auto mb-4" />
            <Heading level={3} className="text-base font-semibold text-textPrimary mb-2">Unauthorized Access</Heading>
            <p className="text-xs text-textSecondary leading-relaxed mb-6">{error}</p>
            <Button asChild className="bg-accent text-white hover:bg-accent/90 h-9 px-6 text-xs uppercase font-semibold">
              <Link to="/">Go Back Home</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard title="Total Users" value={metrics?.totalUsers ?? 0} icon={Users} desc="Registered accounts" />
              <MetricCard title="Pro Plan Accounts" value={metrics?.proUsers ?? 0} icon={CreditCard} desc={`${((metrics?.proUsers ?? 0) / (metrics?.totalUsers || 1) * 100).toFixed(1)}% conversion rate`} />
              <MetricCard title="Total Watchlists" value={metrics?.totalWatchlists ?? 0} icon={FolderHeart} desc="Active watchlist folders" />
              <MetricCard title="Gross Revenue" value={`₹${(metrics?.totalRevenue ?? 0).toLocaleString('en-IN')}`} icon={Database} desc="Calculated gross earnings" />
            </div>

            {/* System Status and Holdings metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 border-border/40 bg-surface shadow-xs rounded-2xl">
                <CardHeader className="border-b border-border/40 py-3.5 px-5 flex flex-row items-center gap-2">
                  <Activity className="size-4 text-accent" />
                  <CardTitle className="text-xs font-semibold text-textSecondary uppercase tracking-wider">System Components Health</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-xs text-textSecondary font-medium flex items-center gap-2">
                      <Database className="size-4 text-textMuted" /> SQLite Database Connection
                    </span>
                    <Badge className="bg-positive-soft text-positive border-0 shadow-none uppercase font-semibold text-[10px]">
                      {status?.database || 'healthy'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-xs text-textSecondary font-medium flex items-center gap-2">
                      <RefreshCw className="size-4 text-textMuted" /> Background Task Scheduler
                    </span>
                    <Badge className="bg-positive-soft text-positive border-0 shadow-none uppercase font-semibold text-[10px]">
                      {status?.scheduler || 'running'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 last:border-0 pb-0">
                    <span className="text-xs text-textSecondary font-medium flex items-center gap-2">
                      <Layers className="size-4 text-textMuted" /> InMemory Cache Layers
                    </span>
                    <Badge className="bg-positive-soft text-positive border-0 shadow-none uppercase font-semibold text-[10px]">
                      {status?.cache || 'active'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-surface shadow-xs rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <Text variant="caption" className="text-textSecondary font-medium uppercase tracking-wider text-[10px] mb-1">Portfolio Integration</Text>
                  <Text variant="pageTitle" className="text-textPrimary font-semibold text-3xl font-mono mt-2">
                    {metrics?.totalHoldings ?? 0}
                  </Text>
                  <Text variant="caption" className="text-textMuted text-[10px] mt-1 block">Total individual stock positions stored across all user portfolios.</Text>
                </div>
                <div className="pt-4 border-t border-border/40 mt-4 flex items-center justify-between text-xs text-textSecondary font-medium">
                  <span>Sync Status:</span>
                  <span className="text-positive font-semibold">OK (Real-time)</span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, desc }: { title: string; value: string | number; icon: React.ElementType; desc: string }) {
  return (
    <Card className="border-border/40 bg-surface shadow-xs rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <Text variant="caption" className="text-textSecondary font-medium uppercase tracking-wider text-[10px]">{title}</Text>
        <Icon className="size-4 text-textMuted" />
      </div>
      <div>
        <h3 className="text-2xl font-bold font-mono tracking-tight text-textPrimary leading-none">
          {value}
        </h3>
        <p className="text-[10px] text-textMuted mt-1.5 font-medium">{desc}</p>
      </div>
    </Card>
  )
}

export default AdminDashboard
