/**
 * AuditorNotes.tsx
 * Uses FinEdge GET /api/v1/notes/{symbol}?statement_type=s&period=annual
 * Proxied via: GET /api/finscreen/company/{symbol}/notes
 */
import { useState, useEffect } from 'react'
import { FileText, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppSelector } from '@/store/hooks'
import { finscreenClient } from '@/services/finscreenApi'

interface NoteEntry {
  FinancialResults?: string
  [key: string]: any
}

export function AuditorNotes() {
  const company = useAppSelector(s => s.company.data)
  const symbol = company?.symbol || ''

  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(0)
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual')

  const load = async () => {
    if (!symbol || symbol === 'STOCK') return
    setLoading(true)
    setError(null)
    try {
      const res = await finscreenClient.get(`/company/${symbol}/notes`, {
        params: { statement_type: 's', period }
      })
      const data = res.data?.notes || res.data || []
      setNotes(Array.isArray(data) ? data : [])
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        setNotes([])
      } else {
        setError('Failed to load auditor notes. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (symbol && symbol !== 'STOCK') load()
  }, [symbol, period])

  const noteText = (note: NoteEntry) =>
    note.FinancialResults || Object.values(note).find(v => typeof v === 'string') || ''

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="border-b border-border/40 flex flex-row items-center justify-between py-3.5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-accent" />
          <CardTitle className="text-sm font-semibold text-textPrimary">Auditor Notes</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs">
            {(['annual', 'quarterly'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 capitalize transition-colors ${
                  period === p
                    ? 'bg-accent text-white'
                    : 'text-textMuted hover:bg-surfaceMuted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border/40 hover:border-accent text-textMuted hover:text-accent transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-surfaceMuted/60 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-xs text-negative">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : notes.length === 0 ? (
          <div className="py-8 text-center text-xs text-textMuted border border-dashed border-border/40 rounded-xl">
            <FileText className="size-5 mx-auto mb-2 opacity-40" />
            No auditor notes available for this company ({period}).
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note, idx) => {
              const text = noteText(note)
              const isOpen = expanded === idx
              if (!text) return null
              return (
                <div key={idx} className="border border-border/30 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surfaceMuted/30 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-textPrimary flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-accentSoft text-accent border-accent/20 px-1.5 py-0.5 font-mono">
                        Note {idx + 1}
                      </Badge>
                      <span className="text-textMuted line-clamp-1">{text.slice(0, 80)}…</span>
                    </span>
                    {isOpen
                      ? <ChevronDown className="size-3.5 text-textMuted shrink-0" />
                      : <ChevronRight className="size-3.5 text-textMuted shrink-0" />
                    }
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-textSecondary leading-relaxed border-t border-border/20 pt-3 bg-surfaceMuted/10"
                      dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
