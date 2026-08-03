/**
 * Research Chat — /chat
 *
 * A full page rather than a slide-over panel: the answers are long, cite
 * several sources, and are meant to be read next to a company page, so they
 * need the width. It is also why the sidebar link is a real <Link> — Ctrl+click
 * opens it in its own tab with no extra code, because React Router leaves
 * modified clicks to the browser.
 *
 * Conversation state lives on the server (backend/routers/chat.py), not in
 * component state: a thread has to survive navigating away, closing the tab
 * and reloading, and only "New chat" may end it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { ChatOnboardingDialog } from '@/components/chat/ChatOnboardingDialog'
import { ConversationStack } from '@/components/chat/ConversationStack'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  chatApi, type ChatMessageDto, type ConversationDto, type IndexStats, type LanguageLevel,
} from '@/services/chatApi'
import { cn } from '@/lib/utils'

const STARTER_QUESTIONS = [
  'What are the red flags in Reliance Industries?',
  'What did HDFC Bank management say about margins on the last call?',
  'How is PNC Infratech exposed to commodity prices?',
  'Where do I create a custom ratio in FinScreen?',
]

export function ResearchChat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationParam = searchParams.get('c')

  // Remembered across visits so a returning user is not re-asked their level
  // on every message — the coach mark still shows (that is a per-open thing),
  // but it shows with their previous choice already selected.
  const [languageLevel, setLanguageLevel] = useLocalStorage<LanguageLevel>(
    'finscreen_chat_language_level', 'INTERMEDIATE',
  )

  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(conversationParam)
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null)

  // Shown on every arrival at this page, as specified — it gates the composer
  // until the level has been acknowledged. Not persisted, so it reappears on
  // the next visit but never between messages.
  const [tourOpen, setTourOpen] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Which thread's messages are already in state. The URL is the source of
  // truth for WHICH thread is open, but it also changes as a side effect of
  // sending the first message in a new thread — at which point the messages
  // are already loaded and re-fetching them would just make the view flash.
  const loadedIdRef = useRef<string | null>(null)

  // Held in a ref so the loader effect below does not depend on it. The
  // localStorage setter's identity changes on every write, and with it in the
  // dependency array, changing the language level re-ran the loader, which
  // then set the level straight back to whatever the server had stored — the
  // dropdown visibly snapped back to its old value.
  const applyLanguageLevelRef = useRef(setLanguageLevel)
  applyLanguageLevelRef.current = setLanguageLevel

  const scrollToBottom = useCallback((smooth = true) => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatApi.listConversations()
      setConversations(data.conversations)
      return data.conversations
    } catch {
      // A failed history fetch must not block asking a question — the composer
      // works fine without the rail, so this stays silent rather than throwing
      // an error banner over a working page.
      return []
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
    chatApi.indexStats().then(setIndexStats).catch(() => setIndexStats(null))
  }, [loadConversations])

  // Restore whichever thread the URL points at, so a reload (or a Ctrl+click
  // into a new tab) lands back in the same conversation.
  useEffect(() => {
    if (!conversationParam) {
      loadedIdRef.current = null
      setMessages([])
      setActiveId(null)
      return
    }
    if (conversationParam === loadedIdRef.current) return

    let cancelled = false
    chatApi.getConversation(conversationParam)
      .then(data => {
        if (cancelled) return
        loadedIdRef.current = data.conversation.id
        setActiveId(data.conversation.id)
        setMessages(data.messages)
        applyLanguageLevelRef.current(data.conversation.languageLevel)
        window.setTimeout(() => scrollToBottom(false), 40)
      })
      .catch(() => {
        if (cancelled) return
        // The thread was pruned (only the newest 10 survive) or belongs to
        // someone else — drop back to a fresh chat instead of a dead page.
        setSearchParams({}, { replace: true })
      })
    return () => { cancelled = true }
  }, [conversationParam, setSearchParams, scrollToBottom])

  useEffect(() => { scrollToBottom() }, [messages, sending, scrollToBottom])

  async function handleSend(text?: string) {
    const message = (text ?? draft).trim()
    if (!message || sending) return

    setError(null)
    setDraft('')
    setSending(true)

    // Optimistic echo so the question appears instantly. A real answer takes
    // several seconds (and much longer the first time a company is asked
    // about, while it is indexed), and a composer that just goes quiet for
    // that long reads as broken.
    const optimistic: ChatMessageDto = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: message,
      languageLevel: null,
      citations: [],
      latencyMs: null,
      createdAt: new Date().toISOString(),
    }
    setMessages(previous => [...previous, optimistic])

    try {
      const response = await chatApi.ask(message, languageLevel, activeId ?? undefined)
      setMessages(previous => [
        ...previous.filter(item => item.id !== optimistic.id),
        response.userMessage,
        response.assistantMessage,
      ])
      if (response.conversationId !== activeId) {
        // Mark it loaded BEFORE the URL changes, so the loader effect sees the
        // messages we already have rather than re-fetching what just arrived.
        loadedIdRef.current = response.conversationId
        setActiveId(response.conversationId)
        setSearchParams({ c: response.conversationId }, { replace: true })
      }
      void loadConversations()
    } catch (exc: any) {
      setMessages(previous => previous.filter(item => item.id !== optimistic.id))
      setDraft(message)
      setError(
        exc?.response?.data?.detail ??
        'That question could not be answered right now. Please try again in a moment.',
      )
    } finally {
      setSending(false)
    }
  }

  function handleNewChat() {
    loadedIdRef.current = null
    setActiveId(null)
    setMessages([])
    setDraft('')
    setError(null)
    setSearchParams({}, { replace: true })
  }

  async function handleDelete(id: string) {
    await chatApi.deleteConversation(id).catch(() => undefined)
    if (id === activeId) handleNewChat()
    void loadConversations()
  }

  const indexEmpty = indexStats !== null && !indexStats.ready

  return (
    // 88px = the indices ticker (28) + the topbar (60) that DashboardLayout
    // renders above the scroll area. Pinned to the viewport rather than left
    // to grow, because this page owns its own scrolling: the thread scrolls
    // while the composer stays put, which cannot happen if the page itself is
    // what scrolls.
    <div className="flex h-[calc(100vh-88px)] min-h-130 bg-background">
      {/* Thread rail */}
      <div className="hidden w-57 shrink-0 md:block">
        <ConversationStack
          conversations={conversations}
          activeId={activeId}
          loading={conversationsLoading}
          onSelect={id => setSearchParams({ c: id }, { replace: true })}
          onNew={handleNewChat}
          onDelete={handleDelete}
        />
      </div>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur-sm lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accentSoft">
              <Sparkles className="size-3.5 text-accent" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight text-textPrimary">
                Research Chat
              </h1>
              <p className="truncate text-[11px] text-textMuted">
                Grounded in company filings, transcripts, exposure profiles and market news
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-textSecondary transition-colors hover:border-accent/40 hover:text-accent md:hidden"
          >
            New chat
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            {indexEmpty && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50 px-3.5 py-2.5 dark:bg-amber-950/25">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                  <span className="font-medium">The research index is empty.</span>{' '}
                  Answers will be thin until it is built — run one index cycle
                  (<code className="rounded bg-amber-500/10 px-1">POST /api/chat/index/run</code>)
                  or start the index worker.
                </p>
              </div>
            )}

            {messages.length === 0 && !sending && (
              <div className="pt-6">
                <h2 className="text-lg font-semibold tracking-tight text-textPrimary">
                  What would you like to research?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-textSecondary">
                  I read company fundamentals, business exposure profiles, earnings-call
                  transcripts and market news, and I cite what I used. I lay out both sides —
                  I never tell you what to buy or sell.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {STARTER_QUESTIONS.map(question => (
                    <button
                      key={question}
                      type="button"
                      disabled={tourOpen || sending}
                      onClick={() => void handleSend(question)}
                      className={cn(
                        'rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-xs',
                        'text-textSecondary transition-all duration-150',
                        'hover:border-accent/40 hover:bg-accentSoft hover:text-accent active:scale-[0.99]',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(message => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}

            {sending && (
              <div className="flex items-center gap-3 pl-10">
                <span className="flex gap-1">
                  {[0, 1, 2].map(index => (
                    <span
                      key={index}
                      className="size-1.5 animate-bounce rounded-full bg-accent/60"
                      style={{ animationDelay: `${index * 0.14}s` }}
                    />
                  ))}
                </span>
                <span className="text-[11px] text-textMuted">
                  Searching filings, transcripts and news...
                </span>
              </div>
            )}

            {error && (
              // A plain block rather than the shared InlineError, which maps
              // messages onto its own canned copy — here the backend's actual
              // detail ("GEMINI_API_KEY is missing on the server") is the whole
              // value of the message and must survive to the screen.
              <div className="flex items-start gap-2.5 rounded-xl border border-negative/30 bg-negative/5 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-negative" />
                <p className="text-[11.5px] leading-relaxed text-negative">{error}</p>
              </div>
            )}
          </div>
        </div>

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={() => void handleSend()}
          languageLevel={languageLevel}
          onLanguageLevelChange={setLanguageLevel}
          disabled={tourOpen}
          sending={sending}
          tourActive={tourOpen}
        />
      </div>

      <ChatOnboardingDialog open={tourOpen} onDismiss={() => setTourOpen(false)} />
    </div>
  )
}

export default ResearchChat
