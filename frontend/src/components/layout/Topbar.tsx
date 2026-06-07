import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Search, Bell, Menu, Moon, Sun, X, User as UserIcon, LogOut, Settings, ShieldAlert } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { toggleSidebar } from '@/store/slices/uiSlice'
import { toggleDrawer } from '@/store/slices/notificationsSlice'
import { logoutStart } from '@/store/slices/authSlice'
import { companies } from '@/lib/data/companies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'

export function Topbar({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  // Typed selectors — no more (state: any)
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount)
  const { user } = useAppSelector((state) => state.auth)

  const { theme, toggleTheme } = useTheme()

  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // User initials for avatar fallback
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'FS'

  // Index data for search
  const INDEX_SEARCH = [
    { name: 'NIFTY 50', slug: 'NIFTY50', exchange: 'NSE', value: 22845.75, changePct: 0.56 },
    { name: 'SENSEX', slug: 'SENSEX', exchange: 'BSE', value: 75241.90, changePct: 0.55 },
    { name: 'BANK NIFTY', slug: 'BANKNIFTY', exchange: 'NSE', value: 48532.60, changePct: -0.18 },
    { name: 'NIFTY IT', slug: 'NIFTYIT', exchange: 'NSE', value: 35842.30, changePct: 0.66 },
    { name: 'NIFTY MIDCAP 100', slug: 'NIFTYMIDCAP', exchange: 'NSE', value: 51234.80, changePct: 0.61 },
  ]

  // Filter companies based on query
  const stockSuggestions = searchQuery.trim()
    ? companies
        .filter(
          (c) =>
            c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 6)
    : []

  const indexSuggestions = searchQuery.trim()
    ? INDEX_SEARCH.filter(
        (idx) =>
          idx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          idx.slug.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3)
    : []

  // Merged flat list for unified keyboard navigation
  // Indices come first (indices 0..indexSuggestions.length-1), then stocks
  const totalSuggestions = indexSuggestions.length + stockSuggestions.length

  // NOTE: Ctrl/Cmd+K listener is intentionally NOT attached here.
  // DashboardLayout owns the single window listener and passes onOpenPalette prop.
  // Calling onOpenPalette() from here prevents the race condition where both
  // listeners fired — causing the palette to open and immediately close.

  // Close suggestions and profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
        setActiveSuggestionIndex(-1)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectCompany = (symbol: string) => {
    setSearchQuery('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    navigate(`/company/${symbol.toUpperCase()}`)
  }

  const handleSelectIndex = (slug: string) => {
    setSearchQuery('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    navigate(`/index/${slug}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeSuggestionIndex >= 0) {
      if (activeSuggestionIndex < indexSuggestions.length) {
        handleSelectIndex(indexSuggestions[activeSuggestionIndex].slug)
      } else {
        const stockIdx = activeSuggestionIndex - indexSuggestions.length
        handleSelectCompany(stockSuggestions[stockIdx].symbol)
      }
    } else if (stockSuggestions.length > 0) {
      handleSelectCompany(stockSuggestions[0].symbol)
    } else if (indexSuggestions.length > 0) {
      handleSelectIndex(indexSuggestions[0].slug)
    }
  }

  // Unified keyboard navigation over merged suggestions list (indices + stocks)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || totalSuggestions === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev < totalSuggestions - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
      inputRef.current?.blur()
    }
  }

  // Notification badge display — show "9+" for double-digit counts
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)
  const badgeIsPill = unreadCount > 9

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-30 select-none">
      {/* Sidebar Toggle — visible on all screen sizes (not just md+) */}
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(toggleSidebar())}
          className="size-9 text-textSecondary hover:text-textPrimary flex"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </Button>

        {/* Central Search Bar */}
        <div ref={searchRef} className="relative w-full max-w-lg">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-textMuted pointer-events-none" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search stocks (e.g. RELIANCE, TCS, HDFC)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                  setActiveSuggestionIndex(-1)
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-12 h-9 bg-surfaceMuted hover:bg-surfaceMuted/80 focus:bg-surface text-xs border-border focus:border-accent font-medium transition-colors"
              />

              {/* Clear button is OUTSIDE pointer-events-none so it receives clicks reliably */}
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveSuggestionIndex(-1)
                    setShowSuggestions(false)
                    inputRef.current?.focus()
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textSecondary transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none">
                  <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-surface px-1.5 font-mono text-[9px] font-medium text-textMuted shadow-none">
                    <span className="text-[8px]">⌘</span>K
                  </kbd>
                </div>
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && (stockSuggestions.length > 0 || indexSuggestions.length > 0) && (
            <div className="absolute top-10 left-0 w-full bg-surface border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 py-1">
              {/* Index results */}
              {indexSuggestions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-textMuted uppercase tracking-wider bg-surfaceMuted">
                    Indices
                  </div>
                  {indexSuggestions.map((idx, i) => (
                    <div
                      key={idx.slug}
                      onClick={() => handleSelectIndex(idx.slug)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 cursor-pointer transition-colors',
                        activeSuggestionIndex === i ? 'bg-tableRowHover' : 'hover:bg-tableRowHover'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-accent">{idx.name}</span>
                        <span className="text-[10px] text-textSecondary">{idx.exchange} Index</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-mono font-medium text-textPrimary">{idx.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span className={cn('text-[9px] font-mono font-medium', idx.changePct >= 0 ? 'text-positive' : 'text-negative')}>
                          {idx.changePct >= 0 ? '+' : ''}{idx.changePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* Stock results */}
              {stockSuggestions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-textMuted uppercase tracking-wider bg-surfaceMuted">
                    Stocks
                  </div>
                  {stockSuggestions.map((company, i) => {
                    // Offset index by number of index suggestions for unified keyboard nav
                    const flatIndex = indexSuggestions.length + i
                    return (
                      <div
                        key={company.symbol}
                        onClick={() => handleSelectCompany(company.symbol)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 cursor-pointer transition-colors',
                          activeSuggestionIndex === flatIndex ? 'bg-tableRowHover' : 'hover:bg-tableRowHover'
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-textPrimary">{company.symbol}</span>
                          <span className="text-[10px] text-textSecondary truncate max-w-[280px]">{company.name}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-xs font-mono font-medium text-textPrimary">₹{company.price.toFixed(2)}</span>
                          <span
                            className={cn(
                              'text-[9px] font-mono font-medium flex items-center gap-0.5',
                              company.change >= 0 ? 'text-positive' : 'text-negative'
                            )}
                          >
                            {company.change >= 0 ? '+' : ''}
                            {company.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              {stockSuggestions.length === 0 && indexSuggestions.length === 0 && searchQuery.trim() && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-textMuted">No results for <span className="font-bold text-textPrimary">{searchQuery}</span></p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="relative p-1.5 rounded-full hover:bg-surfaceMuted transition-colors text-textSecondary hover:text-textPrimary focus:outline-none"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {/* Notification Bell — badge shows "9+" for double-digit counts with pill shape */}
        <button
          onClick={() => dispatch(toggleDrawer())}
          aria-label="Notifications"
          className="relative p-1.5 rounded-full hover:bg-surfaceMuted transition-colors text-textSecondary hover:text-textPrimary focus:outline-none"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute top-0.5 right-0.5 bg-negative border-2 border-surface flex items-center justify-center text-[7px] font-bold text-white leading-none',
                badgeIsPill
                  ? 'rounded-full px-1 py-0.5 min-w-[16px] h-4'
                  : 'rounded-full size-3.5'
              )}
            >
              {badgeLabel}
            </span>
          )}
        </button>

        {/* User Account Avatar with Custom Dropdown Menu */}
        <div className="relative font-sans" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 focus:outline-none"
            aria-label="Toggle profile menu"
          >
            <Avatar className="size-8 cursor-pointer border border-border hover:ring-2 hover:ring-accent/20 hover:border-accent transition-all">
              <AvatarImage src="" />
              <AvatarFallback className="bg-accentSoft text-accent text-xs font-bold font-sans">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2.5 w-56 bg-surface border border-border rounded-xl shadow-none overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Identity Info */}
              <div className="px-4 py-3 bg-surfaceMuted border-b border-border/50 flex flex-col gap-0.5">
                <p className="text-xs font-bold text-textPrimary truncate">{user?.name || 'FinScreen User'}</p>
                <p className="text-[10px] text-textSecondary font-medium truncate">{user?.email || 'user@finscreen.in'}</p>
                <div className="mt-1.5 flex items-center">
                  <span className={cn(
                    'text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shadow-none',
                    user?.plan === 'PRO' ? 'bg-warning-soft/40 text-warning border-amber-200' : 'bg-surfaceMuted text-textSecondary border-border'
                  )}>
                    {user?.plan || 'FREE'} Tier
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/account')
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors text-left"
                >
                  <UserIcon className="size-4 text-textMuted" />
                  My Account
                </button>
                {user?.plan === 'FREE' && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      navigate('/pricing')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-accent hover:text-accent/90 hover:bg-accentSoft/50 transition-colors text-left"
                  >
                    <ShieldAlert className="size-4 text-accent" />
                    Upgrade to PRO
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/account?tab=settings')
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors text-left"
                >
                  <Settings className="size-4 text-textMuted" />
                  Account Settings
                </button>
              </div>

              {/* Logout Button */}
              <div className="border-t border-border/50 py-1 bg-surfaceMuted/30">
                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    dispatch(logoutStart())
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-negative hover:text-negative/90 hover:bg-negative-soft transition-colors text-left"
                >
                  <LogOut className="size-4 text-negative" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
