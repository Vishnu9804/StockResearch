import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { IndicesTicker } from '@/components/layout/IndicesTicker'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { pageVariants } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useDispatch } from 'react-redux'
import { fetchStockSymbols } from '@/store/slices/searchSlice'

export function DashboardLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const prefersReduced = useReducedMotion()
  const dispatch = useDispatch()

  // Load global stock symbols cache on startup
  useEffect(() => {
    dispatch(fetchStockSymbols() as any)
  }, [dispatch])

  // Scroll to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0)
    }
  }, [location.pathname])

  // Ctrl/Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans antialiased text-textPrimary">
      {/* Sidebar */}
      <Sidebar />

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Ticker */}
        <IndicesTicker />

        {/* Topbar */}
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />

        {/* Main scrollable area with page transitions */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-background"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={prefersReduced ? undefined : pageVariants}
              initial={prefersReduced ? false : 'initial'}
              animate="animate"
              exit={prefersReduced ? undefined : 'exit'}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <NotificationCenter />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

export default DashboardLayout
