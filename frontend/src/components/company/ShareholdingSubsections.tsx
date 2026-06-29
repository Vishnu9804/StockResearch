import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, Calendar, TrendingUp } from 'lucide-react'
import { finscreenClient } from '@/services/finscreenApi'

export function ShareholdingSubsections({ symbol }: { symbol: string }) {
  const [activeTab, setActiveTab] = useState<'beneficial' | 'declaration' | 'current' | 'history'>('beneficial')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!symbol || symbol === 'STOCK') return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const endpoint =
        activeTab === 'beneficial' ? `/company/${symbol}/shareholding/beneficial-owners` :
        activeTab === 'declaration' ? `/company/${symbol}/shareholding/declaration` :
        activeTab === 'current' ? `/company/${symbol}/shareholding/ownership-current` :
        `/company/${symbol}/shareholding/ownership-history`
      
      const res = await finscreenClient.get(endpoint)
      setData(res.data)
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 404) {
        setData([])
      } else {
        setError('Failed to fetch ownership details.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [symbol, activeTab])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-surfaceMuted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )
    }
    if (error) {
      return <p className="text-xs text-negative py-6 text-center">{error}</p>
    }
    if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return <p className="text-xs text-textMuted py-8 text-center border border-dashed border-border/40 rounded-xl">No records found for this section.</p>
    }

    if (activeTab === 'beneficial') {
      const list = Array.isArray(data) ? data : data.owners || []
      return (
        <div className="space-y-3">
          {list.map((owner: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 border border-border/30 rounded-xl bg-surfaceMuted/10">
              <div>
                <p className="text-xs font-semibold text-textPrimary">{owner.owner_name || owner.name || 'Beneficial Owner'}</p>
                <p className="text-[10px] text-textMuted mt-0.5">Shares Held: {(owner.shares || 0).toLocaleString('en-IN')}</p>
              </div>
              <Badge variant="outline" className="text-xs font-medium text-accent bg-accentSoft border-accent/20">
                {(owner.percentage || 0).toFixed(2)}%
              </Badge>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'declaration') {
      // Declaration usually contains promoter holding summary or regulatory declarations
      const declaration = data.declaration || data
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surfaceMuted/20 border border-border/30 rounded-xl">
              <span className="text-[10px] text-textMuted uppercase tracking-wider block">Promoter & Promoter Group</span>
              <span className="text-sm font-semibold font-mono text-textPrimary block mt-1">{(declaration.promoterPercentage || declaration.promoters || 0).toFixed(2)}%</span>
            </div>
            <div className="p-3 bg-surfaceMuted/20 border border-border/30 rounded-xl">
              <span className="text-[10px] text-textMuted uppercase tracking-wider block">Public Shareholding</span>
              <span className="text-sm font-semibold font-mono text-textPrimary block mt-1">{(declaration.publicPercentage || declaration.public || 0).toFixed(2)}%</span>
            </div>
          </div>
          {declaration.summaryText && (
            <p className="text-textSecondary mt-2 leading-relaxed">{declaration.summaryText}</p>
          )}
        </div>
      )
    }

    if (activeTab === 'current') {
      const current = Array.isArray(data) ? data : data.ownership || []
      return (
        <div className="space-y-3">
          {current.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 border border-border/30 rounded-xl bg-surfaceMuted/10">
              <div>
                <p className="text-xs font-semibold text-textPrimary">{item.category || item.name || 'Investor'}</p>
                <p className="text-[10px] text-textMuted mt-0.5">Value: ₹{(item.value || 0).toLocaleString('en-IN')}</p>
              </div>
              <Badge variant="outline" className="text-xs font-medium text-accent bg-accentSoft border-accent/20">
                {(item.percentage || 0).toFixed(2)}%
              </Badge>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'history') {
      const history = Array.isArray(data) ? data : data.history || []
      return (
        <div className="space-y-3">
          {history.slice(0, 5).map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 border border-border/30 rounded-xl bg-surfaceMuted/10">
              <div>
                <p className="text-xs font-semibold text-textPrimary">{item.category || item.name || 'Investor'}</p>
                <p className="text-[10px] text-textMuted mt-0.5">Period: {item.quarter || item.period || 'Recent'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-textPrimary">{(item.percentage || 0).toFixed(2)}%</span>
                <span className={`text-[10px] block font-mono ${item.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {item.change >= 0 ? '+' : ''}{(item.change || 0).toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="border-b border-border/40 pb-3 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <CardTitle className="text-sm font-semibold text-textPrimary flex items-center gap-1.5">
          <Users className="size-4 text-accent" /> Institutional Micro-Details
        </CardTitle>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 p-0.5 text-xs">
          {[
            { id: 'beneficial', label: 'Beneficial Owners' },
            { id: 'declaration', label: 'Declarations' },
            { id: 'current', label: 'Current Holdings' },
            { id: 'history', label: 'Flow History' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === t.id ? 'bg-accent text-white font-medium' : 'text-textMuted hover:bg-surfaceMuted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="py-4">
        {renderContent()}
      </CardContent>
    </Card>
  )
}
