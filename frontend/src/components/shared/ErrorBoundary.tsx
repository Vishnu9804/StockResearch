/**
 * frontend/src/components/shared/ErrorBoundary.tsx
 * Premium React Error Boundary designed to isolate UI crashes.
 * Supports both fullscreen app failures and localized modular component isolates.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RotateCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'
import { monitoring } from '@/utils/monitoring'

interface Props {
  children: ReactNode
  fallbackType?: 'global' | 'section'
  title?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    monitoring.logError(error, {
      componentStack: errorInfo.componentStack || 'No Component Stack',
    })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  public render() {
    if (this.state.hasError) {
      const { fallbackType = 'section', title } = this.props

      if (fallbackType === 'global') {
        return (
          <div className="fixed inset-0 bg-background flex items-center justify-center p-6 text-center select-none font-sans">
            <div className="max-w-md bg-surface border border-border rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 animate-fade-in-up">
              <div className="size-16 rounded-2xl bg-negative-soft border border-negative/10 flex items-center justify-center text-negative animate-bounce">
                <AlertOctagon className="size-8" />
              </div>
              
              <div className="space-y-2">
                <Heading level={1} variant="pageTitle" className="text-textPrimary text-2xl font-bold">
                  System Error Detected
                </Heading>
                <Text variant="caption" className="text-textSecondary leading-relaxed text-xs">
                  We encountered an unhandled exception while compiling market telemetry. Rest assured, our logs have captured this anomaly and we are on it.
                </Text>
              </div>

              <div className="w-full flex gap-3 mt-2">
                <Button 
                  onClick={this.handleRetry} 
                  className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase h-10 shadow-none"
                >
                  <RotateCcw className="size-3.5 mr-1.5" /> Retry Session
                </Button>
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome} 
                  className="flex-1 border-border bg-surfaceMuted hover:bg-slate-100 text-textPrimary font-bold text-xs uppercase h-10 shadow-none"
                >
                  <Home className="size-3.5 mr-1.5" /> Dashboard
                </Button>
              </div>
            </div>
          </div>
        )
      }

      // Section-level localized fallback card (isolates widget crashes)
      return (
        <div className="w-full bg-surface border border-border rounded-2xl p-6 text-center select-none flex flex-col items-center justify-center gap-4 min-h-[220px]">
          <div className="size-10 rounded-xl bg-negative-soft border border-negative/10 flex items-center justify-center text-negative">
            <AlertOctagon className="size-5" />
          </div>
          <div className="space-y-1">
            <Heading level={3} variant="sectionTitle" className="text-textPrimary text-sm font-bold">
              {title || 'Component Unavailable'}
            </Heading>
            <Text variant="caption" className="text-textMuted text-[10px] leading-relaxed max-w-[280px]">
              This analytical metric card failed to mount correctly. Try refreshing this individual section.
            </Text>
          </div>
          <Button 
            onClick={this.handleRetry} 
            className="bg-accentSoft hover:bg-accent/10 border border-accent/20 text-accent font-bold text-[10px] uppercase h-7 px-3 rounded-lg shadow-none flex items-center gap-1 mt-1"
          >
            <RotateCcw className="size-3" /> Refresh Section
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
