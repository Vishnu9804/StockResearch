import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { logoutStart } from '@/store/slices/authSlice'
import {
  User as UserIcon, Mail, CreditCard, ShieldCheck, Clock,
  LogOut, Sparkles, ChevronRight, FileCheck, Bell, Key,
  Eye, EyeOff, Check, Loader2, Copy, AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'
import { apiClient } from '@/services/finscreenApi'
import { supabase } from '@/services/supabaseClient'

// ─── Plan feature matrix (mirrors /pricing) ───────────────────────────────────

const FREE_FEATURES = [
  'Standard stock screening',
  '5-year financial statements history',
  'Up to 3 watchlists',
  'Standard CSV reports export',
]

const PRO_FEATURES = [
  'Complete 15-year financials history',
  'Unlimited watchlists & alert triggers',
  'Screener Custom Ratio Builder',
  'Institutional Excel export & PDF filings',
]

const DEFAULT_NOTIF_PREFS = [
  { key: 'price', label: 'Price Alerts', desc: 'Notify when stocks hit your target price', enabled: true },
  { key: 'screener', label: 'Screener Updates', desc: 'New matches for your saved screens', enabled: true },
  { key: 'results', label: 'Quarterly Results', desc: 'Alerts for your watchlist stocks', enabled: false },
  { key: 'dividend', label: 'Dividend Announcements', desc: 'Ex-dates and payout declarations', enabled: true },
]

// ─── Profile summary card (avatar + identity + plan badge) ─────────────────────

function ProfileHero({ user }: { user: any }) {
  const initials = (user?.name || 'User')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const isPro = user?.plan === 'PRO'

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-accent via-blue-600 to-indigo-600 relative">
        <div className="absolute -bottom-8 left-6">
          <div className="size-16 rounded-full bg-surface border-4 border-surface flex items-center justify-center font-medium text-accent text-xl shadow-md">
            {initials}
          </div>
        </div>
      </div>
      <CardContent className="pt-12 pb-6 px-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-textPrimary truncate">{user?.name}</h3>
          <p className="text-xs text-textSecondary mt-0.5 truncate">{user?.email}</p>
        </div>
        <Badge variant="outline" className={cn(
          'text-xs font-medium uppercase tracking-wider shadow-none border-0 self-start sm:self-auto shrink-0',
          isPro ? 'bg-warning-soft text-amber-700' : 'bg-surfaceMuted text-textSecondary'
        )}>
          {isPro && <Sparkles className="size-2.5 mr-1 fill-amber-500" />}
          {user?.plan} Member
        </Badge>
      </CardContent>
    </Card>
  )
}

// ─── Personal credentials ──────────────────────────────────────────────────────

function CredentialsCard({ user }: { user: any }) {
  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="pb-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
          <UserIcon className="size-4 text-accent" /> Personal Credentials
        </CardTitle>
        <CardDescription className="text-xs">Primary details tied to your FinScreen workspace.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-textMuted font-medium">Full Name</Label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surfaceMuted border border-border/40 rounded-xl text-xs font-medium text-textPrimary">
              <UserIcon className="size-3.5 text-textMuted" />
              {user.name}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-textMuted font-medium">Email</Label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surfaceMuted border border-border/40 rounded-xl text-xs font-medium text-textPrimary">
              <Mail className="size-3.5 text-textMuted" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-textMuted font-medium">Account ID</Label>
          <div className="px-3 py-2.5 bg-surfaceMuted border border-border/40 rounded-xl font-mono text-xs text-textSecondary truncate">
            {user.id ?? 'usr_finscreen_default'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5 text-textSecondary">
            <Clock className="size-3.5" /> Session: <span className="font-medium text-positive">Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-textSecondary">
            <FileCheck className="size-3.5" /> API Feed:{' '}
            <span className="font-medium text-positive flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-positive animate-pulse" /> Live
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Plan & subscription ───────────────────────────────────────────────────────

function PlanCard({ user }: { user: any }) {
  const navigate = useNavigate()
  const isPro = user?.plan === 'PRO'
  const [subStatus, setSubStatus] = useState<any>(null)
  const [loadingSub, setLoadingSub] = useState(false)

  useEffect(() => {
    if (isPro) {
      setLoadingSub(true)
      apiClient.get('/payments/status')
        .then((res) => {
          if (res.data?.subscription) setSubStatus(res.data.subscription)
        })
        .catch((err) => console.error('Failed to load subscription status:', err))
        .finally(() => setLoadingSub(false))
    }
  }, [isPro])

  const features = isPro ? PRO_FEATURES : FREE_FEATURES

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="pb-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
          <CreditCard className="size-4 text-accent" /> Plan & Subscription
        </CardTitle>
        <CardDescription className="text-xs">
          {isPro ? 'You are on the Premium (Pro) plan.' : 'You are on the Basic (Free) plan.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6 space-y-5">
        {isPro ? (
          <div className="p-5 bg-warning-soft/30 border border-amber-200/50 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-medium text-xs">
                <Sparkles className="size-4 text-warning fill-amber-500/20" /> Active Pro Workspace
              </div>
              <Badge variant="outline" className="bg-warning-soft text-amber-800 border-0 text-xs font-medium shadow-none">Premium</Badge>
            </div>
            <span className="block text-xs text-warning font-medium">
              {loadingSub
                ? 'Loading billing details…'
                : subStatus?.endDate
                  ? `Renews / expires: ${new Date(subStatus.endDate).toLocaleDateString('en-IN')}`
                  : 'Auto-renewal: Active (Yearly)'}
            </span>
          </div>
        ) : (
          <div className="p-5 bg-accentSoft/20 border border-border/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-textPrimary font-medium text-xs">
                <ShieldCheck className="size-4 text-textSecondary" /> Free Tier Workspace
              </div>
              <Badge variant="outline" className="bg-surfaceMuted text-textSecondary border-0 text-xs font-medium shadow-none">Standard</Badge>
            </div>
            <Text variant="bodyMuted" className="text-xs text-textSecondary leading-relaxed font-medium">
              Upgrade to unlock 15-year histories, unlimited watchlists and the custom ratio builder.
            </Text>
          </div>
        )}

        {/* Feature list for the current plan */}
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-xs font-medium text-textSecondary">
              <Check className="size-4 text-accent shrink-0" /> {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="pt-2">
          {isPro ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/pricing')}
              className="h-9 w-full text-xs font-medium border-amber-300/50 text-amber-800 hover:bg-warning-soft shadow-none"
            >
              Manage Billing
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate('/pricing')}
              className="h-9 w-full text-xs font-medium bg-accent hover:bg-accent/90 text-white shadow-none gap-1"
            >
              <Sparkles className="size-3.5" /> Upgrade to PRO <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Security / change password (functional via Supabase) ──────────────────────

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggleShow: () => void
  placeholder?: string
  error?: string
}

function PasswordField({ label, value, onChange, show, onToggleShow, placeholder, error }: PasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-textSecondary">{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error}
          className="h-9 text-xs border-border shadow-none pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleShow}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md text-textMuted hover:text-textSecondary transition-colors"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-negative">
          <AlertCircle className="size-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

interface PasswordErrors {
  current?: string
  next?: string
  confirm?: string
}

function SecurityCard({ user }: { user: any }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [saving, setSaving] = useState(false)

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setErrors({}) }

  const validate = (): boolean => {
    const next_: PasswordErrors = {}

    if (!current) {
      next_.current = 'Enter your current password.'
    }
    if (!next) {
      next_.next = 'Enter a new password.'
    } else if (next.length < 6) {
      next_.next = 'Must be at least 6 characters.'
    } else if (current && next === current) {
      next_.next = 'New password must be different from the current password.'
    }
    if (!confirm) {
      next_.confirm = 'Confirm your new password.'
    } else if (next && confirm !== next) {
      next_.confirm = 'Passwords do not match.'
    }

    setErrors(next_)
    return Object.keys(next_).length === 0
  }

  const handleUpdate = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      // Re-authenticate to verify the current password before changing it.
      if (user?.email) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: current,
        })
        if (reauthErr) {
          setErrors((e) => ({ ...e, current: 'Current password is incorrect.' }))
          setSaving(false)
          return
        }
      }

      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error

      toast.success('Password updated successfully.')
      reset()
    } catch (err: any) {
      toast.error(err?.message || 'Could not update password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="pb-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
          <Key className="size-4 text-accent" /> Security · Change Password
        </CardTitle>
        <CardDescription className="text-xs">Update the password used to sign in to FinScreen.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6 space-y-4">
        <PasswordField
          label="Current Password"
          value={current}
          onChange={(v) => { setCurrent(v); setErrors((e) => ({ ...e, current: undefined })) }}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          placeholder="••••••••"
          error={errors.current}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PasswordField
            label="New Password"
            value={next}
            onChange={(v) => { setNext(v); setErrors((e) => ({ ...e, next: undefined })) }}
            show={showNext}
            onToggleShow={() => setShowNext((v) => !v)}
            placeholder="Min. 6 characters"
            error={errors.next}
          />
          <PasswordField
            label="Confirm Password"
            value={confirm}
            onChange={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })) }}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
            placeholder="Repeat new password"
            error={errors.confirm}
          />
        </div>
        <div className="flex items-center justify-end pt-1">
          <Button
            onClick={handleUpdate}
            disabled={saving}
            size="sm"
            className="h-8 text-xs font-medium shadow-none gap-1.5 bg-accent text-white hover:bg-accent/90"
          >
            {saving ? <><Loader2 className="size-3.5 animate-spin" /> Updating…</> : 'Update Password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── API access ────────────────────────────────────────────────────────────────

function ApiAccessCard() {
  const [showKey, setShowKey] = useState(false)
  const apiKey = 'fs_live_xKp9mN2qR7vW4tL6jH8cA3bY5dE0'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      toast.success('API key copied to clipboard.')
    } catch {
      toast.error('Could not copy API key.')
    }
  }

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="pb-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
          <Key className="size-4 text-accent" /> API Access
        </CardTitle>
        <CardDescription className="text-xs">Use your API key to access FinScreen data programmatically.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-textSecondary">Your API Key</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-surfaceMuted border border-border rounded-lg font-mono text-xs text-textSecondary overflow-hidden truncate">
              {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
            </div>
            <Button variant="outline" size="icon" className="size-9 border-border shadow-none" onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button variant="outline" size="icon" className="size-9 border-border shadow-none" onClick={handleCopy}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-textMuted">Treat your API key like a password. Regenerate it if compromised.</p>
      </CardContent>
    </Card>
  )
}

// ─── Notification preferences ──────────────────────────────────────────────────

function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState(DEFAULT_NOTIF_PREFS)

  const toggle = (key: string) =>
    setPrefs((prev) => prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p)))

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="pb-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
          <Bell className="size-4 text-accent" /> Notification Preferences
        </CardTitle>
        <CardDescription className="text-xs">Choose which alerts land in your inbox.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6 space-y-1">
        {prefs.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-textPrimary">{pref.label}</p>
              <p className="text-xs text-textMuted">{pref.desc}</p>
            </div>
            <Switch
              checked={pref.enabled}
              onCheckedChange={() => toggle(pref.key)}
              aria-label={`Toggle ${pref.label}`}
              className="shrink-0"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Sign out ──────────────────────────────────────────────────────────────────

function SignOutCard() {
  const dispatch = useAppDispatch()
  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Text variant="body" className="font-medium text-textPrimary">Secure Logout</Text>
          <Text variant="caption" className="text-textSecondary mt-0.5">Flush session tokens and sign out of this device.</Text>
        </div>
        <Button
          onClick={() => dispatch(logoutStart())}
          variant="destructive"
          size="sm"
          className="h-8 font-medium text-xs uppercase gap-1.5 shadow-none shrink-0"
        >
          <LogOut className="size-3.5" /> Log Out
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Main Account Page ─────────────────────────────────────────────────────────

export function Account() {
  const { user } = useAppSelector((state) => state.auth)

  const profileUser = user ?? {
    name: 'FinScreen User',
    email: 'free@finscreen.in',
    plan: 'FREE',
    id: 'usr_mock_123',
  }
  const isPro = profileUser.plan === 'PRO'

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-xs text-textSecondary/70 mb-1.5">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <span className="mx-1.5">›</span>
            <span className="text-accent font-medium">My Account</span>
          </div>
          <Heading level={1} variant="pageTitle" className="text-textPrimary">
            My Account
          </Heading>
          <p className="text-body text-textSecondary mt-1">
            Manage your profile, security and plan ·{' '}
            <span className="font-medium text-accent">{isPro ? 'Pro Access' : 'Free Tier'}</span>
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <div className="mb-6">
          <ProfileHero user={profileUser} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main column */}
          <main className="lg:col-span-2 space-y-6">
            <CredentialsCard user={profileUser} />
            <SecurityCard user={profileUser} />
            <ApiAccessCard />
            <NotificationPrefsCard />
          </main>

          {/* Side column */}
          <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-28">
            <PlanCard user={profileUser} />
            <SignOutCard />
          </aside>
        </div>
      </div>
    </div>
  )
}

export default Account
