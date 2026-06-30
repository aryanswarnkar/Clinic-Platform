// src/pages/doctor/Dashboard.jsx – Doctor's appointment list
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  CircularProgress, Alert, Avatar, Divider, Stack
} from '@mui/material'
import { format } from 'date-fns'
import { AccessTime, Person, Warning } from '@mui/icons-material'
import api from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const urgencyColor = { HIGH: 'error', MEDIUM: 'warning', LOW: 'success', UNKNOWN: 'default' }

export default function DoctorDashboard() {
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

  const upcoming = appointments.filter((a) => a.status === 'CONFIRMED')
  const completed = appointments.filter((a) => a.status === 'COMPLETED')

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>My Appointments</Typography>
      <Typography color="text.secondary" mb={3}>Dr. {user?.name}</Typography>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Upcoming', value: upcoming.length, color: 'primary.main' },
          { label: 'Completed', value: completed.length, color: 'success.main' },
          { label: 'Total', value: appointments.length, color: 'secondary.main' },
        ].map((s) => (
          <Grid item xs={4} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Typography variant="h3" fontWeight={700} color={s.color}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && (
        <>
          <Typography variant="h5" fontWeight={600} gutterBottom>Today & Upcoming</Typography>
          {upcoming.length === 0 ? (
            <Alert severity="info">No upcoming appointments.</Alert>
          ) : (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {upcoming.map((appt) => (
                <Grid item xs={12} md={6} key={appt.id}>
                  <Card
                    sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }}
                    onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: 'secondary.light' }}>
                            <Person />
                          </Avatar>
                          <Box>
                            <Typography fontWeight={600}>{appt.patient.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{appt.patient.email}</Typography>
                          </Box>
                        </Box>
                        {appt.preVisitSummary && (
                          <Chip
                            size="small"
                            icon={<Warning fontSize="small" />}
                            label={`${appt.preVisitSummary.urgencyLevel} urgency`}
                            color={urgencyColor[appt.preVisitSummary.urgencyLevel]}
                          />
                        )}
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Stack direction="row" spacing={2}>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body2">
                            {format(new Date(appt.startTime), 'MMM d')} at {format(new Date(appt.startTime), 'h:mm a')}
                          </Typography>
                        </Box>
                      </Stack>
                      {appt.preVisitSummary?.chiefComplaint && (
                        <Typography variant="caption" color="text.secondary" mt={1} display="block">
                          Chief Complaint: {appt.preVisitSummary.chiefComplaint}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {completed.length > 0 && (
            <>
              <Typography variant="h5" fontWeight={600} gutterBottom>Completed</Typography>
              <Grid container spacing={2}>
                {completed.map((appt) => (
                  <Grid item xs={12} md={6} key={appt.id}>
                    <Card
                      sx={{ cursor: 'pointer', opacity: 0.85, '&:hover': { opacity: 1 } }}
                      onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                    >
                      <CardContent>
                        <Typography fontWeight={600}>{appt.patient.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(appt.startTime), 'MMM d, yyyy')} · Completed
                        </Typography>
                      </CardContent>
                    </Card>
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
