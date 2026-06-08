import { useEffect, useState, useRef } from 'react'

/**
 * useIntersectionObserver.ts
 *
 * A robust scroll-spy hook that tracks which section is currently in view
 * inside the <main> scrolling container.
 *
 * Strategy:
 * - Attaches a single scroll listener to the <main> element.
 * - On each scroll event, walks the section list top-to-bottom and marks the
 *   last section whose top edge has scrolled past the "trigger line"
 *   (container's scrollTop + navOffset).
 * - Handles boundary conditions: first section at top, last section when
 *   near the bottom of the scroll container.
 */
export function useIntersectionObserver(
  sectionIds: string[],
  navOffset = 56        // height of sticky subnav inside <main> (approx 56px)
): string {
  const [activeId, setActiveId] = useState<string>('')
  // Track whether external code has locked the active id (e.g. tab click)
  const lockedRef = useRef(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Exposed helper so StickySubNav can temporarily lock the active section
  ;(useIntersectionObserver as any).__lockActive = (id: string, durationMs: number) => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    lockedRef.current = true
    setActiveId(id)
    lockTimerRef.current = setTimeout(() => {
      lockedRef.current = false
    }, durationMs)
  }

  useEffect(() => {
    if (sectionIds.length === 0) return

    // The scroll container is <main>
    const container = document.querySelector('main') as HTMLElement | null
    if (!container) return

    const compute = () => {
      if (lockedRef.current) return   // Locked by tab click – skip

      const scrollTop = container.scrollTop
      const containerHeight = container.clientHeight
      const scrollHeight = container.scrollHeight

      // Boundary: very near the top → first section
      if (scrollTop < 60) {
        setActiveId(sectionIds[0])
        return
      }

      // Boundary: near the bottom → last section
      if (scrollTop + containerHeight >= scrollHeight - 80) {
        setActiveId(sectionIds[sectionIds.length - 1])
        return
      }

      // General: find the last section whose top is above or at the trigger line.
      // We compute the section's absolute offset from the top of <main>'s content.
      // el.getBoundingClientRect().top gives viewport position.
      // container.getBoundingClientRect().top gives viewport position of <main> top.
      // So: absoluteTopInContainer = rect.top - containerRect.top + scrollTop
      const containerTop = container.getBoundingClientRect().top
      const triggerLine = navOffset + 8   // a few pixels below subnav bottom

      let current = sectionIds[0]
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const absoluteTop = rect.top - containerTop + scrollTop
        if (absoluteTop - triggerLine <= scrollTop) {
          current = id
        } else {
          break
        }
      }

      setActiveId(current)
    }

    // Init on mount (after a small delay to let lazy sections render)
    const initTimer = setTimeout(compute, 100)

    container.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute, { passive: true })

    return () => {
      clearTimeout(initTimer)
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      container.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [sectionIds, navOffset])

  return activeId
}
