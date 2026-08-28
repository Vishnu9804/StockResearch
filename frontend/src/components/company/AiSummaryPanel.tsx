import { useEffect, useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { AlertTriangle, ExternalLink, FileText, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatExternalUrl } from '@/lib/formatters'
import { finscreenApi } from '@/services/finscreenApi'

interface KeyHighlight {
  text: string
  source_category: 'announcement' | 'concall' | 'presentation'
  source_title: string
}

interface CoveredDoc {
  id: string
  category: string
  title: string
  filed_date: string | null
  pdf_url: string
}

interface SkippedDoc extends CoveredDoc {
  reason?: string
}

interface AiSummaryResponse {
  symbol: string
  quarterLabel: string
  status: 'ready' | 'insufficient_data' | 'no_documents' | 'failed'
  overview: string
  announcementsSummary: string | null
  concallSummary: string | null
  presentationSummary: string | null
  keyHighlights: KeyHighlight[]
  documentsCovered: CoveredDoc[]
  documentsSkipped: SkippedDoc[]
  generatedAt: string | null
  modelUsed: string | null
  disclaimer: string
}

const CATEGORY_LABEL: Record<string, string> = {
  announcement: 'Announcement',
  concall: 'Concall',
  presentation: 'Presentation',
}

const SECTION_LABEL: Record<string, string> = {
  announcementsSummary: 'Announcements',
  concallSummary: 'Concall',
  presentationSummary: 'Presentation',
}

export function AiSummaryPanel() {
  const symbol = useAppSelector((state) => state.company?.currentSymbol)
  const [data, setData] = useState<AiSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    finscreenApi.fetchCompanyAiSummary(symbol)
      .then((res: AiSummaryResponse) => {
        if (!cancelled) setData(res)
      })
      .catch((err: any) => {
        if (cancelled) return
        const msg = err?.response?.data?.detail?.message || err?.message || 'Failed to load the AI summary'
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [symbol])

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center px-6">
        <Loader2 className="size-6 text-accent animate-spin mb-3" />
        <p className="text-xs font-medium text-textPrimary">Generating this quarter's AI summary…</p>
        <p className="text-xs text-textMuted mt-1">First-time generation can take a little while — thanks for your patience.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-14 flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="size-8 text-warning mb-2" />
        <p className="text-xs font-medium text-textPrimary">Could not load the AI summary</p>
        <p className="text-xs text-textMuted mt-0.5">{error}</p>
      </div>
    )
  }

  if (!data) return null

  if (data.status !== 'ready') {
    return (
      <div className="py-14 flex flex-col items-center justify-center text-center px-6">
        <Sparkles className="size-8 text-border mb-2" />
        <p className="text-xs font-medium text-textPrimary">AI summary not available yet</p>
        <p className="text-xs text-textMuted mt-0.5 max-w-md">{data.overview}</p>
      </div>
    )
  }

  const sections: Array<{ key: string; label: string; text: string | null }> = [
    { key: 'announcementsSummary', label: SECTION_LABEL.announcementsSummary, text: data.announcementsSummary },
    { key: 'concallSummary', label: SECTION_LABEL.concallSummary, text: data.concallSummary },
    { key: 'presentationSummary', label: SECTION_LABEL.presentationSummary, text: data.presentationSummary },
  ].filter((s) => s.text)

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center size-7 rounded-lg bg-accentSoft text-accent">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-medium text-textPrimary">AI Summary — {data.quarterLabel}</h3>
            <p className="text-xs text-textMuted mt-0.5">
              Based on {data.documentsCovered.length} document{data.documentsCovered.length === 1 ? '' : 's'} filed this quarter
              {data.generatedAt ? ` · generated ${new Date(data.generatedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-accentSoft/40 border border-accent/15 rounded-xl p-4">
        <p className="text-sm text-textPrimary leading-relaxed">{data.overview}</p>
      </div>

      {/* Per-category sections */}
      {sections.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {sections.map((s) => (
            <div key={s.key} className="border border-border/40 rounded-xl p-3.5 bg-surface">
              <p className="text-xs font-medium uppercase tracking-wider text-textMuted mb-1.5">{s.label}</p>
              <p className="text-xs text-textSecondary leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Key highlights */}
      {data.keyHighlights.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-textMuted mb-2">Key highlights</p>
          <ul className="space-y-2">
            {data.keyHighlights.map((h, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-textSecondary">
                <span className="mt-1.5 size-1 rounded-full bg-accent shrink-0" />
                <span className="leading-relaxed">
                  {h.text}{' '}
                  <span className="text-textMuted">
                    — {CATEGORY_LABEL[h.source_category] || h.source_category}, "{h.source_title}"
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents covered */}
      {data.documentsCovered.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-textMuted mb-2">Documents covered</p>
          <div className="space-y-1.5">
            {data.documentsCovered.map((doc) => (
              <a
                key={doc.id}
                href={formatExternalUrl(doc.pdf_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-textSecondary hover:text-accent transition-colors group"
              >
                <FileText className="size-3.5 shrink-0 text-textMuted group-hover:text-accent" />
                <span className="truncate">{doc.title}</span>
                {doc.filed_date && <span className="text-textMuted shrink-0">· {doc.filed_date}</span>}
                <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Skipped documents transparency note */}
      {data.documentsSkipped.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-textMuted bg-warning-soft/40 border border-warning/15 rounded-lg p-3">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-warning" />
          <span>
            {data.documentsSkipped.length} document{data.documentsSkipped.length === 1 ? '' : 's'} this quarter could not
            be read automatically (likely a scanned image) and {data.documentsSkipped.length === 1 ? 'is' : 'are'} not
            reflected above — check the original filing directly if needed.
          </span>
        </div>
      )}

      {/* Disclaimer */}
      <p className={cn('text-xs text-textMuted italic border-t border-border/40 pt-3')}>{data.disclaimer}</p>
    </div>
  )
}

export default AiSummaryPanel
