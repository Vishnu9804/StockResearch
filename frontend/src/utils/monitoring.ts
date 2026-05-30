/**
 * frontend/src/utils/monitoring.ts
 * Unified client-side monitoring and observability layer.
 * Facilitates easy integration of Sentry or telemetry clients without code sweeping.
 */

export const monitoring = {
  /**
   * Log exceptional events or crashes to centralized monitoring platforms
   */
  logError(error: Error | any, context?: Record<string, any>): void {
    console.error('[Monitoring] Caught Client Exception:', {
      message: error?.message || error,
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString(),
    })

    // Future Sentry configuration:
    // import * as Sentry from '@sentry/react'
    // Sentry.captureException(error, { extra: context })
  },

  /**
   * Track specific analytical conversion parameters or client flow milestones
   */
  logEvent(name: string, data?: Record<string, any>): void {
    console.log(`[Monitoring] Analytical Event: "${name}"`, {
      data,
      timestamp: new Date().toISOString(),
    })

    // Future Sentry/Google Analytics configuration:
    // Sentry.captureMessage(`Event: ${name}`, { extra: data })
  },
}

export default monitoring
