/**
 * backend/src/routes/finedge.ts
 * Clean routing config for FinEdge API proxy endpoints
 */

import { Router } from 'express'
import { proxyRequest } from '../controllers/finedge.js'

export const finedgeRouter = Router()

// Forward all requests to the controller handler
finedgeRouter.all('/*', proxyRequest)

export default finedgeRouter
