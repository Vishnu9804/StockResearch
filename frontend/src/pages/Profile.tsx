import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logoutStart } from '@/store/slices/authSlice'
import { 
  User as UserIcon, 
  Mail, 
  CreditCard, 
  ShieldCheck, 
  Clock, 
  LogOut, 
  Sparkles,
  ChevronRight,
  FileCheck
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'

export function Profile() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state: any) => state.auth)

  const handleLogout = () => {
    dispatch(logoutStart())
  }

  // Fallback data if user state is somehow empty
  const profileUser = user || {
    name: 'FinScreen User',
    email: 'free@finscreen.in',
    plan: 'FREE',
    id: 'usr_mock_123'
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-8 font-sans select-none">
      {/* Page Header */}
      <div>
        <Heading level={1} variant="pageTitle">Account Settings</Heading>
        <Text variant="bodyMuted" className="mt-1 text-xs">
          Manage your FinScreen institutional account, billing tiers, and data feeds.
        </Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Summary Card */}
        <Card className="md:col-span-1 border-border shadow-none overflow-hidden h-fit bg-surface">
          <div className="h-2 bg-accent" />
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="size-16 rounded-full bg-accentSoft border border-accent/20 flex items-center justify-center font-bold text-accent text-xl shadow-inner mb-4">
              {profileUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            
            <Heading level={3} variant="sectionTitle" className="text-base font-bold text-textPrimary">{profileUser.name}</Heading>
            <Text variant="bodyMuted" className="truncate w-full max-w-[200px] mt-0.5 text-xs font-medium">{profileUser.email}</Text>
            
            <div className="mt-4">
              <Badge variant="outline" className={cn(
                "px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none",
                profileUser.plan === 'PRO' 
                  ? "bg-warning-soft/40 text-warning border-amber-200" 
                  : "bg-surfaceMuted text-textSecondary border-border"
              )}>
                {profileUser.plan} Member
              </Badge>
            </div>

            <div className="w-full border-t border-border/50 mt-6 pt-4 text-left space-y-3">
              <div className="flex items-center justify-between text-xs">
                <Text variant="caption" className="font-semibold flex items-center gap-1.5 text-textSecondary">
                  <Clock className="size-3.5" /> Session
                </Text>
                <Text variant="numeric" className="text-xs font-semibold text-textSecondary">Active</Text>
              </div>
              <div className="flex items-center justify-between text-xs">
                <Text variant="caption" className="font-semibold flex items-center gap-1.5 text-textSecondary">
                  <FileCheck className="size-3.5" /> API Feed
                </Text>
                <span className="font-semibold text-positive flex items-center gap-1 text-xs">
                  <span className="size-1.5 rounded-full bg-positive animate-pulse" /> Live
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Side: Account Details & Subscription Plan */}
        <div className="md:col-span-2 space-y-6">
          {/* Section 1: Profile Information */}
          <Card className="border-border shadow-none bg-surface">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <UserIcon className="size-4 text-accent" /> Personal Credentials
              </CardTitle>
              <CardDescription className="text-[11px] text-textSecondary">
                Primary credentials tied to your institutional data workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Text variant="label" as="label" className="text-[9px] tracking-wider">Full Identity Name</Text>
                  <div className="flex items-center gap-2 px-3 py-2 bg-surfaceMuted border border-border rounded-lg text-xs font-semibold text-textPrimary">
                    <UserIcon className="size-3.5 text-textMuted shrink-0" />
                    <span>{profileUser.name}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Text variant="label" as="label" className="text-[9px] tracking-wider">Registered Email</Text>
                  <div className="flex items-center gap-2 px-3 py-2 bg-surfaceMuted border border-border rounded-lg text-xs font-semibold text-textPrimary">
                    <Mail className="size-3.5 text-textMuted shrink-0" />
                    <span className="truncate">{profileUser.email}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Text variant="label" as="label" className="text-[9px] tracking-wider">Account Reference ID</Text>
                <div className="px-3 py-2 bg-surfaceMuted border border-border rounded-lg font-mono text-[10px] text-textSecondary">
                  {profileUser.id || 'usr_finscreen_default_mock'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Subscription Details */}
          <Card className="border-border shadow-none bg-surface overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <CreditCard className="size-4 text-accent" /> Plan & Subscription
              </CardTitle>
              <CardDescription className="text-[11px] text-textSecondary">
                Unlock 15-year histories, unlimited export utilities, and custom ratio editors.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {profileUser.plan === 'PRO' ? (
                /* Pro Layout */
                <div className="p-4 bg-warning-soft/40/50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <Sparkles className="size-4 text-warning fill-amber-500/20" />
                      Active Pro Workspace
                    </div>
                    <Badge variant="outline" className="bg-warning-soft text-amber-800 border-amber-200 text-[8px] font-bold shadow-none">Premium</Badge>
                  </div>
                  <Text variant="bodyMuted" className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                    You have unlocked unlimited watchlists, 15-year comprehensive financial histories, custom formula builders, and background email alerts. Thank you for partnering with FinScreen!
                  </Text>
                  <div className="pt-2 flex items-center justify-between border-t border-amber-200/50">
                    <span className="text-[10px] text-warning font-bold">Auto-renewal: Active (Yearly)</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/pricing')}
                      className="h-7 text-[10px] font-bold border-amber-300 text-amber-800 bg-surface hover:bg-warning-soft hover:text-amber-900"
                    >
                      Billing Portal
                    </Button>
                  </div>
                </div>
              ) : (
                /* Free Layout */
                <div className="p-4 bg-accentSoft/30 border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-textPrimary font-bold text-xs">
                      <ShieldCheck className="size-4 text-textSecondary" />
                      Free Tier Workspace
                    </div>
                    <Badge variant="outline" className="bg-surfaceMuted text-textSecondary border-border text-[8px] font-bold shadow-none">Standard</Badge>
                  </div>
                  <Text variant="bodyMuted" className="text-[11px] text-textSecondary leading-relaxed font-medium">
                    Your account is currently restricted to basic watchlists, 5-year maximum financial histories, and limited Excel exports. Upgrade to Pro to supercharge your stock screening workflow.
                  </Text>
                  <div className="pt-2 flex items-center justify-between border-t border-border/40">
                    <span className="text-[10px] text-textMuted font-medium">Plan Limit: 5Y Historical Data</span>
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/pricing')}
                      className="h-7 text-[10px] font-bold bg-accent hover:bg-accent/90 text-white flex items-center gap-1 shadow-none"
                    >
                      Upgrade to PRO <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Log Out Option */}
              <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                <div className="text-left">
                  <Text variant="body" className="font-bold text-textPrimary">Secure Account Logout</Text>
                  <Text variant="caption" className="text-textSecondary mt-0.5">Logout of this workspace and flush session tokens.</Text>
                </div>
                <Button 
                  onClick={handleLogout}
                  variant="destructive" 
                  size="sm" 
                  className="h-8 font-bold text-xs uppercase flex items-center gap-1.5 shadow-none"
                >
                  <LogOut className="size-3.5" /> Log Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Profile

