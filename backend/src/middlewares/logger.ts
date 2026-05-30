import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

export interface LoggedRequest extends Request {
  id?: string
  startTime?: number
}

export function requestLogger(req: LoggedRequest, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  req.id = reqId
  req.startTime = Date.now()
  res.setHeader('X-Request-ID', reqId)

  logger.info(`Incoming Request: [${req.method}] ${req.originalUrl} - ID: ${reqId} - IP: ${req.ip}`)

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0
    logger.info(`Request Completed: [${req.method}] ${req.originalUrl} - Status: ${res.statusCode} - ID: ${reqId} - Duration: ${duration}ms - Size: ${res.getHeader('content-length') || 0} bytes`)
  })

  next()
}

export default requestLogger
