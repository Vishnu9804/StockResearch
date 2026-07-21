import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import {
  TrendingUp, Search, BookOpen, FolderHeart, Sliders,
  Filter, User, ChevronLeft, ChevronRight, Zap, CreditCard, Activity, Newspaper,
} from 'lucide-react'
import { toggleSidebar, setSidebarCollapsed } from '@/store/slices/uiSlice'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface SidebarItem {
  label: string
  href: string
  icon: any
  authOnly?: boolean
}

const MENU_ITEMS: SidebarItem[] = [
  { label: 'Markets Today', href: '/',             icon: TrendingUp },
  { label: 'Feed',           href: '/feed',        icon: Newspaper },
  { label: 'Stock Screener', href: '/screener',    icon: Search },
  { label: 'Screen Gallery', href: '/screens',     icon: Filter },
  { label: 'Market Pulse',   href: '/market-pulse', icon: Activity },
  { label: 'My Watchlists',  href: '/watchlists',  icon: FolderHeart },
  { label: 'My Portfolio',   href: '/portfolio',   icon: BookOpen, authOnly: true },
  { label: 'Custom Ratios',  href: '/custom-ratios', icon: Sliders },
  { label: 'My Account',     href: '/account',     icon: User },
]

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const dispatch = useAppDispatch()
  const { sidebarCollapsed } = useAppSelector((state) => state.ui)
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const isPro = user?.plan === 'PRO'
  const [tooltip, setTooltip] = useState<string | null>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      dispatch(setSidebarCollapsed(true))
    }
  }, [pathname, dispatch])

  const activeItem = MENU_ITEMS.find(item =>
    pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  ) ?? MENU_ITEMS[0]

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            className="lg:hidden fixed inset-0 z-40 bg-textPrimary/30 backdrop-blur-sm"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dispatch(setSidebarCollapsed(true))}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'bg-surface border-r border-border flex flex-col h-screen z-50 select-none',
          'fixed lg:sticky top-0 left-0',
          'transition-[width,transform] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]',
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-[60px]' : 'translate-x-0 w-[220px]',
          'shadow-[var(--shadow-lg)] lg:shadow-none',
        )}
      >
        {/* Brand */}
        <div className="h-[60px] flex items-center justify-between px-3.5 border-b border-border shrink-0">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <motion.div
              className="size-8 rounded-xl bg-accent flex items-center justify-center font-medium text-white shrink-0 shadow-[var(--shadow-accent)] text-xs tracking-tight"
              whileHover={prefersReduced ? {} : { scale: 1.08, rotate: 3 }}
              whileTap={prefersReduced ? {} : { scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              FS
            </motion.div>
            {!sidebarCollapsed && (
              <span className="font-medium text-textPrimary tracking-tight text-base truncate">
                Fin<span className="text-accent">Screen</span>
              </span>
            )}
          </Link>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => dispatch(toggleSidebar())}
              className="size-7 text-textMuted hover:text-textSecondary shrink-0"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            const isLocked = Boolean(item.authOnly) && !isAuthenticated
            const tooltipLabel = isLocked ? `${item.label} (log in to access)` : item.label

            const linkContent = (
              <>
                {/* Animated active background pill */}
                {isActive && !isLocked && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-accentSoft rounded-lg"
                    transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                <Icon
                  className={cn(
                    'size-4 shrink-0 relative z-10 transition-all duration-150',
                    isLocked ? 'text-textMuted/50' : isActive ? 'text-accent' : 'text-textMuted'
                  )}
                />
                {!sidebarCollapsed && (
                  <span className="truncate relative z-10">{item.label}</span>
                )}
                {isActive && !isLocked && !sidebarCollapsed && (
                  <motion.span
                    className="ml-auto size-1.5 rounded-full bg-accent shrink-0 relative z-10"
                    initial={prefersReduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  />
                )}
              </>
            )

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => sidebarCollapsed ? setTooltip(item.label) : null}
                onMouseLeave={() => setTooltip(null)}
              >
                {isLocked ? (
                  <div
                    aria-disabled="true"
                    title="Log in to access your portfolio"
                    className={cn(
                      'relative flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-xs font-medium z-10',
                      'text-textMuted/50 cursor-not-allowed select-none',
                      sidebarCollapsed ? 'justify-center' : ''
                    )}
                  >
                    {linkContent}
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      'relative flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-xs font-medium z-10',
                      'transition-colors duration-150',
                      isActive ? 'text-accent' : 'text-textSecondary hover:text-textPrimary',
                      sidebarCollapsed ? 'justify-center' : ''
                    )}
                  >
                    {linkContent}
                  </Link>
                )}

                {/* Tooltip (collapsed) */}
                <AnimatePresence>
                  {sidebarCollapsed && tooltip === item.label && (
                    <motion.div
                      className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                      initial={prefersReduced ? false : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={prefersReduced ? undefined : { opacity: 0, x: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="bg-textPrimary text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-[var(--shadow-lg)] whitespace-nowrap">
                        {tooltipLabel}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-textPrimary rotate-45" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        {/* Bottom: Pricing + Upgrade */}
        <div className="px-2.5 pb-3 border-t border-border space-y-0.5 pt-2">
          <div
            className="relative"
            onMouseEnter={() => sidebarCollapsed ? setTooltip('Pricing & Pro') : null}
            onMouseLeave={() => setTooltip(null)}
          >
            <Link
              to="/pricing"
              className={cn(
                'flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-xs font-medium',
                'text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-all duration-150',
                sidebarCollapsed ? 'justify-center' : ''
              )}
            >
              <CreditCard className="size-4 shrink-0 text-textMuted" />
              {!sidebarCollapsed && <span>Pricing & Pro</span>}
            </Link>
            <AnimatePresence>
              {sidebarCollapsed && tooltip === 'Pricing & Pro' && (
                <motion.div
                  className="absolute left-[52px] top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                  initial={prefersReduced ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReduced ? undefined : { opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="bg-textPrimary text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-[var(--shadow-lg)] whitespace-nowrap">
                    Pricing & Pro
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-textPrimary rotate-45" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!sidebarCollapsed && (
            <motion.div
              className="bg-gradient-to-br from-accentSoft to-accentSoft/50 border border-accent/20 rounded-xl p-3 mt-1"
              initial={prefersReduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {isPro ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-accent uppercase tracking-wider">
                    <Zap className="size-3" />
                    Pro Member
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-textSecondary">
                    Full access — 15-year histories, unlimited watchlists and custom ratios.
                  </p>
                  <Link
                    to="/account"
                    className="mt-2 flex w-full items-center justify-center rounded-lg border border-accent/30 bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:bg-accentSoft transition-colors"
                  >
                    Manage Account
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-accent uppercase tracking-wider">
                    <Zap className="size-3" />
                    Standard Feed
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-textSecondary">
                    Unlock 15-year histories and custom filters.
                  </p>
                  <Link
                    to="/pricing"
                    className="mt-2 flex w-full items-center justify-center rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors shadow-[var(--shadow-accent)]"
                  >
                    Upgrade to Pro
                  </Link>
                </>
              )}
            </motion.div>
          )}

          {sidebarCollapsed && (
            <div className="flex justify-center pt-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dispatch(toggleSidebar())}
                className="size-7 text-textMuted hover:text-textSecondary"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
