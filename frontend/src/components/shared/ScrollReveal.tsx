import React, { useEffect, useRef, useState } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  /** Delay before reveal animation in ms (default: 0) */
  delay?: number
}

export function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Respect user motion preferences — reveal immediately
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mq.matches) {
        setIsRevealed(true)
        return
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setIsRevealed(true), delay)
          } else {
            setIsRevealed(true)
          }
          observer.disconnect()
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -32px 0px' },
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: delay > 0 ? `${delay}ms` : undefined }}
      className={[
        className,
        'transition-[opacity,transform] duration-500 ease-out will-change-[opacity,transform]',
        isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default ScrollReveal
