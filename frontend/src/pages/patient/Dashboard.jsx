// src/pages/patient/Dashboard.jsx – Patient appointments overview
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  CircularProgress, Alert, Divider, Stack, Avatar
} from '@mui/material'
import {
  CalendarMonth, Add, AccessTime, Person,
  CheckCircle, Cancel, Schedule, HourglassEmpty
} from '@mui/icons-material'
import { format } from 'date-fns'
import api from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const statusConfig = {
  CONFIRMED: { color: 'success', icon: <CheckCircle fontSize="small" />, label: 'Confirmed' },
  PENDING: { color: 'warning', icon: <HourglassEmpty fontSize="small" />, label: 'Pending' },
  COMPLETED: { color: 'info', icon: <CheckCircle fontSize="small" />, label: 'Completed' },
  CANCELLED: { color: 'error', icon: <Cancel fontSize="small" />, label: 'Cancelled' },
}

function AppointmentCard({ appt, onClick }) {
  const sc = statusConfig[appt.status] || { color: 'default', label: appt.status }
  return (
    <Card
      sx={{ cursor: 'pointer', transition: 'transform 0.15s', '&:hover': { transform: 'translateY(-2px)' } }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.light', width: 42, height: 42 }}>
              <Person />
            </Avatar>
            <Box>
              <Typography fontWeight={600}>Dr. {appt.doctor.user.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {appt.doctor.specialisation}
              </Typography>
            </Box>
          </Box>
          <Chip
            size="small"
            icon={sc.icon}
            label={sc.label}
            color={sc.color}
            variant="outlined"
          />
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarMonth fontSize="small" color="action" />
            <Typography variant="body2">{format(new Date(appt.startTime), 'MMM d, yyyy')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTime fontSize="small" color="action" />
            <Typography variant="body2">{format(new Date(appt.startTime), 'h:mm a')}</Typography>
          </Box>
        </Stack>
        {appt.preVisitSummary && (
          <Box sx={{ mt: 1.5, p: 1, bgcolor: 'warning.50', borderRadius: 1 }}>
            <Chip
              size="small"
              label={`Urgency: ${appt.preVisitSummary.urgencyLevel}`}
              color={
                appt.preVisitSummary.urgencyLevel === 'HIGH' ? 'error' :
                appt.preVisitSummary.urgencyLevel === 'MEDIUM' ? 'warning' : 'success'
              }
            />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/appointments')
      .then(({ data }) => setAppointments(data))
      .catch(() => setError('Failed to load appointments'))
      .finally(() => setLoading(false))
  }, [])

  const upcoming = appointments.filter((a) => ['CONFIRMED', 'PENDING'].includes(a.status))
  const past = appointments.filter((a) => ['COMPLETED', 'CANCELLED'].includes(a.status))

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>My Dashboard</Typography>
          <Typography color="text.secondary" mt={0.5}>Welcome back, {user?.name}</Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} size="large"
          onClick={() => navigate('/patient/search')}
        >
          Book Appointment
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Total Appointments', value: appointments.length, color: 'primary.main' },
          { label: 'Upcoming', value: upcoming.length, color: 'success.main' },
          { label: 'Completed', value: past.filter((a) => a.status === 'COMPLETED').length, color: 'info.main' },
        ].map((stat) => (
          <Grid item xs={12} sm={4} key={stat.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Typography variant="h3" fontWeight={700} color={stat.color}>{stat.value}</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && (
        <>
          {/* Upcoming */}
          <Typography variant="h5" fontWeight={600} gutterBottom>Upcoming Appointments</Typography>
          {upcoming.length === 0 ? (
            <Card sx={{ mb: 4 }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Schedule sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">No upcoming appointments</Typography>
                <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/patient/search')}>
                  Find a Doctor
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {upcoming.map((appt) => (
                <Grid item xs={12} md={6} key={appt.id}>
                  <AppointmentCard
                    appt={appt}
                    onClick={() => navigate(`/patient/appointments/${appt.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <Typography variant="h5" fontWeight={600} gutterBottom>Past Appointments</Typography>
              <Grid container spacing={2}>
                {past.map((appt) => (
                  <Grid item xs={12} md={6} key={appt.id}>
                    <AppointmentCard
                      appt={appt}
                      onClick={() => navigate(`/patient/appointments/${appt.id}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </>
      )}
    </Box>
  )
}
