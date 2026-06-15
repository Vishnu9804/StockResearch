import { useEffect, useState } from 'react'

/**
 * useIntersectionObserver.ts
 *
 * A robust scroll-spy hook that tracks which section is currently in view
 * inside the <main> scrolling container.
 */
export function useIntersectionObserver(
  sectionIds: string[],
  navOffset = 56,        // height of sticky subnav inside <main> (approx 56px)
  scrollingTarget: string | null = null
): string {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (sectionIds.length === 0) return

    // The scroll container is <main>
    const container = document.querySelector('main') as HTMLElement | null
    if (!container) return

    const compute = () => {
      // If we are actively scrolling to a target, lock to that target
      if (scrollingTarget) {
        setActiveId(scrollingTarget)
        return
      }

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

    // Compute immediately if scrollingTarget changes
    if (scrollingTarget) {
      setActiveId(scrollingTarget)
    }

    container.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute, { passive: true })

    return () => {
      clearTimeout(initTimer)
      container.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [sectionIds, navOffset, scrollingTarget])

  return activeId || scrollingTarget || sectionIds[0] || ''
}

