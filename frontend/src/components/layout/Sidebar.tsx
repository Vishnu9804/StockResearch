import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import {
  TrendingUp,
  Search,
  BookOpen,
  FolderHeart,
  Sliders,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import { toggleSidebar, setSidebarCollapsed } from '@/store/slices/uiSlice'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarItem {
  label: string
  href: string
  icon: any
}

const MENU_ITEMS: SidebarItem[] = [
  { label: 'Markets Today', href: '/', icon: TrendingUp },
  { label: 'Stock Screener', href: '/screener', icon: Search },
  { label: 'Screen Gallery', href: '/screens', icon: Filter },
  { label: 'My Watchlists', href: '/watchlists', icon: FolderHeart },
  { label: 'My Portfolio', href: '/portfolio', icon: BookOpen },
  { label: 'Custom Ratios', href: '/custom-ratios', icon: Sliders },
  { label: 'My Account', href: '/account', icon: User },
]

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const dispatch = useAppDispatch()
  const { sidebarCollapsed } = useAppSelector((state) => state.ui)
  const [tooltip, setTooltip] = useState<string | null>(null)

  // Collapse sidebar by default on mobile or tablet screens (< 1024px)
  // This runs on initial mount and whenever the user navigates to a new page
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      dispatch(setSidebarCollapsed(true))
    }
  }, [pathname, dispatch])

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!sidebarCollapsed && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => dispatch(setSidebarCollapsed(true))}
        />
      )}
      <aside
        className={cn(
          'bg-surface border-r border-border flex flex-col h-screen transition-all duration-300 select-none z-50',
          'fixed lg:sticky top-0 left-0',
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="size-8 rounded-lg bg-accent flex items-center justify-center font-bold text-white shrink-0 shadow-none">
              FS
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-textPrimary tracking-tight text-lg">
                Fin<span className="text-accent">Screen</span>
              </span>
            )}
          </Link>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleSidebar())}
              className="size-7 text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted shrink-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
        </div>

        {/* Sidebar Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => sidebarCollapsed ? setTooltip(item.label) : null}
                onMouseLeave={() => setTooltip(null)}
              >
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase',
                    isActive
                      ? 'bg-accentSoft text-accent border-l-2 border-accent rounded-l-none'
                      : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-transform duration-200',
                      isActive ? 'text-accent scale-110' : 'text-textSecondary'
                    )}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Upgrade Callout & Premium Indicators */}
        <div className="p-3 border-t border-border space-y-1">
          <div
            className="relative"
            onMouseEnter={() => sidebarCollapsed ? setTooltip('Pricing & Pro') : null}
            onMouseLeave={() => setTooltip(null)}
          >
            <Link
              to="/pricing"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted'
              )}
            >
              <CreditCard className="size-4 shrink-0 text-textSecondary" />
              {!sidebarCollapsed && <span>Pricing &amp; Pro</span>}
            </Link>
            {sidebarCollapsed && tooltip === 'Pricing & Pro' && (
              <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                <div className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                  Pricing &amp; Pro
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45" />
                </div>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="bg-surfaceMuted border border-border/80 rounded-lg p-3 mt-2 shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-textMuted uppercase tracking-wider">
                <ShieldCheck className="size-3 text-accent" />
                Standard Feed
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-textSecondary">
                Unlock 15-year histories and custom filters.
              </p>
              <Button
                asChild
                size="sm"
                className="w-full mt-2 bg-accent hover:bg-accent/90 text-[11px] font-bold text-white h-7 shadow-none"
              >
                <Link to="/pricing">Upgrade to Pro</Link>
              </Button>
            </div>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="p-3 flex justify-center border-t border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleSidebar())}
              className="size-7 text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </aside>
    </>
  )
}
