/**
 * backend/src/routes/screener.ts
 * Clean routing config for saved screens and notifications
 */

import { Router } from 'express'
import { authGuard } from '../middlewares/auth.js'
import {
  getSavedScreens,
  saveScreen,
  deleteScreen,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/screener.js'
import { validateRequest, saveScreenSchema } from '../middlewares/validation.js'

export const screenerRouter = Router()

// Protect all screener config endpoints
screenerRouter.use(authGuard)

// 1. Get all saved screens for the user
screenerRouter.get('/saved', getSavedScreens)

// 2. Save a new screen
screenerRouter.post('/saved', validateRequest({ body: saveScreenSchema }), saveScreen)

// 3. Delete a saved screen
screenerRouter.delete('/saved/:id', deleteScreen)

// 4. Get in-app alert notifications for user
screenerRouter.get('/notifications', getNotifications)

// 5. Mark individual notification as read
screenerRouter.put('/notifications/:id/read', markNotificationRead)

// 6. Mark all notifications as read
screenerRouter.put('/notifications/read-all', markAllNotificationsRead)

export default screenerRouter
