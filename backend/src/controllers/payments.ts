/**
 * backend/src/controllers/payments.ts
 * HTTP handler for PayU subscription checkout endpoints
 */

import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.js'
import { PaymentsService } from '../services/payments.service.js'
import { CONFIG } from '../config/index.js'

export async function createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000'
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const dynamicBaseUrl = `${proto}://${host}/api`
    
    const orderData = await PaymentsService.createPayuOrder(userId, dynamicBaseUrl)
    return res.status(200).json({
      success: true,
      ...orderData
    })
  } catch (error: any) {
    next(error)
  }
}

export async function successCallback(req: any, res: Response, _next: NextFunction): Promise<any> {
  try {
    const txnId = await PaymentsService.processSuccessWebhook(req.body)
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000'
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const frontendUrl = `${proto}://${host}`
    return res.redirect(`${frontendUrl}/pricing?status=success&txnid=${txnId}`)
  } catch (error: any) {
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000'
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const frontendUrl = `${proto}://${host}`
    return res.redirect(`${frontendUrl}/pricing?status=failed&reason=${error.message || 'transaction_exception'}`)
  }
}

export async function failureCallback(req: any, res: Response, _next: NextFunction): Promise<any> {
  try {
    await PaymentsService.processFailureWebhook(req.body)
    const { txnid, message } = req.body
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000'
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const frontendUrl = `${proto}://${host}`
    return res.redirect(`${frontendUrl}/pricing?status=failed&txnid=${txnid}&reason=${encodeURIComponent(message || 'Payment Declined')}`)
  } catch (error: any) {
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000'
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const frontendUrl = `${proto}://${host}`
    return res.redirect(`${frontendUrl}/pricing?status=failed`)
  }
}

