'use client'

import { Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
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
import { toggleSidebar } from '@/store/slices/uiSlice'
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
  const dispatch = useDispatch()
  const { sidebarCollapsed } = useSelector((state: any) => state.ui)

  return (
    <aside
      className={cn(
        'bg-surface border-r border-border flex flex-col h-screen transition-all duration-300 select-none sticky top-0 z-40',
        sidebarCollapsed ? 'w-16' : 'w-64'
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
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase',
                isActive
                  ? 'bg-accentSoft text-accent border-l-2 border-accent rounded-l-none'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted'
              )}
            >
              <Icon className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-textSecondary')} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade Callout & Premium Indicators */}
      <div className="p-3 border-t border-border space-y-1">
        <Link
          to="/pricing"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted'
          )}
        >
          <CreditCard className="size-4 shrink-0 text-textSecondary" />
          {!sidebarCollapsed && <span>Pricing & Pro</span>}
        </Link>

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
  )
}
