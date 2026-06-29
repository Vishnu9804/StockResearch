import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Company } from '@/lib/data/companies'
import { formatNumber } from '@/lib/formatters'
import {
  Bookmark,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  ExternalLink,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toggleWatchlist } from '@/store/slices/companySlice'
import { addNotification } from '@/store/slices/notificationsSlice'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { cn } from '@/lib/utils'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { AnimatedCompanyName } from './AnimatedCompanyName'
import { badgePopVariants, containerVariants, itemVariants, springs } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

import { useState, useEffect } from 'react'

export function CompanyHeader({ company }: { company: Company }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const watchlist = useAppSelector((state) => state.company.watchlist)
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [liveRating, setLiveRating] = useState<string | null>(null)
  const isWatched = watchlist.includes(company.symbol)
  const positive = company.change >= 0
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    import('@/services/finscreenApi').then(({ default: finscreenApi }) => {
      finscreenApi.fetchCompanyCreditRatings(company.symbol)
        .then((res: any) => {
          const ratingStr = res?.rating || res?.[0]?.rating || res?.[0]?.credit_rating || company.creditRating || 'AAA'
          setLiveRating(ratingStr)
        })
        .catch(() => setLiveRating(company.creditRating || 'AAA'))
    })
  }, [company.symbol])

  const handleWatchToggle = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to add companies to your watchlist.')
      const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
      navigate(`/login?redirect=${redirectPath}`)
      return
    }
    dispatch(toggleWatchlist(company.symbol))
    dispatch(addNotification({
      type: 'info',
      title: isWatched ? 'Removed from Watchlist' : 'Added to Watchlist',
      body: `${company.name} (${company.symbol}) has been ${isWatched ? 'removed from' : 'added to'} your active watchlist.`,
      symbol: company.symbol,
      actionUrl: '/watchlists',
    }))
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      dispatch(addNotification({
        type: 'info',
        title: 'Link Copied',
        body: 'Company profile link has been copied to your clipboard.',
      }))
    }
  }

  // Get company initials for the avatar
  const initials = company.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="border-b border-border bg-surface select-none">
      <div className="px-6 py-4">
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-3">
          <Link to="/" className="hover:text-accent transition-colors">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-textSecondary">Company</span>
          <span className="mx-1.5">›</span>
          <span className="text-accent font-medium">{company.symbol}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Logo + Info */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Gradient company avatar */}
            <div className="size-12 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center text-accent font-medium text-sm shrink-0 shadow-[var(--shadow-sm)]">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-textPrimary leading-tight flex items-center gap-2">
                  <AnimatedCompanyName name={company.name} />
                </h1>
                <Badge variant="outline" className="font-mono text-xs font-medium text-textSecondary bg-surfaceMuted border-border rounded-md">
                  {company.symbol}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs font-medium text-textSecondary bg-surfaceMuted border-border rounded-md">
                  {company.exchange}
                </Badge>
                {liveRating && (
                  <Badge variant="outline" className="font-mono text-xs font-semibold text-accent bg-accentSoft border-accent/20 rounded-md">
                    Rating: {liveRating}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-body text-textSecondary flex flex-wrap items-center gap-1 font-normal">
                <span>Equity tracking {company.sector} · </span>
                <span className="font-medium text-accent">
                  Market Cap ₹{(company.marketCap / 100000).toFixed(1)}L Cr
                </span>
                <span className="text-border mx-1">·</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80 inline-flex items-center gap-0.5 transition-colors"
                >
                  <Globe className="size-3" />
                  Website
                  <ExternalLink className="size-2.5" />
                </a>
              </p>
            </div>
          </div>

          {/* Right: Price + Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-medium font-mono tracking-tight text-textPrimary tabular-nums">
                ₹{formatNumber(company.price, 2)}
              </span>
              <motion.span
                key={company.symbol + company.changePct}
                variants={prefersReduced ? undefined : badgePopVariants}
                initial={prefersReduced ? false : 'initial'}
                animate="animate"
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-mono font-medium',
                  positive ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'
                )}
              >
                {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {positive ? '+' : ''}{formatNumber(company.change, 2)} ({positive ? '+' : ''}{company.changePct.toFixed(2)}%)
              </motion.span>
            </div>

            <div className="text-xs text-textMuted font-mono">
              52W High: ₹{formatNumber(company.high52w)} · Low: ₹{formatNumber(company.low52w)}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <Button
                size="sm"
                variant={isWatched ? 'default' : 'outline'}
                onClick={handleWatchToggle}
                className={cn('h-8 text-xs gap-1.5 font-medium uppercase tracking-wide', isWatched ? '' : '')}
              >
                <Bookmark className="size-3" />
                {isWatched ? 'Watching' : 'Watch'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                className="h-8 text-xs gap-1.5 font-medium uppercase tracking-wide"
              >
                <Share2 className="size-3" />
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
