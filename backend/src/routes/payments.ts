/**
 * backend/src/routes/payments.ts
 * Clean routing config for PayU subscription checkouts
 */

import { Router } from 'express'
import { authGuard } from '../middlewares/auth.js'
import { createOrder, successCallback, failureCallback } from '../controllers/payments.js'

export const paymentsRouter = Router()

// 1. Initiate PayU order (Requires user session auth)
paymentsRouter.post('/payu/create-order', authGuard, createOrder)

// 2. Webhook Success callback (Public endpoint triggered POST from PayU secure servers)
paymentsRouter.post('/payu/success', successCallback)

// 3. Webhook Failure callback (Public endpoint triggered POST from PayU secure servers)
paymentsRouter.post('/payu/failure', failureCallback)

export default paymentsRouter
