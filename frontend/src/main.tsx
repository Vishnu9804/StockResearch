import ReactDOM from 'react-dom/client'
import App from './App'
import { ReduxProvider } from './store/Provider'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ThemeProvider } from './components/theme-provider'
import './globals.css'
import { Toaster } from 'react-hot-toast'

// Note: React.StrictMode is intentionally removed.
// AuthGuard previously dispatched checkAuthStart from a useEffect — StrictMode's
// intentional double-mount in dev caused 4+ /profile calls on every page load.
// Auth init is now centralised in rootSaga's initSaga, making StrictMode removal unnecessary.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackType="global">
    <ReduxProvider>
      <ThemeProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            },
            success: { style: { borderColor: 'var(--positive)', color: 'var(--positive)' } },
            error: { style: { borderColor: 'var(--negative)', color: 'var(--negative)' } },
          }}
        />
      </ThemeProvider>
    </ReduxProvider>
  </ErrorBoundary>
)
