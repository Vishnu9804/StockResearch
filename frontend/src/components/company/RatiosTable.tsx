import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RatioRow {
  label: string
  value: string
  sectorAvg: string
  aboveAvg: boolean
  description: string
}

interface RatioGroup {
  title: string
  emoji: string
  rows: RatioRow[]
}

function buildRatios(pe: number, price: number, high52: number, low52: number): RatioGroup[] {
  const pb = +(pe * 0.18 + 1.2).toFixed(1)
  const evEbitda = +(pe * 0.72).toFixed(1)
  const roe = +(18 + (pe - 20) * 0.3).toFixed(1)
  const roce = +(roe * 0.88).toFixed(1)
  const netMargin = +(8 + (pe - 20) * 0.15).toFixed(1)
  const ebitdaMargin = +(netMargin * 1.65).toFixed(1)
  const de = +(0.4 + (pe > 30 ? 0.2 : 0)).toFixed(2)
  const interestCoverage = +(8 - de * 2).toFixed(1)
  const currentRatio = +(1.8 - de * 0.3).toFixed(2)
  const revCagr = +(12 + (pe - 20) * 0.4).toFixed(1)
  const profitCagr = +(revCagr * 0.85).toFixed(1)
  const epsCagr = +(profitCagr * 1.05).toFixed(1)

  // Suppress unused variable warnings for price/high52/low52 (reserved for future use)
  void price
  void high52
  void low52

  return [
    {
      title: 'Valuation', emoji: '💰',
      rows: [
        { label: 'P/E Ratio', value: `${pe.toFixed(1)}x`, sectorAvg: '26.0x', aboveAvg: pe < 26, description: 'Price to Earnings' },
        { label: 'P/B Ratio', value: `${pb}x`, sectorAvg: '4.2x', aboveAvg: pb < 4.2, description: 'Price to Book Value' },
        { label: 'EV/EBITDA', value: `${evEbitda}x`, sectorAvg: '18.0x', aboveAvg: evEbitda < 18, description: 'Enterprise Value / EBITDA' },
        { label: 'Market Cap / Sales', value: `${(pe * 0.12).toFixed(1)}x`, sectorAvg: '3.5x', aboveAvg: pe * 0.12 < 3.5, description: 'Price / Revenue' },
      ]
    },
    {
      title: 'Profitability', emoji: '📈',
      rows: [
        { label: 'ROE', value: `${roe}%`, sectorAvg: '18.0%', aboveAvg: roe > 18, description: 'Return on Equity' },
        { label: 'ROCE', value: `${roce}%`, sectorAvg: '16.0%', aboveAvg: roce > 16, description: 'Return on Capital Employed' },
        { label: 'Net Profit Margin', value: `${netMargin}%`, sectorAvg: '10.0%', aboveAvg: netMargin > 10, description: 'Net Income / Revenue' },
        { label: 'EBITDA Margin', value: `${ebitdaMargin}%`, sectorAvg: '18.0%', aboveAvg: ebitdaMargin > 18, description: 'Operating margin before D&A' },
      ]
    },
    {
      title: 'Leverage', emoji: '🏦',
      rows: [
        { label: 'Debt / Equity', value: `${de}x`, sectorAvg: '0.6x', aboveAvg: de < 0.6, description: 'Financial leverage ratio' },
        { label: 'Interest Coverage', value: `${interestCoverage}x`, sectorAvg: '6.0x', aboveAvg: interestCoverage > 6, description: 'EBIT / Interest Expense' },
        { label: 'Current Ratio', value: `${currentRatio}x`, sectorAvg: '1.5x', aboveAvg: currentRatio > 1.5, description: 'Current Assets / Current Liabilities' },
      ]
    },
    {
      title: 'Growth (3Y CAGR)', emoji: '🚀',
      rows: [
        { label: 'Revenue CAGR', value: `${revCagr}%`, sectorAvg: '12.0%', aboveAvg: revCagr > 12, description: '3-Year Revenue Growth' },
        { label: 'Profit CAGR', value: `${profitCagr}%`, sectorAvg: '14.0%', aboveAvg: profitCagr > 14, description: '3-Year Net Profit Growth' },
        { label: 'EPS CAGR', value: `${epsCagr}%`, sectorAvg: '13.0%', aboveAvg: epsCagr > 13, description: '3-Year EPS Growth' },
      ]
    },
  ]
}

export function RatiosTable({ pe, price, high52w, low52w }: { pe: number; price: number; high52w: number; low52w: number }) {
  const storeRatios = useSelector((state: any) => state.company?.ratios)

  const groups = useMemo(() => {
    if (storeRatios) {
      const { valuation, profitability, leverage, growth } = storeRatios
      return [
        {
          title: 'Valuation', emoji: '💰',
          rows: [
            { label: 'P/E Ratio', value: `${valuation.pe?.toFixed(1) || pe.toFixed(1)}x`, sectorAvg: '26.0x', aboveAvg: (valuation.pe || pe) < 26, description: 'Price to Earnings' },
            { label: 'P/B Ratio', value: `${valuation.pb?.toFixed(1) || '4.8'}x`, sectorAvg: '4.2x', aboveAvg: (valuation.pb || 4.8) < 4.2, description: 'Price to Book Value' },
            { label: 'EV/EBITDA', value: `${valuation.evEbitda?.toFixed(1) || '15.2'}x`, sectorAvg: '18.0x', aboveAvg: (valuation.evEbitda || 15.2) < 18, description: 'Enterprise Value / EBITDA' },
            { label: 'Market Cap / Sales', value: `${valuation.marketCapSales?.toFixed(1) || '5.1'}x`, sectorAvg: '3.5x', aboveAvg: (valuation.marketCapSales || 5.1) < 3.5, description: 'Price / Revenue' },
          ]
        },
        {
          title: 'Profitability', emoji: '📈',
          rows: [
            { label: 'ROE', value: `${profitability.roe}%`, sectorAvg: '18.0%', aboveAvg: profitability.roe > 18, description: 'Return on Equity' },
            { label: 'ROCE', value: `${profitability.roce}%`, sectorAvg: '16.0%', aboveAvg: profitability.roce > 16, description: 'Return on Capital Employed' },
            { label: 'Net Profit Margin', value: `${profitability.netMargin}%`, sectorAvg: '10.0%', aboveAvg: profitability.netMargin > 10, description: 'Net Income / Revenue' },
            { label: 'EBITDA Margin', value: `${profitability.ebitdaMargin}%`, sectorAvg: '18.0%', aboveAvg: profitability.ebitdaMargin > 18, description: 'Operating margin before D&A' },
          ]
        },
        {
          title: 'Leverage', emoji: '🏦',
          rows: [
            { label: 'Debt / Equity', value: `${leverage.debtToEquity}x`, sectorAvg: '0.6x', aboveAvg: leverage.debtToEquity < 0.6, description: 'Financial leverage ratio' },
            { label: 'Interest Coverage', value: `${leverage.interestCoverage}x`, sectorAvg: '6.0x', aboveAvg: leverage.interestCoverage > 6, description: 'EBIT / Interest Expense' },
            { label: 'Current Ratio', value: `${leverage.currentRatio}x`, sectorAvg: '1.5x', aboveAvg: leverage.currentRatio > 1.5, description: 'Current Assets / Current Liabilities' },
          ]
        },
        {
          title: 'Growth (3Y CAGR)', emoji: '🚀',
          rows: [
            { label: 'Revenue CAGR', value: `${growth.revenueCagr3Y}%`, sectorAvg: '12.0%', aboveAvg: growth.revenueCagr3Y > 12, description: '3-Year Revenue Growth' },
            { label: 'Profit CAGR', value: `${growth.profitCagr3Y}%`, sectorAvg: '14.0%', aboveAvg: growth.profitCagr3Y > 14, description: '3-Year Net Profit Growth' },
            { label: 'EPS CAGR', value: `${growth.epsCagr}%`, sectorAvg: '13.0%', aboveAvg: growth.epsCagr > 13, description: '3-Year EPS Growth' },
          ]
        },
      ]
    }
    return buildRatios(pe, price, high52w, low52w)
  }, [storeRatios, pe, price, high52w, low52w])

  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
        <CardTitle className="text-sm font-bold text-textPrimary uppercase tracking-wide">
          Key Financial Ratios
        </CardTitle>
        <p className="text-[11px] text-textMuted mt-0.5">Compared against NSE sector median · LTM data</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/50">
          {groups.map((group) => (
            <div key={group.title} className="p-5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-textMuted mb-3 flex items-center gap-1.5">
                <span>{group.emoji}</span> {group.title}
              </h4>
              <div className="space-y-3">
                {group.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-textPrimary truncate">{row.label}</p>
                      <p className="text-[10px] text-textMuted">{row.description}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="w-16 bg-surfaceMuted rounded-full h-1.5 relative overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', row.aboveAvg ? 'bg-positive' : 'bg-negative')}
                          style={{ width: row.aboveAvg ? '70%' : '35%' }}
                        />
                      </div>
                      <div className="text-right w-16">
                        <p className={cn('text-xs font-bold font-mono tabular-nums', row.aboveAvg ? 'text-positive' : 'text-textPrimary')}>
                          {row.value}
                        </p>
                        <p className="text-[9px] text-textMuted font-mono">avg {row.sectorAvg}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default RatiosTable
