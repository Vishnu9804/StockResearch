import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logoutStart } from '@/store/slices/authSlice'
import {
  User as UserIcon, Mail, CreditCard, ShieldCheck, Clock,
  LogOut, Sparkles, ChevronRight, FileCheck, Bell, Settings,
  FolderHeart, Filter, BookOpen, Key, Eye, EyeOff, Check,
  ArrowRight, Star, Trash2, Play, AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'
import { SCREENER_TEMPLATES } from '@/lib/data/screener'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'screens' | 'watchlists' | 'notifications' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'screens', label: 'Saved Screens', icon: Filter },
  { id: 'watchlists', label: 'My Watchlists', icon: FolderHeart },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// ─── Mock notification data ───────────────────────────────────────────────────

const MOCK_ALERTS = [
  { id: 'a1', type: 'price', symbol: 'RELIANCE', message: 'RELIANCE crossed ₹3,000 target price', time: '2 hours ago', read: false },
  { id: 'a2', type: 'screen', symbol: null, message: '"Golden Crossover" screen has 12 new matches', time: '5 hours ago', read: false },
  { id: 'a3', type: 'result', symbol: 'TCS', message: 'TCS Q1 FY26 results: Net profit ₹12,434 Cr (+11.2% YoY)', time: '1 day ago', read: true },
  { id: 'a4', type: 'dividend', symbol: 'INFY', message: 'INFY declared interim dividend of ₹21/share', time: '2 days ago', read: true },
  { id: 'a5', type: 'price', symbol: 'HDFCBANK', message: 'HDFCBANK near 52-week high ₹1,880', time: '3 days ago', read: true },
]

const MOCK_WATCHLISTS = [
  { id: 'wl1', name: 'Core Portfolio', count: 8, change: 1.24, symbols: ['RELIANCE', 'TCS', 'INFY'] },
  { id: 'wl2', name: 'Growth Watchlist', count: 5, change: -0.34, symbols: ['BAJFINANCE', 'BHARTIARTL'] },
  { id: 'wl3', name: 'Dividend Picks', count: 6, change: 0.67, symbols: ['HINDUNILVR', 'NESTLEIND', 'MARUTI'] },
]

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: any }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  return (
    <div className="space-y-6">
      {/* Avatar card */}
      <Card className="border-border shadow-none bg-surface overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-accent via-blue-600 to-indigo-600 relative">
          <div className="absolute -bottom-8 left-6">
            <div className="size-16 rounded-full bg-surface border-4 border-surface flex items-center justify-center font-bold text-accent text-xl shadow-lg">
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
        <CardContent className="pt-12 pb-5 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-textPrimary">{user.name}</h3>
            <p className="text-xs text-textSecondary">{user.email}</p>
          </div>
          <Badge variant="outline" className={cn(
            'text-[9px] font-bold uppercase tracking-wider shadow-none',
            user.plan === 'PRO' ? 'bg-warning-soft text-amber-700 border-amber-200' : 'bg-surfaceMuted text-textSecondary border-border'
          )}>
            {user.plan === 'PRO' && <Sparkles className="size-2.5 mr-1 fill-amber-500" />}
            {user.plan} Member
          </Badge>
        </CardContent>
      </Card>

      {/* Details */}
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
            <UserIcon className="size-4 text-accent" /> Personal Credentials
          </CardTitle>
          <CardDescription className="text-[11px]">Primary credentials tied to your FinScreen workspace.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-textMuted font-bold">Full Name</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-surfaceMuted border border-border rounded-lg text-xs font-semibold text-textPrimary">
                <UserIcon className="size-3.5 text-textMuted" />
                {user.name}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-textMuted font-bold">Email</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-surfaceMuted border border-border rounded-lg text-xs font-semibold text-textPrimary">
                <Mail className="size-3.5 text-textMuted" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-wider text-textMuted font-bold">Account ID</Label>
            <div className="px-3 py-2 bg-surfaceMuted border border-border rounded-lg font-mono text-[10px] text-textSecondary">
              {user.id ?? 'usr_finscreen_default'}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs pt-2">
            <div className="flex items-center gap-1.5 text-textSecondary">
              <Clock className="size-3.5" /> Session: <span className="font-semibold text-positive">Active</span>
            </div>
            <div className="flex items-center gap-1.5 text-textSecondary">
              <FileCheck className="size-3.5" /> API Feed: <span className="font-semibold text-positive flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-positive animate-pulse" /> Live
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
            <CreditCard className="size-4 text-accent" /> Plan & Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {user.plan === 'PRO' ? (
            <div className="p-4 bg-warning-soft/40 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Sparkles className="size-4 text-warning fill-amber-500/20" /> Active Pro Workspace
                </div>
                <Badge variant="outline" className="bg-warning-soft text-amber-800 border-amber-200 text-[8px] font-bold shadow-none">Premium</Badge>
              </div>
              <Text variant="bodyMuted" className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                Unlimited watchlists · 15-year histories · custom formula builders · background email alerts.
              </Text>
              <div className="pt-2 flex items-center justify-between border-t border-amber-200/50">
                <span className="text-[10px] text-warning font-bold">Auto-renewal: Active (Yearly)</span>
                <Button variant="outline" size="sm" onClick={() => navigate('/pricing')}
                  className="h-7 text-[10px] font-bold border-amber-300 text-amber-800 hover:bg-warning-soft">
                  Billing Portal
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-accentSoft/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-textPrimary font-bold text-xs">
                  <ShieldCheck className="size-4 text-textSecondary" /> Free Tier Workspace
                </div>
                <Badge variant="outline" className="bg-surfaceMuted text-textSecondary border-border text-[8px] font-bold shadow-none">Standard</Badge>
              </div>
              <Text variant="bodyMuted" className="text-[11px] text-textSecondary leading-relaxed font-medium">
                Basic watchlists · 5-year financial histories · limited exports. Upgrade to unlock the full platform.
              </Text>
              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <span className="text-[10px] text-textMuted font-medium">Plan Limit: 5Y Historical Data</span>
                <Button size="sm" onClick={() => navigate('/pricing')}
                  className="h-7 text-[10px] font-bold bg-accent hover:bg-accent/90 text-white shadow-none">
                  Upgrade to PRO <ChevronRight className="size-3 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-border/50 mt-4 flex justify-between items-center">
            <div>
              <Text variant="body" className="font-bold text-textPrimary">Secure Logout</Text>
              <Text variant="caption" className="text-textSecondary mt-0.5">Flush session tokens and sign out.</Text>
            </div>
            <Button onClick={() => dispatch(logoutStart())} variant="destructive" size="sm"
              className="h-8 font-bold text-xs uppercase gap-1.5 shadow-none">
              <LogOut className="size-3.5" /> Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SavedScreensTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-textPrimary">Your Saved Screens</h3>
          <p className="text-xs text-textMuted mt-0.5">{SCREENER_TEMPLATES.slice(0, 5).length} screens · click to view results</p>
        </div>
        <Button asChild size="sm" className="h-8 text-xs font-bold bg-accent text-white hover:bg-accent/90 shadow-none gap-1.5">
          <Link to="/screens">
            <Filter className="size-3.5" /> Browse Gallery
          </Link>
        </Button>
      </div>

      {SCREENER_TEMPLATES.slice(0, 5).map((screen) => (
        <Card key={screen.id} className="border-border shadow-none bg-surface">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-textPrimary truncate">{screen.name}</h4>
                  {screen.popular && (
                    <Badge variant="outline" className="text-[9px] bg-warning-soft text-amber-700 border-amber-200 font-bold shadow-none shrink-0">
                      <Star className="size-2.5 mr-0.5 fill-amber-500" /> Popular
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-textMuted leading-relaxed line-clamp-1">{screen.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-textSecondary font-medium flex items-center gap-1">
                    <Filter className="size-3" /> {screen.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-accent">
                    {screen.matchCount} matches
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button asChild variant="outline" size="sm"
                  className="h-7 text-[10px] font-bold border-border text-textSecondary hover:bg-surfaceMuted shadow-none gap-1">
                  <Link to="/screener/results">
                    <Play className="size-3" /> Run
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-textMuted hover:text-negative hover:bg-red-50">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Link
        to="/screens"
        className="flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-xs text-textSecondary hover:border-accent/40 hover:text-accent transition-colors font-semibold"
      >
        <Filter className="size-3.5" /> Browse Screen Gallery <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

function WatchlistsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-textPrimary">My Watchlists</h3>
          <p className="text-xs text-textMuted mt-0.5">{MOCK_WATCHLISTS.length} watchlists · manage in full view</p>
        </div>
        <Button asChild size="sm" className="h-8 text-xs font-bold bg-accent text-white hover:bg-accent/90 shadow-none gap-1.5">
          <Link to="/watchlists">
            <FolderHeart className="size-3.5" /> Manage All
          </Link>
        </Button>
      </div>

      {MOCK_WATCHLISTS.map((wl) => {
        const positive = wl.change >= 0
        return (
          <Card key={wl.id} className="border-border shadow-none bg-surface">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FolderHeart className="size-3.5 text-accent shrink-0" />
                    <h4 className="text-sm font-bold text-textPrimary truncate">{wl.name}</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wl.symbols.map((s) => (
                      <Link key={s} to={`/company/${s}`}>
                        <Badge variant="outline" className="font-mono text-[9px] font-bold bg-surfaceMuted border-border text-textSecondary rounded-sm hover:bg-accentSoft hover:text-accent hover:border-accent/20 transition-colors">
                          {s}
                        </Badge>
                      </Link>
                    ))}
                    {wl.count > wl.symbols.length && (
                      <Badge variant="secondary" className="text-[9px] font-medium text-textMuted rounded-sm">
                        +{wl.count - wl.symbols.length} more
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('font-mono text-sm font-bold tabular-nums', positive ? 'text-positive' : 'text-negative')}>
                    {positive ? '+' : ''}{wl.change.toFixed(2)}%
                  </span>
                  <p className="text-[10px] text-textMuted mt-0.5">{wl.count} stocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function NotificationsTab() {
  const typeIcon: Record<string, React.ElementType> = {
    price: TrendingUp,
    screen: Filter,
    result: BookOpen,
    dividend: Star,
  }

  // Import TrendingUp
  function TrendingUp({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-textPrimary">Alert History</h3>
          <p className="text-xs text-textMuted mt-0.5">{MOCK_ALERTS.filter(a => !a.read).length} unread notifications</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-border text-textSecondary shadow-none gap-1.5">
          <Check className="size-3.5" /> Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {MOCK_ALERTS.map((alert) => {
          return (
            <Card key={alert.id} className={cn('border-border shadow-none', alert.read ? 'bg-surface opacity-70' : 'bg-surface border-accent/20')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    alert.type === 'price' ? 'bg-accentSoft text-accent' :
                    alert.type === 'screen' ? 'bg-purple-50 text-purple-600' :
                    alert.type === 'result' ? 'bg-positive-soft text-positive' :
                    'bg-warning-soft text-amber-600'
                  )}>
                    <AlertCircle className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-textPrimary leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-textMuted font-medium">{alert.time}</span>
                      {alert.symbol && (
                        <Link to={`/company/${alert.symbol}`}>
                          <Badge variant="outline" className="font-mono text-[9px] font-bold bg-surfaceMuted border-border text-textSecondary hover:bg-accentSoft hover:text-accent hover:border-accent/20 transition-colors rounded-sm">
                            {alert.symbol}
                          </Badge>
                        </Link>
                      )}
                    </div>
                  </div>
                  {!alert.read && (
                    <div className="size-2 rounded-full bg-accent mt-2 shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SettingsTab() {
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Security */}
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
            <Key className="size-4 text-accent" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-textSecondary">Current Password</Label>
            <Input type="password" placeholder="••••••••" className="h-9 text-xs border-border shadow-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-textSecondary">New Password</Label>
              <Input type="password" placeholder="Min. 8 characters" className="h-9 text-xs border-border shadow-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-textSecondary">Confirm Password</Label>
              <Input type="password" placeholder="Repeat new password" className="h-9 text-xs border-border shadow-none" />
            </div>
          </div>
          <Button onClick={handleSave} size="sm"
            className={cn('h-8 text-xs font-bold shadow-none gap-1.5', saved ? 'bg-positive text-white' : 'bg-accent text-white hover:bg-accent/90')}>
            {saved ? <><Check className="size-3.5" /> Saved!</> : 'Update Password'}
          </Button>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
            <Key className="size-4 text-accent" /> API Access
          </CardTitle>
          <CardDescription className="text-[11px]">Use your API key to access FinScreen data programmatically.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-textSecondary">Your API Key</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-surfaceMuted border border-border rounded-lg font-mono text-[11px] text-textSecondary overflow-hidden">
                {showKey ? 'fs_live_xKp9mN2qR7vW4tL6jH8cA3bY5dE0' : '••••••••••••••••••••••••••••••••'}
              </div>
              <Button variant="outline" size="icon" className="size-9 border-border shadow-none"
                onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-textMuted">
            Treat your API key like a password. Regenerate if compromised.
          </p>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
            <Bell className="size-4 text-accent" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {[
            { label: 'Price Alerts', desc: 'Notify when stocks hit your target price', enabled: true },
            { label: 'Screener Updates', desc: 'New matches for your saved screens', enabled: true },
            { label: 'Quarterly Results', desc: 'Alerts for your watchlist stocks', enabled: false },
            { label: 'Dividend Announcements', desc: 'Ex-dates and payout declarations', enabled: true },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
              <div>
                <p className="text-xs font-semibold text-textPrimary">{pref.label}</p>
                <p className="text-[11px] text-textMuted">{pref.desc}</p>
              </div>
              <div className={cn(
                'relative w-9 h-5 rounded-full cursor-pointer transition-colors',
                pref.enabled ? 'bg-accent' : 'bg-border'
              )}>
                <div className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
                  pref.enabled ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Account Page ────────────────────────────────────────────────────────

export function Account() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const { user } = useSelector((state: any) => state.auth)

  const profileUser = user ?? {
    name: 'FinScreen User',
    email: 'free@finscreen.in',
    plan: 'FREE',
    id: 'usr_mock_123',
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab user={profileUser} />
      case 'screens': return <SavedScreensTab />
      case 'watchlists': return <WatchlistsTab />
      case 'notifications': return <NotificationsTab />
      case 'settings': return <SettingsTab />
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Page Header ── */}
      <div className="bg-surface border-b border-border px-6 py-5">
        <div className="max-w-[1200px] mx-auto">
          <Heading level={1} variant="pageTitle">Account Hub</Heading>
          <Text variant="bodyMuted" className="mt-0.5">
            Manage your profile, screens, watchlists, and platform settings.
          </Text>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* ── Sidebar nav ── */}
          <aside className="lg:col-span-1">
            {/* Mini profile card */}
            <Card className="border-border shadow-none bg-surface mb-4 overflow-hidden">
              <div className="h-12 bg-gradient-to-r from-accent to-indigo-600" />
              <CardContent className="px-4 pb-4 pt-0 -mt-6 flex flex-col items-center text-center">
                <div className="size-12 rounded-full bg-surface border-2 border-surface flex items-center justify-center font-bold text-accent text-base shadow-md mb-2">
                  {profileUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <p className="text-xs font-bold text-textPrimary">{profileUser.name}</p>
                <p className="text-[10px] text-textSecondary truncate max-w-full">{profileUser.email}</p>
                <Badge variant="outline" className={cn(
                  'mt-2 text-[8px] font-bold uppercase shadow-none',
                  profileUser.plan === 'PRO' ? 'bg-warning-soft text-amber-700 border-amber-200' : 'bg-surfaceMuted text-textSecondary border-border'
                )}>
                  {profileUser.plan}
                </Badge>
              </CardContent>
            </Card>

            {/* Nav items */}
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all',
                      activeTab === tab.id
                        ? 'bg-accentSoft text-accent border-l-2 border-accent rounded-l-none'
                        : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted'
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', activeTab === tab.id ? 'text-accent' : 'text-textSecondary')} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* ── Content area ── */}
          <main className="lg:col-span-3">
            {renderTab()}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Account
