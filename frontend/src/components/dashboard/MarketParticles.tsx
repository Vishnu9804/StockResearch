import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
}

const PARTICLE_COUNT = 36
const MAX_LINK_DIST  = 130
const PARALLAX_STRENGTH = 0.018

/**
 * Ambient canvas background for the Markets dashboard.
 * Renders floating market-node particles with mouse parallax.
 * Pauses automatically when prefers-reduced-motion is set.
 */
export function MarketParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (prefersReduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let mouseX = 0
    let mouseY = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []

    const isDark = () => document.documentElement.classList.contains('dark')

    function resize() {
      const parent = canvas!.parentElement
      width  = parent ? parent.clientWidth  : window.innerWidth
      height = parent ? parent.clientHeight : window.innerHeight
      canvas!.width  = width
      canvas!.height = height
    }

    function initParticles() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x:       Math.random() * width,
        y:       Math.random() * height,
        vx:      (Math.random() - 0.5) * 0.3,
        vy:      (Math.random() - 0.5) * 0.3,
        radius:  1.5 + Math.random() * 2,
        opacity: 0.04 + Math.random() * 0.1,
      }))
    }

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, width, height)

      const dark = isDark()
      const dotColor   = dark ? '148,163,184' : '37,99,235'
      const lineColor  = dark ? '100,116,139' : '37,99,235'

      // Parallax offset from mouse
      const ox = (mouseX - width  / 2) * PARALLAX_STRENGTH
      const oy = (mouseY - height / 2) * PARALLAX_STRENGTH

      // Draw links between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = (a.x + ox) - (b.x + ox)
          const dy = (a.y + oy) - (b.y + oy)
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_LINK_DIST) {
            const alpha = (1 - dist / MAX_LINK_DIST) * 0.08
            ctx.beginPath()
            ctx.strokeStyle = `rgba(${lineColor},${alpha})`
            ctx.lineWidth = 0.6
            ctx.moveTo(a.x + ox, a.y + oy)
            ctx.lineTo(b.x + ox, b.y + oy)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x + ox, p.y + oy, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${dotColor},${p.opacity})`
        ctx.fill()

        // Move
        p.x += p.vx
        p.y += p.vy

        // Wrap edges
        if (p.x < -10)         p.x = width + 10
        if (p.x > width + 10)  p.x = -10
        if (p.y < -10)         p.y = height + 10
        if (p.y > height + 10) p.y = -10
      })

      rafId = requestAnimationFrame(draw)
    }

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    resize()
    initParticles()
    draw()

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [prefersReduced])

  if (prefersReduced) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}

export default MarketParticles
