import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { finscreenClient } from '@/services/finscreenApi'

interface HistoryEntry {
  type: string
  from: string
  to: string
  date: string
}

export function CompanyIdentityHistory({ symbol }: { symbol: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol || symbol === 'STOCK') return
    setLoading(true)
    finscreenClient.get(`/company/${symbol}/identity-history`)
      .then(res => {
        setHistory(Array.isArray(res.data) ? res.data : [])
      })
      .catch(err => console.error('Failed to load identity history:', err))
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading || history.length === 0) return null

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl overflow-hidden mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surfaceMuted/30 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-textPrimary flex items-center gap-2">
          <History className="size-4 text-accent" />
          <span>Identity History ({history.length} changes)</span>
        </span>
        {isOpen ? <ChevronUp className="size-4 text-textMuted" /> : <ChevronDown className="size-4 text-textMuted" />}
      </button>

      {isOpen && (
        <CardContent className="px-6 pb-6 pt-2 border-t border-border/20 bg-surfaceMuted/10 space-y-4">
          <div className="relative border-l-2 border-border/60 ml-3 pl-5 space-y-5">
            {history.map((entry, idx) => (
              <div key={idx} className="relative">
                {/* Timeline node dot */}
                <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-background bg-accent" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] bg-accentSoft text-accent border-accent/20 px-1.5 py-0.5 font-semibold uppercase">
                      {entry.type}
                    </Badge>
                    <p className="text-xs text-textPrimary mt-1.5 font-medium">
                      Changed from <span className="font-semibold">{entry.from}</span> to <span className="font-semibold">{entry.to}</span>
                    </p>
                  </div>
                  {entry.date && (
                    <span className="text-[11px] font-mono text-textMuted self-start sm:self-auto">
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
