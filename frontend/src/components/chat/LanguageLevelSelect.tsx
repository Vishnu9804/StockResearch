/**
 * The language-level picker that sits beside the send button.
 *
 * Built as a plain popover rather than the shared ui/select because each
 * option needs two lines — a label and a one-line explanation of how that
 * level READS. Without the second line the control is ambiguous in exactly
 * the way that matters: users assume "Analyst level" means better answers.
 * It does not, and the copy here (and the footnote at the bottom of the menu)
 * is the only place that can say so.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, GraduationCap } from 'lucide-react'
import { LANGUAGE_LEVELS, type LanguageLevel } from '@/services/chatApi'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

interface LanguageLevelSelectProps {
  value: LanguageLevel
  onChange: (value: LanguageLevel) => void
  disabled?: boolean
  /** Set while the onboarding dialog is pointing at this control. */
  highlighted?: boolean
}

export function LanguageLevelSelect({
  value,
  onChange,
  disabled,
  highlighted,
}: LanguageLevelSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()
  const active = LANGUAGE_LEVELS.find(level => level.value === value) ?? LANGUAGE_LEVELS[1]

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      // While the coach mark is up it draws a scrim over the page (z-60). This
      // control has to sit ABOVE that scrim, or the card would be pointing at
      // a dropdown its own backdrop has made unclickable — telling the user to
      // use a control they cannot reach. Lifting it turns the scrim into a
      // spotlight instead of a blocker.
      className={cn('relative', highlighted && 'z-62')}
      data-chat-tour="language-level"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium',
          'transition-all duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          highlighted
            ? 'border-accent bg-accentSoft text-accent shadow-[0_0_0_4px_var(--fs-accent-soft,rgba(59,130,246,0.18))]'
            : 'border-border bg-surface text-textSecondary hover:border-accent/40 hover:text-accent',
        )}
      >
        <GraduationCap className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={prefersReduced ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute bottom-full right-0 z-50 mb-2 w-68 overflow-hidden rounded-xl',
              'border border-border bg-surface shadow-[var(--shadow-lg)]',
            )}
          >
            <div className="border-b border-border/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-textMuted">
                Answer language
              </p>
            </div>

            {LANGUAGE_LEVELS.map(level => {
              const selected = level.value === value
              return (
                <button
                  key={level.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(level.value); setOpen(false) }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                    selected ? 'bg-accentSoft' : 'hover:bg-surfaceMuted',
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0',
                      selected ? 'text-accent' : 'text-transparent',
                    )}
                  />
                  <span className="min-w-0">
                    <span className={cn(
                      'block text-xs font-medium',
                      selected ? 'text-accent' : 'text-textPrimary',
                    )}>
                      {level.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-textMuted">
                      {level.hint}
                    </span>
                  </span>
                </button>
              )
            })}

            {/* The contract, stated where the choice is made. */}
            <div className="border-t border-border/60 bg-surfaceMuted/50 px-3 py-2">
              <p className="text-[10.5px] leading-snug text-textMuted">
                Changes the wording only — the research, the sources and the accuracy are
                identical at every level.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LanguageLevelSelect
