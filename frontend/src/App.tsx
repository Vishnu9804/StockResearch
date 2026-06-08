import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import AuthLayout from './layouts/AuthLayout'
import { NavigationHandler } from './components/shared/NavigationHandler'
import { AuthGuard } from './components/shared/AuthGuard'

// Import Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Pricing from './pages/Pricing'
import Screener from './pages/Screener'
import ScreenerResults from './pages/ScreenerResults'
import Watchlists from './pages/Watchlists'
import Portfolio from './pages/Portfolio'
import CustomRatios from './pages/CustomRatios'
import CompanyDetail from './pages/CompanyDetail'
import IndexDetail from './pages/IndexDetail'
import ScreenGallery from './pages/ScreenGallery'
import Account from './pages/Account'

function ProtectedRoute() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  )
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* NavigationHandler bridges Redux navigateTo() actions → React Router navigate()
          Must be inside BrowserRouter so it has access to useNavigate() */}
      <NavigationHandler />

      <Routes>
        {/* Auth Group */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Pricing (Public page) */}
        <Route path="/pricing" element={<Pricing />} />

        {/* Dashboard Group */}
        <Route element={<DashboardLayout />}>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/screener/results" element={<ScreenerResults />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="/index/:symbol" element={<IndexDetail />} />
          <Route path="/screens" element={<ScreenGallery />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/watchlists" element={<Watchlists />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/custom-ratios" element={<CustomRatios />} />
            <Route path="/account" element={<Account />} />
            {/* Legacy profile — redirect to /account (was incorrectly rendering Profile.tsx) */}
            <Route path="/profile" element={<Navigate to="/account" replace />} />
          </Route>
        </Route>

        {/* Fallback redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
