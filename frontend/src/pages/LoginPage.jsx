// src/pages/LoginPage.jsx – Login with role-based redirect
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, CircularProgress, Alert
} from '@mui/material'
import { Email, Lock, Visibility, VisibilityOff, LocalHospital } from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name}!`)
      if (user.role === 'PATIENT') navigate('/patient/dashboard')
      else if (user.role === 'DOCTOR') navigate('/doctor/dashboard')
      else navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1565c0 0%, #00897b 100%)',
      p: 2,
    }}>
      <Card sx={{ maxWidth: 440, width: '100%', p: 2 }}>
        <CardContent>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%',
              bgcolor: 'primary.main', mb: 1.5,
            }}>
              <LocalHospital sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>ClinicCare</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Sign in to your account
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="Email Address" type="email" margin="normal"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> }}
              required autoFocus
            />
            <TextField
              fullWidth label="Password" margin="normal"
              type={showPw ? 'text' : 'password'}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(!showPw)} edge="end">
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              required
            />
            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading} sx={{ mt: 2.5, py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Typography variant="body2" align="center" mt={2.5} color="text.secondary">
            Don&apos;t have an account?{' '}
            <Link to="/register" style={{ color: '#1565c0', fontWeight: 600, textDecoration: 'none' }}>
              Register
            </Link>
          </Typography>

          {/* Demo credentials */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
              Demo Credentials
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Patient: john.doe@example.com / Patient@12345
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Admin: admin@clinic.com / Admin@12345
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Doctor: sarah.mitchell@clinic.com / Doctor@12345
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
