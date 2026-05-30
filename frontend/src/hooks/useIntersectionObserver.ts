'use client'

import { useEffect, useState } from 'react'

/**
 * useIntersectionObserver.ts
 * Observes a list of section IDs and returns the ID of the section that is currently in view
 */
export function useIntersectionObserver(
  sectionIds: string[],
  options: IntersectionObserverInit = { threshold: 0.3, rootMargin: '-10% 0px -70% 0px' }
): string {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observers = new Map<string, IntersectionObserver>()

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id)
        }
      });
    };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) {
        const observer = new IntersectionObserver(callback, options)
        observer.observe(el)
        observers.set(id, observer)
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [sectionIds, options])

  return activeId
}
