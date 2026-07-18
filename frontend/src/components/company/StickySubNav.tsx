import { useEffect, useRef, useState } from 'react'
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
  { id: 'operating-ratios', label: 'Operating Ratios' },
  { id: 'analyst', label: 'Analyst Consensus' },
  { id: 'shareholding', label: 'Shareholding' },
  { id: 'corporate-actions', label: 'Corporate Actions' },
  { id: 'auditor-notes', label: 'Auditor Notes' },
  { id: 'documents', label: 'Documents' },
]

/**
 * Height of this sticky nav bar (py-1 + button py-3 + border ≈ 49px).
 * Must match the navOffset passed to useIntersectionObserver.
 */
const SUBNAV_HEIGHT = 49


export function StickySubNav() {
  const navRef = useRef<HTMLElement>(null)
  const hScrollRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const sectionIds = SECTIONS.map((s) => s.id)

  const [scrollingTarget, setScrollingTarget] = useState<string | null>(null)
  const scrollingTargetRef = useRef<string | null>(null)

  const setScrollingTargetWithRef = (target: string | null) => {
    scrollingTargetRef.current = target
    setScrollingTarget(target)
  }

  // Scroll-spy: pass the subnav height so the trigger line sits just below the bar.
  // Pass scrollingTarget to lock the active section state during smooth scrolls.
  const activeSection = useIntersectionObserver(sectionIds, SUBNAV_HEIGHT, scrollingTarget)

  // Keep the active tab visible inside the horizontal scroll container.
  // NOTE: this must only scroll the nav's own horizontal strip — not use
  // btn.scrollIntoView(), which walks up every scrollable ancestor (including
  // <main>) and cancels/resets the vertical scrollTo triggered by handleScrollTo.
  useEffect(() => {
    if (!activeSection) return
    const btn = buttonRefs.current[activeSection]
    const scrollEl = hScrollRef.current
    if (!btn || !scrollEl) return

    const btnLeft = btn.offsetLeft
    const btnRight = btnLeft + btn.offsetWidth
    const viewLeft = scrollEl.scrollLeft
    const viewRight = viewLeft + scrollEl.clientWidth

    if (btnLeft < viewLeft || btnRight > viewRight) {
      const targetLeft = btnLeft - (scrollEl.clientWidth - btn.offsetWidth) / 2
      scrollEl.scrollTo({ left: targetLeft, behavior: 'smooth' })
    }
  }, [activeSection])

  const calculateTargetScrollTop = (container: HTMLElement, el: HTMLElement) => {
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const absoluteTop = elRect.top - containerRect.top + container.scrollTop
    return Math.max(0, absoluteTop - SUBNAV_HEIGHT - 8)
  }

  const adjustScrollPosition = () => {
    const targetId = scrollingTargetRef.current
    if (!targetId) return
    const container = document.querySelector('main') as HTMLElement | null
    const el = document.getElementById(targetId)
    if (!container || !el) return

    const targetScrollTop = calculateTargetScrollTop(container, el)

    // Only scroll if the difference is significant (e.g. > 5px) to avoid infinite loop / jitter
    if (Math.abs(container.scrollTop - targetScrollTop) > 5) {
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    }
  }

  // 1. Observe layout shifts (resizes) of the content inside <main> and adjust scroll
  useEffect(() => {
    const container = document.querySelector('main') as HTMLElement | null
    if (!container) return

    const content = container.firstElementChild as HTMLElement | null
    if (!content) return

    const observer = new ResizeObserver(() => {
      if (scrollingTargetRef.current) {
        adjustScrollPosition()
      }
    })

    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // 2. Detect user interaction / scroll interruptions and unlock scroll spy
  useEffect(() => {
    const container = document.querySelector('main') as HTMLElement | null
    if (!container) return

    const handleUserInteraction = () => {
      if (scrollingTargetRef.current) {
        setScrollingTargetWithRef(null)
      }
    }

    container.addEventListener('wheel', handleUserInteraction, { passive: true })
    container.addEventListener('touchmove', handleUserInteraction, { passive: true })
    container.addEventListener('keydown', handleUserInteraction, { passive: true })
    container.addEventListener('mousedown', handleUserInteraction, { passive: true })

    return () => {
      container.removeEventListener('wheel', handleUserInteraction)
      container.removeEventListener('touchmove', handleUserInteraction)
      container.removeEventListener('keydown', handleUserInteraction)
      container.removeEventListener('mousedown', handleUserInteraction)
    }
  }, [])

  // 3. Monitor scroll end to release the scrolling target lock
  useEffect(() => {
    const container = document.querySelector('main') as HTMLElement | null
    if (!container) return

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null

    const handleScrollEnd = () => {
      const targetId = scrollingTargetRef.current
      if (targetId) {
        const el = document.getElementById(targetId)
        if (el) {
          const rect = el.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          const diff = Math.abs(rect.top - containerRect.top - (SUBNAV_HEIGHT + 8))
          const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 5

          // Release lock if we reached close to target, or hit the absolute bottom of page
          if (diff < 15 || isAtBottom) {
            setScrollingTargetWithRef(null)
          }
        } else {
          setScrollingTargetWithRef(null)
        }
      }
    }

    const onScroll = () => {
      if (!scrollingTargetRef.current) return
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(handleScrollEnd, 150)
    }

    const hasScrollEnd = 'onscrollend' in window

    if (hasScrollEnd) {
      container.addEventListener('scrollend', handleScrollEnd, { passive: true })
    }
    container.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      if (hasScrollEnd) {
        container.removeEventListener('scrollend', handleScrollEnd)
      }
      container.removeEventListener('scroll', onScroll)
    }
  }, [])

  const handleScrollTo = (id: string) => {
    const container = document.querySelector('main') as HTMLElement | null
    const el = document.getElementById(id)
    if (!container || !el) return

    const targetScrollTop = calculateTargetScrollTop(container, el)

    // If already at target, don't trigger scrolling locks
    if (Math.abs(container.scrollTop - targetScrollTop) < 5) {
      setScrollingTargetWithRef(null)
      return
    }

    setScrollingTargetWithRef(id)
    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      // sticky top-0: sticks at the top of <main> (topbar/ticker are OUTSIDE <main>)
      className="sticky top-0 bg-surface border-b border-border z-20 select-none shadow-sm"
    >
      <div ref={hScrollRef} className="flex gap-0.5 overflow-x-auto px-4 py-0.5 scrollbar-hide">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              id={`subnav-${section.id}`}
              ref={(el) => { buttonRefs.current[section.id] = el }}
              onClick={() => handleScrollTo(section.id)}
              className={cn(
                'relative whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider transition-colors focus:outline-none shrink-0',
                isActive
                  ? 'text-accent font-medium'
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

