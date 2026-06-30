// src/pages/RegisterPage.jsx – Patient registration
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, CircularProgress, Alert, Divider
} from '@mui/material'
import { Email, Lock, Person, Phone, LocalHospital } from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await register({ ...form, role: 'PATIENT' })
      toast.success('Account created! Welcome to ClinicCare.')
      navigate('/patient/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1565c0 0%, #00897b 100%)',
      p: 2,
    }}>
      <Card sx={{ maxWidth: 480, width: '100%', p: 2 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%',
              bgcolor: 'secondary.main', mb: 1.5,
            }}>
              <LocalHospital sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Create Account</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Register as a patient
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="Full Name" margin="normal"
              value={form.name} onChange={update('name')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Person color="action" /></InputAdornment> }}
              required autoFocus
            />
            <TextField
              fullWidth label="Email Address" type="email" margin="normal"
              value={form.email} onChange={update('email')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> }}
              required
            />
            <TextField
              fullWidth label="Phone (optional)" margin="normal"
              value={form.phone} onChange={update('phone')}
              InputProps={{ startAdornment: <InputAdornment position="start"><Phone color="action" /></InputAdornment> }}
            />
            <TextField
              fullWidth label="Password" type="password" margin="normal"
              value={form.password} onChange={update('password')}
              helperText="At least 8 characters"
              InputProps={{ startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment> }}
              required
            />
            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading} sx={{ mt: 2.5, py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </Box>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="body2" align="center" color="text.secondary">
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1565c0', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
