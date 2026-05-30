import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { IndicesTicker } from '@/components/layout/IndicesTicker'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { AuthGuard } from '@/components/shared/AuthGuard'

export function DashboardLayout() {
  const location = useLocation()
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
          <Topbar />

          {/* Dynamic Route Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
            <div key={location.pathname} className="animate-fade-in-up">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Notifications Drawer (Global Portal) */}
        <NotificationCenter />
      </div>
    </AuthGuard>
  )
}

export default DashboardLayout
