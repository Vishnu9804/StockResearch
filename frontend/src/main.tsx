import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ReduxProvider } from './store/Provider'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ThemeProvider } from './components/theme-provider'
import './globals.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>
)
