import { useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPortfoliosStart } from '@/store/slices/portfolioSlice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { UploadCloud } from 'lucide-react'

export default function Portfolio() {
  const dispatch = useAppDispatch()
  const { portfolios, hasPortfolio, status } = useAppSelector((state) => state.portfolio)

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchPortfoliosStart())
    }
  }, [status, dispatch])

  const handleUploadClick = () => {
    toast('Portfolio upload is coming soon!')
  }

  if (status === 'loading' && !hasPortfolio) {
    return <div className="p-8 text-center text-textSecondary">Loading your portfolio...</div>
  }

  // EMPTY STATE: user is logged in but hasn't uploaded a portfolio yet
  if (!hasPortfolio) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center h-[60vh] border-2 border-dashed border-border rounded-lg">
          <UploadCloud className="size-10 text-textMuted mb-3" />
          <h2 className="text-2xl font-semibold mb-2 text-textPrimary">No Portfolio Found</h2>
          <p className="text-textSecondary mb-6 text-center max-w-md">
            Upload your portfolio for a better experience — see your holdings, performance, and insights all in one place.
          </p>
          <Button onClick={handleUploadClick}>
            <UploadCloud className="size-4 mr-2" />
            Upload Portfolio
          </Button>
        </div>
      </div>
    )
  }

  // REAL DATA STATE
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-textPrimary">Your Portfolio</h1>

      {portfolios.map((portfolio) => (
        <Card key={portfolio.id} className="border-border/40">
          <CardHeader className="font-semibold text-textPrimary">{portfolio.name}</CardHeader>
          <CardContent>
            {portfolio.holdings.length === 0 ? (
              <p className="text-textSecondary text-sm">No holdings in this portfolio yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-textMuted border-b border-border">
                      <th className="py-2 pr-4 font-medium">Symbol</th>
                      <th className="py-2 pr-4 font-medium">Company</th>
                      <th className="py-2 pr-4 font-medium text-right">Quantity</th>
                      <th className="py-2 pr-4 font-medium text-right">Avg. Buy Price</th>
                      <th className="py-2 pr-4 font-medium">Buy Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((holding) => (
                      <tr key={holding.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-4 font-medium text-textPrimary">{holding.symbol}</td>
                        <td className="py-2 pr-4 text-textSecondary">{holding.companyName}</td>
                        <td className="py-2 pr-4 text-right text-textPrimary">{holding.quantity}</td>
                        <td className="py-2 pr-4 text-right text-textPrimary">
                          ₹{holding.avgBuyPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 pr-4 text-textSecondary">{holding.buyDate ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
