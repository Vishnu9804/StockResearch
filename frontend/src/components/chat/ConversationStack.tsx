/**
 * The rail of recent threads.
 *
 * Shows at most the newest ten, because that is exactly what the backend keeps
 * (CHAT_MAX_CONVERSATIONS_PER_USER) — the list is not truncated for display,
 * it IS the whole history, and the footnote says so rather than letting a user
 * assume older threads are hidden somewhere.
 */
import { motion } from 'framer-motion'
import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import type { ConversationDto } from '@/services/chatApi'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

interface ConversationStackProps {
  conversations: ConversationDto[]
  activeId: string | null
  loading?: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export function ConversationStack({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
}: ConversationStackProps) {
  const prefersReduced = useReducedMotion()

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface/60">
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={onNew}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border',
            'px-3 py-2.5 text-xs font-medium text-textSecondary transition-all duration-150',
            'hover:border-accent/50 hover:bg-accentSoft hover:text-accent active:scale-[0.98]',
          )}
        >
          <Plus className="size-3.5" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2 scrollbar-hide">
        {loading && conversations.length === 0 && (
          <div className="space-y-1.5 px-1">
            {[0, 1, 2].map(index => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-surfaceMuted" />
            ))}
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-textMuted">
            Your chats will appear here.
            <br />
            The last 10 are kept.
          </p>
        )}

        {conversations.map(conversation => {
          const active = conversation.id === activeId
          return (
            <motion.div
              key={conversation.id}
              layout={!prefersReduced}
              className={cn(
                'group relative flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors',
                active ? 'bg-accentSoft' : 'hover:bg-surfaceMuted',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <MessageSquare
                  className={cn('mt-0.5 size-3.5 shrink-0', active ? 'text-accent' : 'text-textMuted')}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-xs font-medium',
                      active ? 'text-accent' : 'text-textPrimary',
                    )}
                  >
                    {conversation.title}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-textMuted">
                    {Math.floor(conversation.messageCount / 2)} question
                    {Math.floor(conversation.messageCount / 2) === 1 ? '' : 's'}
                    {conversation.lastMessageAt && ` · ${relativeTime(conversation.lastMessageAt)}`}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(conversation.id)}
                aria-label={`Delete ${conversation.title}`}
                className={cn(
                  'mt-0.5 shrink-0 rounded p-1 text-textMuted opacity-0 transition-all',
                  'hover:bg-negative/10 hover:text-negative group-hover:opacity-100 focus:opacity-100',
                )}
              >
                <Trash2 className="size-3" />
              </button>
            </motion.div>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-border/60 px-3 py-2">
        <p className="text-[10px] leading-snug text-textMuted">
          Chats stay open until you press New chat. Only the 10 most recent are kept.
        </p>
      </div>
    </aside>
  )
}

export default ConversationStack
