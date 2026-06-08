import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { IndicesTicker } from '@/components/layout/IndicesTicker'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { CommandPalette } from '@/components/shared/CommandPalette'

export function DashboardLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Scroll to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0)
    }
  }, [location.pathname])

  // Ctrl/Cmd+K listener lives here only — Topbar receives onOpenPalette prop
  // and does NOT attach its own window listener, eliminating the race condition
  // where both listeners fired causing the palette to open and immediately close.
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
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
      {/* Sidebar Navigation (Left) */}
      <Sidebar />

      {/* Main Content Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Market Indices Ticker Bar */}
        <IndicesTicker />

        {/* Top Header Bar */}
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />

        {/* Dynamic Route Content
            IMPORTANT: key={location.pathname} has been removed from this wrapper.
            It was causing React to fully unmount+remount every page component on
            every navigation, firing all 9 company API calls on each route change.
            The fade animation is retained via the animate-fade-in-up CSS class. */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Notifications Drawer (Global Portal) */}
      <NotificationCenter />

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

export default DashboardLayout
