import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { IndicesTicker } from '@/components/layout/IndicesTicker'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { AuthGuard } from '@/components/shared/AuthGuard'
import { CommandPalette } from '@/components/shared/CommandPalette'

export function DashboardLayout() {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)

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
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
        {/* Sidebar Navigation (Left) */}
        <Sidebar />

        {/* Main Content Area (Right) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Market Indices Ticker Bar */}
          <IndicesTicker />

          {/* Top Header Bar */}
          <Topbar onOpenPalette={() => setPaletteOpen(true)} />

          {/* Dynamic Route Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
            <div key={location.pathname} className="animate-fade-in-up">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Notifications Drawer (Global Portal) */}
        <NotificationCenter />

        {/* Global Command Palette */}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </AuthGuard>
  )
}

export default DashboardLayout
