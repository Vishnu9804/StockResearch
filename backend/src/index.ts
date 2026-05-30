import app from './app.js'
import CONFIG from './config/index.js'
import { logger } from './utils/logger.js'
import { startScheduler } from './services/scheduler.js'

const server = app.listen(CONFIG.PORT, () => {
  logger.info(`⚡ [FinScreen Backend] Server is running in ${CONFIG.NODE_ENV} mode on port ${CONFIG.PORT}`)
  
  // Start the background cron alerts scheduler
  startScheduler()
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down server...')
  server.close(() => {
    logger.info('Server process closed.')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down server...')
  server.close(() => {
    logger.info('Server process closed.')
    process.exit(0)
  })
})
