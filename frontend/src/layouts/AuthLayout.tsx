import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { authPageVariants } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function AuthLayout() {
  const location = useLocation()
  const prefersReduced = useReducedMotion()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accentSoft/30 flex flex-col items-center justify-center p-6 select-none font-sans antialiased">
      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Brand mark */}
      <motion.div
        className="mb-6 flex items-center gap-2.5 relative z-10"
        initial={prefersReduced ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="size-9 rounded-xl bg-accent flex items-center justify-center font-black text-white shadow-[var(--shadow-accent)] text-sm tracking-tight">
          FS
        </div>
        <span className="font-bold text-textPrimary tracking-tight text-xl">
          Fin<span className="text-accent">Screen</span>
        </span>
      </motion.div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-[var(--shadow-lg)] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={prefersReduced ? undefined : authPageVariants}
            initial={prefersReduced ? false : 'initial'}
            animate="animate"
            exit={prefersReduced ? undefined : 'exit'}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer note */}
      <p className="relative z-10 mt-6 text-[10px] text-textMuted font-medium">
        &copy; {new Date().getFullYear()} FinScreen &middot; Institutional-grade equity research
      </p>
    </div>
  )
}

export default AuthLayout
