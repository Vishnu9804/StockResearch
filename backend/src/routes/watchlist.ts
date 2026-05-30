/**
 * backend/src/routes/watchlist.ts
 * Clean routing config for watchlists and target price targets
 */

import { Router } from 'express'
import { authGuard } from '../middlewares/auth.js'
import {
  getWatchlists,
  createWatchlist,
  addItem,
  updateItem,
  deleteItem,
  deleteWatchlist
} from '../controllers/watchlist.js'
import {
  validateRequest,
  watchlistSchema,
  watchlistAddItemSchema,
  watchlistUpdateItemSchema
} from '../middlewares/validation.js'

export const watchlistRouter = Router()

// Protect all watchlist routes
watchlistRouter.use(authGuard)

// 1. Get all watchlists of the user
watchlistRouter.get('/', getWatchlists)

// 2. Create a new named watchlist
watchlistRouter.post('/', validateRequest({ body: watchlistSchema }), createWatchlist)

// 3. Add a stock ticker to a watchlist
watchlistRouter.post('/:id/items', validateRequest({ body: watchlistAddItemSchema }), addItem)

// 4. Update an item target price and alert status
watchlistRouter.put('/items/:itemId', validateRequest({ body: watchlistUpdateItemSchema }), updateItem)

// 5. Delete an item from a watchlist
watchlistRouter.delete('/items/:itemId', deleteItem)

// 6. Delete a watchlist completely
watchlistRouter.delete('/:id', deleteWatchlist)

export default watchlistRouter
