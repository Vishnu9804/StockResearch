import { useEffect, useRef } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Price Chart' },
  { id: 'peers', label: 'Peer Comparison' },
  { id: 'quarters', label: 'Quarterly Results' },
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'ratios', label: 'Key Ratios' },
  { id: 'analyst', label: 'Analyst Consensus' },
  { id: 'shareholding', label: 'Shareholding' },
  { id: 'corporate-actions', label: 'Corporate Actions' },
  { id: 'documents', label: 'Documents' },
]

/**
 * Height of this sticky nav bar (py-1 + button py-3 + border ≈ 49px).
 * Must match the navOffset passed to useIntersectionObserver.
 */
const SUBNAV_HEIGHT = 49

export function StickySubNav() {
  const navRef = useRef<HTMLElement>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const sectionIds = SECTIONS.map((s) => s.id)

  // Scroll-spy: pass the subnav height so the trigger line sits just below the bar.
  const activeSection = useIntersectionObserver(sectionIds, SUBNAV_HEIGHT)

  // Keep the active tab visible inside the horizontal scroll container.
  useEffect(() => {
    if (!activeSection) return
    const btn = buttonRefs.current[activeSection]
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [activeSection])

  const handleScrollTo = (id: string) => {
    const container = document.querySelector('main') as HTMLElement | null
    const el = document.getElementById(id)
    if (!container || !el) return

    // Lock the active indicator to the clicked tab while the smooth scroll runs.
    // Duration: generous 1200 ms to cover most scroll distances.
    const lock = (useIntersectionObserver as any).__lockActive
    if (typeof lock === 'function') lock(id, 1200)

    // Compute scroll target: element's absolute top inside the container minus
    // the subnav height so the section header appears just below the bar.
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const absoluteTop = elRect.top - containerRect.top + container.scrollTop
    const targetScrollTop = Math.max(0, absoluteTop - SUBNAV_HEIGHT - 8)

    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      // sticky top-0: sticks at the top of <main> (topbar/ticker are OUTSIDE <main>)
      className="sticky top-0 bg-surface border-b border-border z-20 select-none shadow-sm"
    >
      <div className="flex gap-0.5 overflow-x-auto px-4 py-0.5 scrollbar-hide">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              id={`subnav-${section.id}`}
              ref={(el) => { buttonRefs.current[section.id] = el }}
              onClick={() => handleScrollTo(section.id)}
              className={cn(
                'relative whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none shrink-0',
                isActive
                  ? 'text-accent font-extrabold'
                  : 'text-textSecondary hover:text-textPrimary'
              )}
            >
              {section.label}
              <span
                className={cn(
                  'absolute inset-x-3 bottom-0 h-0.5 bg-accent rounded-t-full transition-transform duration-200 origin-center',
                  isActive ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default StickySubNav
