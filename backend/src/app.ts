import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import CONFIG from './config/index.js'
import requestLogger from './middlewares/logger.js'
import errorHandler from './middlewares/error.js'

// Import Routers
import authRouter from './routes/auth.js'
import finedgeRouter from './routes/finedge.js'
import paymentsRouter from './routes/payments.js'
import watchlistRouter from './routes/watchlist.js'
import screenerRouter from './routes/screener.js'

export const app = express()

// Global Middlewares

// Establish security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: CONFIG.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}))

app.use(cors({
  origin: CONFIG.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}))

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(requestLogger)

// Establish rate limits to shield APIs from abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: CONFIG.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
})

app.use('/api', apiLimiter)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', environment: CONFIG.NODE_ENV })
})

// Wire Routes
app.use('/api/auth', authRouter)
app.use('/api/finedge', finedgeRouter)
app.use('/api/finscreen', finedgeRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/watchlists', watchlistRouter)
app.use('/api/screener', screenerRouter)

// Global Error Handler
app.use(errorHandler)

export default app
