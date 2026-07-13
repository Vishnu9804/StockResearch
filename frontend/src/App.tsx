import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import AuthLayout from './layouts/AuthLayout'
import { NavigationHandler } from './components/shared/NavigationHandler'

// Import Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Pricing from './pages/Pricing'
import Screener from './pages/Screener'
import ScreenerResults from './pages/ScreenerResults'
import CompanyDetail from './pages/CompanyDetail'
import IndexDetail from './pages/IndexDetail'
import ScreenGallery from './pages/ScreenGallery'
import { MarketPulse } from './pages/market-pulse/MarketPulse'
import { NewIssues } from './pages/market-pulse/NewIssues'
import Feed from './pages/Feed'
import PaymentResult from './pages/PaymentResult'
import Announcements from './pages/market-pulse/Announcements'
import Industries from './pages/market-pulse/Industries'
import AnnualReports from './pages/market-pulse/AnnualReports'
import Dividends from './pages/market-pulse/Dividends'
import BulkDeals from './pages/market-pulse/BulkDeals'
import BlockDeals from './pages/market-pulse/BlockDeals'
import SASTTrades from './pages/market-pulse/SASTTrades'
import InsiderTrades from './pages/market-pulse/InsiderTrades'
import { Concalls, UpcomingConcalls } from './pages/market-pulse/Concalls'
import Results from './pages/market-pulse/Results'
import { Holidays } from './pages/market-pulse/Holidays'
import { Commodities } from './pages/market-pulse/Commodities'

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavigationHandler />
      <Routes>
        {/* Auth Group - Kept for design reference, but out of active enforcement flow */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment/success" element={<PaymentResult />} />
        <Route path="/payment/failure" element={<PaymentResult />} />

        {/* Dashboard Group */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/screener/results" element={<ScreenerResults />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="/index/:symbol" element={<IndexDetail />} />
          <Route path="/screens" element={<ScreenGallery />} />
          <Route path="/feed" element={<Feed />} />

          {/* Market Pulse Routes */}
          <Route path="/market-pulse" element={<MarketPulse />} />
          <Route path="/market-pulse/new-issues" element={<NewIssues />} />
          <Route path="/market-pulse/announcements" element={<Announcements />} />
          <Route path="/market-pulse/industries" element={<Industries />} />
          <Route path="/market-pulse/annual-reports" element={<AnnualReports />} />
          <Route path="/market-pulse/dividends" element={<Dividends />} />
          <Route path="/market-pulse/bulk-deals" element={<BulkDeals />} />
          <Route path="/market-pulse/block-deals" element={<BlockDeals />} />
          <Route path="/market-pulse/sast-trades" element={<SASTTrades />} />
          <Route path="/market-pulse/insider-trades" element={<InsiderTrades />} />
          <Route path="/market-pulse/concalls" element={<Concalls />} />
          <Route path="/market-pulse/upcoming-concalls" element={<UpcomingConcalls />} />
          <Route path="/market-pulse/results" element={<Results />} />
          <Route path="/market-pulse/holidays" element={<Holidays />} />
          <Route path="/market-pulse/commodities" element={<Commodities />} />
        </Route>

        {/* Fallback redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App