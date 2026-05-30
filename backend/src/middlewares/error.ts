import type { Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'
import type { LoggedRequest } from './logger.js'

export function errorHandler(
  err: any,
  req: LoggedRequest,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.id || 'N/A'
  logger.error(`Unhandle Exception: ${err.message || err} - Request ID: ${reqId} - Path: ${req.originalUrl}\nStack: ${err.stack || 'No Stack'}`)

  const statusCode = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error. Please contact support.'
    : err.message || 'Internal Server Error'

  res.status(statusCode).json({
    error: true,
    message,
    requestId: reqId
  })
}

export default errorHandler
