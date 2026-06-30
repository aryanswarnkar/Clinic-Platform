// src/api/client.js – Axios instance with interceptors
import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clinic_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.error || error.message

    if (status === 401) {
      localStorage.removeItem('clinic_token')
      window.location.href = '/login'
    } else if (status === 403) {
      toast.error('You do not have permission to perform this action')
    } else if (status >= 500) {
      toast.error('Server error. Please try again later.')
    }

    return Promise.reject(error)
  }
)

export default api
