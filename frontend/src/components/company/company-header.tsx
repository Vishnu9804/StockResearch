import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Company } from '@/lib/data/companies'
import { formatNumber, formatPct, changeClass } from '@/lib/formatters'
import {
  Bookmark,
  Bell,
  Share2,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  ExternalLink,
} from 'lucide-react'
import { toggleWatchlist } from '@/store/slices/companySlice'
import { addNotification } from '@/store/slices/notificationsSlice'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export function CompanyHeader({ company }: { company: Company }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const watchlist = useAppSelector((state) => state.company.watchlist)
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const isWatched = watchlist.includes(company.symbol)

  const positive = company.change >= 0

  const handleWatchToggle = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add companies to your watchlist.')
      const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
      navigate(`/login?redirect=${redirectPath}`)
      return
    }
    dispatch(toggleWatchlist(company.symbol))
    dispatch(
      addNotification({
        type: 'info',
        title: isWatched ? 'Removed from Watchlist' : 'Added to Watchlist',
        body: `${company.name} (${company.symbol}) has been ${isWatched ? 'removed from' : 'added to'} your active watchlist.`,
        symbol: company.symbol,
        actionUrl: '/watchlists',
      })
    )
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      // Dispatch in-app notification toast
      dispatch(
        addNotification({
          type: 'info',
          title: 'Link Copied',
          body: 'Company profile link has been copied to your clipboard.',
        })
      )
    }
  }

  return (
    <header className="border-b border-border bg-surface select-none">
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-accentSoft border border-blue-100 text-accent shrink-0">
              <Building2 className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-textPrimary truncate">
                  {company.name}
                </h1>
                <Badge variant="outline" className="font-mono text-[10px] font-bold text-textSecondary bg-surfaceMuted border-border">
                  {company.symbol}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] font-bold text-textSecondary bg-surfaceMuted border-border">
                  {company.exchange}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-textSecondary flex items-center gap-1.5 font-medium">
                {company.sector} · {company.industry}
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-blue-800 inline-flex items-center gap-0.5 ml-1"
                >
                  <Globe className="size-3" />
                  Website
                  <ExternalLink className="size-2.5" />
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-textPrimary tabular-nums">
                ₹{formatNumber(company.price, 2)}
              </span>
              <span
                className={cn(
                  'text-xs font-mono font-bold flex items-center gap-0.5',
                  positive ? 'text-positive' : 'text-negative'
                )}
              >
                {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {positive ? '+' : ''}
                {formatNumber(company.change, 2)} ({positive ? '+' : ''}
                {company.changePct.toFixed(2)}%)
              </span>
            </div>
            <div className="text-[10px] text-textMuted font-mono font-medium">
              52W High: ₹{formatNumber(company.high52w)} · 52W Low: ₹{formatNumber(company.low52w)}
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <Button
                size="sm"
                variant={isWatched ? 'default' : 'outline'}
                onClick={handleWatchToggle}
                className={cn('h-8 text-xs gap-1.5 font-bold uppercase shadow-none', isWatched ? 'bg-accent hover:bg-accent/90 text-white' : '')}
              >
                <Bookmark className="size-3.5" />
                {isWatched ? 'Watching' : 'Watch'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                className="h-8 text-xs gap-1.5 font-bold uppercase border-border text-textSecondary shadow-none hover:bg-surfaceMuted"
              >
                <Share2 className="size-3.5" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
export default CompanyHeader
