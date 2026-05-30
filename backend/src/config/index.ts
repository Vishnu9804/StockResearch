import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export const CONFIG = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/finscreen?schema=public',
  
  // JWT secrets
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'finescreen-access-secret-key-12345!',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'finescreen-refresh-secret-key-67890!',
  ACCESS_TOKEN_EXPIRY: '15m', // 15 minutes
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  
  // FinEdge API Rotating keys
  FINEDGE_API_KEYS: [
    process.env.FINEDGE_API_KEY_1 || 'demo-key-1',
    process.env.FINEDGE_API_KEY_2 || 'demo-key-2',
    process.env.FINEDGE_API_KEY_3 || 'demo-key-3'
  ],
  FINEDGE_BASE_URL: 'https://data.finedgeapi.com',
  
  // PayU hosted checkouts credentials
  PAYU_MERCHANT_KEY: process.env.PAYU_MERCHANT_KEY || 'GTK42i', // Standard PayU test key
  PAYU_MERCHANT_SALT: process.env.PAYU_MERCHANT_SALT || 'eCwWELSp', // Standard PayU test salt
  PAYU_CHECKOUT_URL: process.env.NODE_ENV === 'production' 
    ? 'https://secure.payu.in/_payment' 
    : 'https://sandboxsecure.payu.in/_payment',
  PAYU_SUCCESS_URL: process.env.PAYU_SUCCESS_URL || 'http://localhost:5000/api/payments/payu/success',
  PAYU_FAILURE_URL: process.env.PAYU_FAILURE_URL || 'http://localhost:5000/api/payments/payu/failure',
  
  // Frontend URLs for redirections
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
}

export default CONFIG
