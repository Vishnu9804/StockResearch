import axios from 'axios'

// We point to the local Express server in development, or relative paths in production
const BASE_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_URL = BASE_API.endsWith('/auth') ? BASE_API : `${BASE_API}/auth`

export const authClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for HTTP-only cookie handshakes
  headers: {
    'Content-Type': 'application/json'
  }
})



export const AuthService = {
  async signup(data: any) {
    const res = await authClient.post('/signup', data)
    return res.data
  },
  
  async login(data: any) {
    const res = await authClient.post('/login', data)
    return res.data
  },
  
  async logout() {
    const res = await authClient.post('/logout')
    return res.data
  },
  
  async getProfile() {
    const res = await authClient.get('/profile')
    return res.data
  }
}

export default AuthService
