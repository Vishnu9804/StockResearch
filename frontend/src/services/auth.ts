import axios from 'axios'

const BASE_API = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api')
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
