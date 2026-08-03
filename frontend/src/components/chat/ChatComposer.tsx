/**
 * The message box: textarea, language-level picker, send button.
 *
 * Disabled until the onboarding coach mark is dismissed (see
 * ChatOnboardingDialog) — the level applies to the answer, so it is chosen
 * before the first question rather than explained after it.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { LanguageLevelSelect } from './LanguageLevelSelect'
import type { LanguageLevel } from '@/services/chatApi'
import { cn } from '@/lib/utils'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  languageLevel: LanguageLevel
  onLanguageLevelChange: (level: LanguageLevel) => void
  disabled?: boolean
  sending?: boolean
  /** True while the coach mark is pointing at the level dropdown. */
  tourActive?: boolean
  maxChars?: number
}

const MIN_HEIGHT = 44
const MAX_HEIGHT = 180

export function ChatComposer({
  value,
  onChange,
  onSend,
  languageLevel,
  onLanguageLevelChange,
  disabled,
  sending,
  tourActive,
  maxChars = 2000,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow with content up to a cap, then scroll. Done here rather than with CSS
  // field-sizing so it degrades predictably in browsers that don't support it.
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`
  }, [value])

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const canSend = !disabled && !sending && value.trim().length > 0 && value.length <= maxChars

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line — the convention every chat
    // interface uses, so doing anything else here would just surprise people.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  const overLimit = value.length > maxChars

  return (
    <div className="border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-sm lg:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            'rounded-2xl border bg-background transition-colors',
            overLimit ? 'border-negative/60' : 'border-border focus-within:border-accent/50',
            disabled && 'opacity-60',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            rows={1}
            placeholder={
              disabled
                ? 'Choose your language level above to start...'
                : 'Ask about a company, a sector, market news, or how to use FinScreen...'
            }
            className={cn(
              'w-full resize-none bg-transparent px-4 pt-3 text-sm text-textPrimary',
              'placeholder:text-textMuted focus:outline-none',
              'disabled:cursor-not-allowed',
            )}
            style={{ minHeight: MIN_HEIGHT }}
          />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
            <LanguageLevelSelect
              value={languageLevel}
              onChange={onLanguageLevelChange}
              disabled={sending}
              highlighted={tourActive}
            />

            <div className="flex items-center gap-2">
              {value.length > maxChars * 0.8 && (
                <span className={cn('text-[11px] tabular-nums', overLimit ? 'text-negative' : 'text-textMuted')}>
                  {value.length}/{maxChars}
                </span>
              )}
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-all duration-150',
                  canSend
                    ? 'bg-accent text-white shadow-[var(--shadow-accent)] hover:bg-accent/90 active:scale-95'
                    : 'cursor-not-allowed bg-surfaceMuted text-textMuted',
                )}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* The standing disclaimer. Here rather than appended to every answer,
            which is why the system prompt forbids the model repeating it. */}
        <p className="mt-2 px-1 text-center text-[11px] leading-snug text-textMuted">
          Research only — never buy/sell advice. Always verify against the linked sources
          before acting on anything.
        </p>
      </div>
    </div>
  )
}

export default ChatComposer
