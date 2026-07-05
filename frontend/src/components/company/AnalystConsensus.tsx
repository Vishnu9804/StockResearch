import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info } from 'lucide-react'

export function AnalystConsensus({ symbol }: { symbol: string; cmp: number; pe: number }) {
  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="border-b border-border/50 bg-surfaceMuted/20 py-3.5">
        <CardTitle className="text-xs font-semibold text-textPrimary uppercase tracking-wider">
          Analyst Consensus
        </CardTitle>
      </CardHeader>
      <CardContent className="p-10 flex flex-col items-center justify-center text-center">
        <div className="size-10 rounded-full bg-surfaceMuted flex items-center justify-center mb-3">
          <Info className="size-5 text-textMuted" />
        </div>
        <h4 className="text-xs font-semibold text-textPrimary uppercase tracking-wider mb-1">
          Consensus Data Not Available
        </h4>
        <p className="text-xs text-textMuted max-w-xs leading-relaxed font-medium">
          Analyst research coverage and target pricing consensus are currently not available for {symbol}.
        </p>
      </CardContent>
    </Card>
  )
}

export default AnalystConsensus
