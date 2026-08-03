/**
 * The one-time (per visit) coach mark that points at the language-level
 * dropdown before the user can type.
 *
 * It measures the real control at runtime — via the data-chat-tour attribute
 * rather than a hardcoded offset — so the arrow keeps pointing at the dropdown
 * when the sidebar collapses, the window resizes, or the composer reflows on a
 * narrow screen. A coach mark whose arrow drifts off its target is worse than
 * none, and hardcoded coordinates drift the first time anything moves.
 *
 * The composer stays disabled until "Got it" is pressed. That is intentional
 * and is the only moment in the product where input is gated: the level
 * setting shapes every answer in the thread, so it is worth two seconds up
 * front and never asked about again.
 */
import { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface ChatOnboardingDialogProps {
  open: boolean
  onDismiss: () => void
}

const CARD_WIDTH = 320
const GAP_ABOVE_TARGET = 18
const VIEWPORT_MARGIN = 12

interface Anchor {
  /** Left edge of the card, clamped to the viewport. */
  left: number
  /** Bottom edge of the card = top of the target minus the gap. */
  bottom: number
  /** Arrow x, in card-local coordinates, so it points at the target's centre. */
  arrowLeft: number
}

export function ChatOnboardingDialog({ open, onDismiss }: ChatOnboardingDialogProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const prefersReduced = useReducedMotion()

  useLayoutEffect(() => {
    if (!open) return

    function measure() {
      const target = document.querySelector('[data-chat-tour="language-level"]')
      if (!target) { setAnchor(null); return }
      const rect = target.getBoundingClientRect()
      const targetCentre = rect.left + rect.width / 2

      const maxLeft = window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
      const left = Math.max(VIEWPORT_MARGIN, Math.min(targetCentre - CARD_WIDTH / 2, maxLeft))

      setAnchor({
        left,
        bottom: window.innerHeight - rect.top + GAP_ABOVE_TARGET,
        // Clamped away from the rounded corners so the arrow never overlaps them.
        arrowLeft: Math.min(Math.max(targetCentre - left, 22), CARD_WIDTH - 22),
      })
    }

    measure()
    window.addEventListener('resize', measure)
    // The sidebar animates its width; re-measure until that settles so the
    // arrow doesn't end up pointing at where the control used to be.
    const settle = window.setTimeout(measure, 320)
    return () => {
      window.removeEventListener('resize', measure)
      window.clearTimeout(settle)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onDismiss])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Light scrim. Deliberately not a full modal backdrop — the page
              behind stays readable so this reads as a pointer, not a wall. */}
          <motion.div
            className="fixed inset-0 z-60 bg-textPrimary/10 backdrop-blur-[1.5px]"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="How answers are written"
            className="fixed z-61"
            style={
              anchor
                ? { left: anchor.left, bottom: anchor.bottom, width: CARD_WIDTH }
                : { left: '50%', bottom: '50%', width: CARD_WIDTH, transform: 'translate(-50%, 50%)' }
            }
            initial={prefersReduced ? false : { opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div className="relative rounded-2xl border border-accent/25 bg-surface p-4 shadow-[var(--shadow-lg)]">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-accentSoft">
                  <Sparkles className="size-3.5 text-accent" />
                </span>
                <h2 className="text-sm font-semibold tracking-tight text-textPrimary">
                  Pick how I should explain things
                </h2>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-textSecondary">
                Use the dropdown below to tell me how much market jargon you're comfortable with.
                It only changes the <span className="font-medium text-textPrimary">words I use</span> —
                the research behind every answer stays exactly the same.
              </p>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-textMuted">You can change it any time.</span>
                <Button size="sm" onClick={onDismiss} autoFocus>
                  Got it
                </Button>
              </div>

              {/* Arrow: a rotated square sharing the card's border and fill, so
                  it reads as part of the card rather than a stuck-on triangle. */}
              {anchor && (
                <motion.span
                  className="absolute size-3 rotate-45 rounded-[2px] border-b border-r border-accent/25 bg-surface"
                  style={{ left: anchor.arrowLeft - 6, bottom: -6.5 }}
                  animate={prefersReduced ? undefined : { y: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ChatOnboardingDialog
