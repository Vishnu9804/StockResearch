import { useEffect } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { CheckCircle, XCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'

export function PaymentResult() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isSuccess = location.pathname.includes('/success')
  const plan = searchParams.get('plan') || 'PRO'
  const reason = searchParams.get('reason') || 'Transaction failed'
  const txnId = searchParams.get('txnid') || ''

  useEffect(() => {
    // Optional: force user profile refresh/reload here if auth slice is tracking plan
  }, [isSuccess])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <Card className="max-w-md w-full border-border/40 shadow-lg bg-surface rounded-2xl overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center gap-6">
          {isSuccess ? (
            <>
              <div className="size-16 rounded-full bg-positive-soft/60 text-positive flex items-center justify-center animate-bounce">
                <CheckCircle className="size-10" />
              </div>
              <div className="space-y-2">
                <Heading level={2} variant="sectionTitle" className="text-textPrimary">
                  Payment Successful!
                </Heading>
                <Text variant="bodyMuted" className="text-xs text-textSecondary leading-relaxed">
                  Thank you! Your account has been upgraded to <span className="font-semibold text-accent">{plan}</span>. You now have full access to FinScreen Pro features.
                </Text>
              </div>
              {txnId && (
                <div className="w-full bg-surfaceMuted/50 border border-border/40 rounded-xl px-4 py-2.5 text-left font-mono text-[10px] text-textMuted flex items-center justify-between">
                  <span>Txn ID:</span>
                  <span className="font-medium text-textSecondary">{txnId}</span>
                </div>
              )}
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase h-10 shadow-none mt-2">
                <Link to="/account" className="flex items-center gap-1.5 justify-center">
                  Go to Account <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="size-16 rounded-full bg-negative-soft/60 text-negative flex items-center justify-center">
                <XCircle className="size-10" />
              </div>
              <div className="space-y-2">
                <Heading level={2} variant="sectionTitle" className="text-textPrimary">
                  Payment Failed
                </Heading>
                <Text variant="bodyMuted" className="text-xs text-textSecondary leading-relaxed">
                  We couldn't process your payment. Reason: <span className="font-semibold text-negative">{reason}</span>. No money was debited from your account.
                </Text>
              </div>
              {txnId && (
                <div className="w-full bg-surfaceMuted/50 border border-border/40 rounded-xl px-4 py-2.5 text-left font-mono text-[10px] text-textMuted flex items-center justify-between">
                  <span>Txn ID:</span>
                  <span className="font-medium text-textSecondary">{txnId}</span>
                </div>
              )}
              <div className="w-full flex gap-3 mt-2">
                <Button asChild variant="outline" className="flex-1 font-medium text-xs uppercase h-10 border-border/40 text-textSecondary hover:bg-surfaceMuted">
                  <Link to="/">Back to Markets</Link>
                </Button>
                <Button asChild className="flex-1 bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase h-10 shadow-none">
                  <Link to="/pricing">Try Again</Link>
                </Button>
              </div>
            </>
          )}

          <div className="w-full border-t border-border/40 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-textMuted font-medium">
            <ShieldCheck className="size-3.5 text-accent" /> Secure Payment via PayU India
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentResult
