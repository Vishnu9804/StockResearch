import { Link } from 'react-router-dom'
import { Check, ShieldCheck, HeartHandshake, Headphones, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'

export function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accentSoft/20 flex flex-col justify-between font-sans text-textPrimary select-none">
      {/* Mini Nav Header */}
      <header className="h-16 bg-surface border-b border-border/40 flex items-center justify-between px-6 shrink-0 shadow-[var(--shadow-xs)]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-accent flex items-center justify-center font-medium text-white shadow-none">
            FS
          </div>
          <span className="font-medium text-textPrimary tracking-tight text-lg">
            Fin<span className="text-accent">Screen</span>
          </span>
        </Link>
        <Link
          to="/"
          className="text-xs font-medium uppercase tracking-wider text-textSecondary hover:text-textPrimary flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Markets
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-[1200px] mx-auto w-full">
        {/* Title */}
        <div className="text-center max-w-lg mb-12">
          <Heading level={1} variant="pageTitle" className="tracking-tight text-gradient">
            Choose Your FinScreen Plan
          </Heading>
          <p className="mt-2 text-body font-normal text-textSecondary leading-relaxed">
            Institutional-grade stock screening, 10-year financials, and automated alarms ·{' '}
            <span className="font-medium text-accent">
              Cancel Anytime
            </span>
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Basic (Free) */}
          <Card className="border-border/40 bg-surface shadow-xs flex flex-col justify-between h-[450px] rounded-2xl">
            <div className="p-6">
              <Text variant="label" className="text-xs text-textMuted tracking-widest block">
                Basic Plan
              </Text>
              <div className="mt-3 flex items-baseline gap-1">
                <Text variant="pageTitle" as="span" className="text-3xl font-medium font-mono tracking-tight text-textPrimary">
                  ₹0
                </Text>
                <Text variant="bodyMuted" as="span" className="text-textMuted text-xs font-medium">/ year</Text>
              </div>
              <Text variant="bodyMuted" className="mt-2 text-xs text-textSecondary leading-relaxed">
                Standard fundamental screening and 5-year financials. Ideal for retail investors.
              </Text>

              <ul className="mt-6 space-y-3 text-xs font-medium text-textSecondary">
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Standard stock screening
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  5-year financial statements history
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Up to 3 watchlists
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Standard CSV reports export
                </li>
              </ul>
            </div>

            <div className="p-6 bg-surfaceMuted/50 border-t border-border/40 shrink-0">
              <Button asChild variant="outline" className="w-full font-medium text-xs uppercase h-10 border-border/40 text-textSecondary hover:bg-surfaceMuted">
                <Link to="/">Get Started Free</Link>
              </Button>
            </div>
          </Card>

          {/* Premium (Pro) */}
          <Card className="border-accent/20 relative shadow-md bg-surface flex flex-col justify-between h-[450px] rounded-2xl">
            {/* Best Value Badge */}
            <span className="absolute top-0 right-6 -translate-y-1/2 bg-accent text-white px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider shadow-none">
              Most Popular
            </span>

            <div className="p-6">
              <Text variant="label" className="text-xs text-accent tracking-widest block">
                Premium Plan
              </Text>
              <div className="mt-3 flex items-baseline gap-1">
                <Text variant="pageTitle" as="span" className="text-3xl font-medium font-mono tracking-tight text-textPrimary">
                  ₹4,999
                </Text>
                <Text variant="bodyMuted" as="span" className="text-textMuted text-xs font-medium">/ year</Text>
              </div>
              <Text variant="bodyMuted" className="mt-2 text-xs text-textSecondary leading-relaxed">
                Full 15-year histories, unlimited watchlists, instant price target alerts, and custom ratio builder.
              </Text>

              <ul className="mt-6 space-y-3 text-xs font-medium text-textSecondary">
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Complete 15-year financials history
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Unlimited watchlists & alert triggers
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Screener Custom Ratio Builder
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-accent shrink-0" />
                  Institutional Excel export & PDF filings
                </li>
              </ul>
            </div>

            <div className="p-6 bg-surfaceMuted/50 border-t border-border/40 shrink-0">
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase h-10 shadow-none">
                <Link to="/">Upgrade to Pro</Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 w-full max-w-2xl border-t border-border/40 pt-8">
          <div className="flex items-center gap-3 justify-center">
            <ShieldCheck className="size-5 text-accent shrink-0" />
            <div className="text-left">
              <Text variant="body" className="font-medium text-textPrimary text-xs">Secure Payments</Text>
              <Text variant="caption" className="text-xs text-textMuted mt-0.5 font-medium leading-none">256-bit SSL encrypted</Text>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <HeartHandshake className="size-5 text-accent shrink-0" />
            <div className="text-left">
              <Text variant="body" className="font-medium text-textPrimary text-xs">Cancel Anytime</Text>
              <Text variant="caption" className="text-xs text-textMuted mt-0.5 font-medium leading-none">100% money back guarantee</Text>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <Headphones className="size-5 text-accent shrink-0" />
            <div className="text-left">
              <Text variant="body" className="font-medium text-textPrimary text-xs">24/7 Premium Help</Text>
              <Text variant="caption" className="text-xs text-textMuted mt-0.5 font-medium leading-none">Priority support queues</Text>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-border/40 flex items-center justify-center shrink-0 bg-surface">
        <Text variant="caption" className="text-xs text-textMuted font-medium uppercase tracking-wider">
          Data sourced from institutional feeds. Accuracy is our priority.
        </Text>
      </footer>
    </div>
  )
}

export default Pricing

