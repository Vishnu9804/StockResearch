import React, { Suspense, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Building2, Globe, Users, Calendar, Fingerprint, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { companies } from '@/lib/data/companies'
import { CompanyHeader } from '@/components/company/company-header'
import { KeyMetricsGrid } from '@/components/company/KeyMetricsGrid'
import { StickySubNav } from '@/components/company/StickySubNav'
import { StrengthsLimitations } from '@/components/company/strengths-limitations'
import { ScrollReveal } from '@/components/shared/ScrollReveal'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchCompanyStart, resetCompany } from '@/store/slices/companySlice'

// Lazy Load heavy/below-the-fold child components to maximize network & initial rendering performance
const PriceChart = React.lazy(() =>
  import('@/components/company/price-chart').then((m) => ({ default: m.PriceChart }))
)
const PeerComparison = React.lazy(() =>
  import('@/components/company/peer-comparison').then((m) => ({ default: m.PeerComparison }))
)
const QuarterlyResultsTable = React.lazy(() =>
  import('@/components/company/QuarterlyResultsTable').then((m) => ({ default: m.QuarterlyResultsTable }))
)
const ProfitLossTable = React.lazy(() =>
  import('@/components/company/ProfitLossTable').then((m) => ({ default: m.ProfitLossTable }))
)
const BalanceSheetTable = React.lazy(() =>
  import('@/components/company/BalanceSheetTable').then((m) => ({ default: m.BalanceSheetTable }))
)
const CashFlowTable = React.lazy(() =>
  import('@/components/company/CashFlowTable').then((m) => ({ default: m.CashFlowTable }))
)
const RatiosTable = React.lazy(() =>
  import('@/components/company/RatiosTable').then((m) => ({ default: m.RatiosTable }))
)
const AnalystConsensus = React.lazy(() =>
  import('@/components/company/AnalystConsensus').then((m) => ({ default: m.AnalystConsensus }))
)
const ShareholdingChart = React.lazy(() =>
  import('@/components/company/shareholding').then((m) => ({ default: m.ShareholdingChart }))
)
const ShareholdingTable = React.lazy(() =>
  import('@/components/company/shareholding').then((m) => ({ default: m.ShareholdingTable }))
)
const CorporateActionsTable = React.lazy(() =>
  import('@/components/company/CorporateActionsTable').then((m) => ({ default: m.CorporateActionsTable }))
)
const DocumentsList = React.lazy(() =>
  import('@/components/company/DocumentsList').then((m) => ({ default: m.DocumentsList }))
)

// Dark-mode–aware skeleton using CSS variable tokens from globals.css
function SectionSkeleton() {
  return (
    <div className="w-full h-64 bg-surface border border-border rounded-2xl animate-pulse p-6 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="h-4 bg-skeletonBase shimmer-skeleton rounded w-1/4"></div>
        <div className="h-3 bg-skeletonBase shimmer-skeleton rounded w-3/4"></div>
        <div className="h-3 bg-skeletonBase shimmer-skeleton rounded w-1/2"></div>
      </div>
      <div className="space-y-2 pt-4">
        <div className="h-10 bg-skeletonBase shimmer-skeleton rounded w-full"></div>
        <div className="h-10 bg-skeletonBase shimmer-skeleton rounded w-full"></div>
      </div>
    </div>
  )
}

export function CompanyDetail() {
  const { symbol } = useParams<{ symbol: string }>()
  const dispatch = useAppDispatch()

  const companyData = useAppSelector((state) => state.company.data)
  const companyStatus = useAppSelector((state) => state.company.status)

  useEffect(() => {
    if (symbol) {
      dispatch(fetchCompanyStart(symbol))
    }
    return () => {
      dispatch(resetCompany())
    }
  }, [symbol, dispatch])

  const localCompany = companies.find((c) => c.symbol === symbol?.toUpperCase())
  const company = companyData || localCompany

  if (!company) {
    if (companyStatus === 'loading') {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-full max-w-md space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4 mx-auto animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto animate-pulse"></div>
            <div className="h-32 bg-slate-200 rounded w-full animate-pulse"></div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="max-w-md bg-surface border border-border rounded-2xl p-8 shadow-none flex flex-col items-center gap-4">
          <div className="size-12 rounded-xl bg-negative-soft border border-negative/20 flex items-center justify-center text-negative">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <Heading level={2} variant="sectionTitle" className="text-textPrimary">Company Not Found</Heading>
            <Text variant="caption" className="text-textSecondary leading-relaxed text-xs">
              We couldn&apos;t find any Indian equity mapped to the symbol <span className="font-mono font-bold text-textPrimary">`{symbol?.toUpperCase()}`</span>. Please verify the exchange ticker.
            </Text>
          </div>
          <Button asChild className="bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase h-9 shadow-none w-full mt-2">
            <Link to="/" className="flex items-center gap-1.5 justify-center">
              <ArrowLeft className="size-3.5" /> Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background overflow-hidden font-sans">
      {/* 1. Header Section */}
      <CompanyHeader company={company} />

      {/* 2. Key Fundamentals Flat Grid */}
      <KeyMetricsGrid {...company} />

      {/* 3. Sticky Tabbed Navigation */}
      <StickySubNav />

      {/* 4. Anchor Content Areas */}
      <div className="px-6 py-8 space-y-12 max-w-[1600px] mx-auto w-full">
        {/* SECTION: Overview & About */}
        <section id="overview" className="scroll-mt-36">
          <ScrollReveal className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2 border-border shadow-none bg-surface">
              <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
                <CardTitle>
                  <Text variant="label" as="span" className="text-xs text-textPrimary">
                    About {company.name}
                  </Text>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 leading-relaxed text-textSecondary text-xs font-medium">
                <p>{company.description}</p>
                
                {/* Dynamic pros & cons nested under overview */}
                <div className="mt-6">
                  <StrengthsLimitations company={company} />
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-1 border-border shadow-none bg-surface">
              <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
                <CardTitle>
                  <Text variant="label" as="span" className="text-xs text-textPrimary">
                    Corporate Directory
                  </Text>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <dl className="space-y-4 text-xs font-medium">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <dt className="text-textSecondary flex items-center gap-1.5">
                      <Globe className="size-3.5 text-accent" /> Website
                    </dt>
                    <dd>
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {company.website.replace('https://', '')}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <dt className="text-textSecondary flex items-center gap-1.5">
                      <Fingerprint className="size-3.5 text-accent" /> ISIN
                    </dt>
                    <dd className="font-mono text-textPrimary">{company.isin}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <dt className="text-textSecondary flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-accent" /> Founded
                    </dt>
                    <dd className="text-textPrimary">{company.founded}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <dt className="text-textSecondary flex items-center gap-1.5">
                      <Users className="size-3.5 text-accent" /> Employees
                    </dt>
                    <dd className="text-textPrimary">{company.employees.toLocaleString('en-IN')}</dd>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <dt className="text-textSecondary flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-accent" /> Credit Rating
                    </dt>
                    <dd>
                      <Badge variant="outline" className="bg-accentSoft text-accent border-accent/20 text-[10px] font-bold shadow-none">
                        {company.creditRating}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </ScrollReveal>
        </section>

        {/* SECTION: Price Chart */}
        <section id="chart" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <PriceChart
                symbol={company.symbol}
                basePrice={company.price}
                high52={company.high52w}
                low52={company.low52w}
              />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Peer Comparison */}
        <section id="peers" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <PeerComparison symbol={company.symbol} sector={company.sector} />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Quarterly Results */}
        <section id="quarters" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <QuarterlyResultsTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Profit & Loss */}
        <section id="pl" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <ProfitLossTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Balance Sheet */}
        <section id="balance-sheet" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <BalanceSheetTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Cash Flow */}
        <section id="cash-flow" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <CashFlowTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Key Ratios */}
        <section id="ratios" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <RatiosTable
                pe={company.pe}
                price={company.price}
                high52w={company.high52w}
                low52w={company.low52w}
              />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Analyst Consensus */}
        <section id="analyst" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <AnalystConsensus
                symbol={company.symbol}
                cmp={company.price}
                pe={company.pe}
              />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Shareholding Pattern */}
        <section id="shareholding" className="scroll-mt-36">
          <ScrollReveal className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Suspense fallback={<SectionSkeleton />}>
              <ShareholdingChart />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
              <ShareholdingTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Corporate Actions */}
        <section id="corporate-actions" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <CorporateActionsTable />
            </Suspense>
          </ScrollReveal>
        </section>

        {/* SECTION: Documents List */}
        <section id="documents" className="scroll-mt-36">
          <ScrollReveal>
            <Suspense fallback={<SectionSkeleton />}>
              <DocumentsList />
            </Suspense>
          </ScrollReveal>
        </section>
      </div>
    </div>
  )
}

export default CompanyDetail

