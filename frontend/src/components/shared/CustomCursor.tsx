import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import gsap from 'gsap'

/**
 * Custom GSAP cursor — desktop only (hidden on touch devices via CSS).
 * Two layers: a small dot (fast) + a larger ring (lagged follow).
 * Expands + tints to accent on hover over interactive elements.
 * Disabled on prefers-reduced-motion.
 */
export function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (prefersReduced) return
    if (!mounted) return

    const dot  = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    // Set initial position off-screen
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 })

    // Fast setters for performance
    const moveDot  = gsap.quickTo(dot,  'x', { duration: 0.12, ease: 'power3.out' })
    const moveDotY = gsap.quickTo(dot,  'y', { duration: 0.12, ease: 'power3.out' })
    const moveRing = gsap.quickTo(ring, 'x', { duration: 0.38, ease: 'power2.out' })
    const moveRingY= gsap.quickTo(ring, 'y', { duration: 0.38, ease: 'power2.out' })

    let hidden = false

    function onMouseMove(e: MouseEvent) {
      moveDot(e.clientX);  moveDotY(e.clientY)
      moveRing(e.clientX); moveRingY(e.clientY)
      if (hidden) {
        gsap.to([dot, ring], { opacity: 1, duration: 0.15 })
        hidden = false
      }
    }

    function onMouseLeave() {
      gsap.to([dot, ring], { opacity: 0, duration: 0.2 })
      hidden = true
    }

    function onMouseEnterInteractive(e: MouseEvent) {
      const target = e.currentTarget as HTMLElement
      const type = target.dataset.cursor
      if (type === 'data') {
        // Shrink to crosshair for table/chart areas
        gsap.to(ring, { width: 18, height: 18, borderColor: 'rgba(37,99,235,0.4)', duration: 0.2 })
      } else {
        // Default interactive expansion
        gsap.to(ring, { width: 44, height: 44, borderColor: 'rgba(37,99,235,0.7)', duration: 0.2 })
        gsap.to(dot,  { scale: 0.5, duration: 0.2 })
      }
    }

    function onMouseLeaveInteractive() {
      gsap.to(ring, { width: 28, height: 28, borderColor: 'rgba(37,99,235,0.45)', duration: 0.25 })
      gsap.to(dot,  { scale: 1, duration: 0.2 })
    }

    // Attach to document
    document.addEventListener('mousemove', onMouseMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onMouseLeave)

    // Delegate hover on interactive elements
    function attachInteractiveListeners() {
      document.querySelectorAll<HTMLElement>('a, button, [role="button"], [data-cursor]').forEach(el => {
        el.addEventListener('mouseenter', onMouseEnterInteractive)
        el.addEventListener('mouseleave', onMouseLeaveInteractive)
      })
    }

    attachInteractiveListeners()

    // Re-attach on DOM changes (e.g. route changes add new buttons)
    const mo = new MutationObserver(attachInteractiveListeners)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.documentElement.removeEventListener('mouseleave', onMouseLeave)
      mo.disconnect()
    }
  }, [prefersReduced, mounted])

  if (prefersReduced) return null
  if (!mounted) return null

  return createPortal(
    <>
      {/* Inner dot — fast */}
      <div
        ref={dotRef}
        className="cursor-dot fixed top-0 left-0 pointer-events-none rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: 'rgba(37,99,235,0.85)',
          willChange: 'transform',
          zIndex: 2147483647,
        }}
        aria-hidden="true"
      />
      {/* Outer ring — lagged */}
      <div
        ref={ringRef}
        className="cursor-ring fixed top-0 left-0 pointer-events-none rounded-full"
        style={{
          width: 28,
          height: 28,
          border: '1.5px solid rgba(37,99,235,0.45)',
          backgroundColor: 'transparent',
          willChange: 'transform',
          zIndex: 2147483646,
        }}
        aria-hidden="true"
      />
    </>,
    document.body
  )
}

export default CustomCursor
