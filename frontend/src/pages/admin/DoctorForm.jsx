// src/pages/admin/DoctorForm.jsx – Create or update a doctor profile
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Grid, CircularProgress, Alert, Divider, Stack
} from '@mui/material'
import { ArrowBack, Save } from '@mui/icons-material'
import api from '../../api/client'
import toast from 'react-hot-toast'

const defaultForm = {
  name: '', email: '', password: '',
  specialisation: '', workStartTime: '09:00',
  workEndTime: '17:00', slotDurationMins: 15, bio: '',
}

export default function AdminDoctorForm() {
  const { id } = useParams() // undefined = create, defined = edit
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api.get(`/admin/doctors`)
      .then(({ data }) => {
        const doc = data.find((d) => d.id === id)
        if (doc) {
          setForm({
            name: doc.user.name,
            email: doc.user.email,
            password: '',
            specialisation: doc.specialisation,
            workStartTime: doc.workStartTime,
            workEndTime: doc.workEndTime,
            slotDurationMins: doc.slotDurationMins,
            bio: doc.bio || '',
          })
        }
      })
      .catch(() => setError('Failed to load doctor'))
      .finally(() => setFetching(false))
  }, [id, isEdit])

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEdit) {
        await api.put(`/admin/doctors/${id}`, {
          specialisation: form.specialisation,
          workStartTime: form.workStartTime,
          workEndTime: form.workEndTime,
          slotDurationMins: parseInt(form.slotDurationMins, 10),
          bio: form.bio,
        })
        toast.success('Doctor profile updated!')
      } else {
        await api.post('/admin/doctors', {
          ...form,
          slotDurationMins: parseInt(form.slotDurationMins, 10),
        })
        toast.success(`Dr. ${form.name} profile created!`)
      }
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error ||
        err.response?.data?.details?.map((d) => d.message).join(', ') ||
        'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/dashboard')} sx={{ mb: 2 }}>
        Back to Dashboard
      </Button>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {isEdit ? 'Edit Doctor Profile' : 'Add New Doctor'}
      </Typography>

      <Card>
        <CardContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            {!isEdit && (
              <>
                <Typography variant="h6" fontWeight={600} gutterBottom>Account Details</Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth required label="Full Name" value={form.name} onChange={update('name')} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth required label="Email" type="email" value={form.email} onChange={update('email')} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth required label="Password" type="password"
                      value={form.password} onChange={update('password')}
                      helperText="Minimum 8 characters"
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 3 }} />
              </>
            )}

            <Typography variant="h6" fontWeight={600} gutterBottom>Professional Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth required label="Specialisation"
                  placeholder="e.g., Cardiology"
                  value={form.specialisation} onChange={update('specialisation')}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth required label="Work Start Time"
                  type="time" value={form.workStartTime}
                  onChange={update('workStartTime')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth required label="Work End Time"
                  type="time" value={form.workEndTime}
                  onChange={update('workEndTime')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth required label="Slot Duration (minutes)"
                  type="number" inputProps={{ min: 5, max: 120 }}
                  value={form.slotDurationMins} onChange={update('slotDurationMins')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={3}
                  label="Biography (optional)"
                  placeholder="Brief description of experience and expertise..."
                  value={form.bio} onChange={update('bio')}
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button variant="outlined" onClick={() => navigate('/admin/dashboard')} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit" variant="contained" startIcon={<Save />}
                disabled={loading}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : isEdit ? 'Save Changes' : 'Create Doctor'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
