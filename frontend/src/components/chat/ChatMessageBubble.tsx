/**
 * One turn in the thread, plus — for assistant turns — the sources it cited.
 *
 * Citations are shown expanded rather than hidden behind a toggle. The whole
 * claim of this feature is that answers are grounded in real filings,
 * transcripts and fundamentals; hiding the evidence one click away quietly
 * makes it optional, and an ungrounded-looking answer is indistinguishable
 * from a grounded one at a glance.
 */
import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, ExternalLink, FileText, Landmark, Newspaper, Sparkles, TrendingUp, User,
} from 'lucide-react'
import { MarkdownAnswer } from './MarkdownAnswer'
import { LANGUAGE_LEVELS, type ChatMessageDto, type Citation } from '@/services/chatApi'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

interface ChatMessageBubbleProps {
  message: ChatMessageDto
}

// One icon per corpus, so the mix of evidence behind an answer is legible at a
// glance — three transcript chips reads differently from three news chips.
const SOURCE_ICONS: Record<Citation['sourceType'], typeof FileText> = {
  COMPANY_FUNDAMENTALS: TrendingUp,
  COMPANY_PROFILE: Landmark,
  TRANSCRIPT: FileText,
  NEWS: Newspaper,
  PLATFORM_HELP: BookOpen,
}

function CitationChip({ citation }: { citation: Citation }) {
  const Icon = SOURCE_ICONS[citation.sourceType] ?? FileText
  const label = citation.title || citation.symbol || citation.sourceLabel

  const body = (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center rounded bg-accentSoft text-[9px] font-bold text-accent">
        {citation.n}
      </span>
      <Icon className="size-3 shrink-0 text-textMuted" />
      <span className="min-w-0 truncate">{label}</span>
      {citation.detail && (
        <span className="shrink-0 text-textMuted">· {citation.detail}</span>
      )}
      {citation.url && <ExternalLink className="size-3 shrink-0 text-textMuted" />}
    </>
  )

  const className = cn(
    'flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface',
    'px-2 py-1 text-[11px] text-textSecondary transition-colors',
    citation.url && 'hover:border-accent/40 hover:text-accent',
  )

  if (citation.url) {
    return (
      <a
        id={`citation-${citation.n}`}
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={`${citation.sourceLabel}: ${label}`}
      >
        {body}
      </a>
    )
  }

  return (
    <span id={`citation-${citation.n}`} className={className} title={`${citation.sourceLabel}: ${label}`}>
      {body}
    </span>
  )
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const prefersReduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const isUser = message.role === 'user'

  function scrollToCitation(n: number) {
    const element = containerRef.current?.querySelector(`#citation-${n}`)
    if (!element) return
    element.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'nearest' })
    element.classList.add('ring-2', 'ring-accent/60')
    window.setTimeout(() => element.classList.remove('ring-2', 'ring-accent/60'), 1600)
  }

  const levelLabel = LANGUAGE_LEVELS.find(level => level.value === message.languageLevel)?.label

  return (
    <motion.div
      ref={containerRef}
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex gap-3', isUser && 'justify-end')}
    >
      {!isUser && (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accentSoft">
          <Sparkles className="size-3.5 text-accent" />
        </span>
      )}

      <div className={cn('min-w-0', isUser ? 'max-w-[85%]' : 'flex-1')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm leading-relaxed text-white">
            {message.content}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3">
            <MarkdownAnswer content={message.content} onCitationClick={scrollToCitation} />

            {message.citations.length > 0 && (
              <div className="mt-3 border-t border-border/60 pt-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-textMuted">
                  Sources used
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.citations.map(citation => (
                    <CitationChip key={citation.n} citation={citation} />
                  ))}
                </div>
              </div>
            )}

            {levelLabel && (
              <p className="mt-2 text-[10.5px] text-textMuted">
                Written for: {levelLabel}
                {message.latencyMs != null && ` · ${(message.latencyMs / 1000).toFixed(1)}s`}
              </p>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surfaceMuted">
          <User className="size-3.5 text-textMuted" />
        </span>
      )}
    </motion.div>
  )
}

export default ChatMessageBubble
