// src/pages/patient/BookAppointment.jsx – Multi-step booking flow
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Button, TextField,
  CircularProgress, Alert, Grid, Chip, Stepper, Step, StepLabel,
  Slider, Divider, Stack
} from '@mui/material'
import { format, parseISO } from 'date-fns'
import { AccessTime, CalendarMonth, Warning } from '@mui/icons-material'
import api from '../../api/client'
import toast from 'react-hot-toast'

const STEPS = ['Select Date & Slot', 'Describe Symptoms', 'Confirm Booking']

export default function BookAppointment() {
  const { doctorId } = useParams()
  const navigate = useNavigate()

  const [activeStep, setActiveStep] = useState(0)
  const [doctor, setDoctor] = useState(null)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [holdId, setHoldId] = useState(null)
  const [holdExpiry, setHoldExpiry] = useState(null)
  const [symptoms, setSymptoms] = useState({ text: '', duration: '', severity: 5, notes: '' })
  const [loading, setLoading] = useState(false)
  const [slotLoading, setSlotLoading] = useState(false)
  const [error, setError] = useState('')

  // Load doctor
  useEffect(() => {
    api.get(`/doctors/${doctorId}`)
      .then(({ data }) => setDoctor(data))
      .catch(() => setError('Failed to load doctor'))
  }, [doctorId])

  // Load slots when date changes
  useEffect(() => {
    if (!date) return
    setSlotLoading(true)
    setSlots([])
    setSelectedSlot(null)
    api.get(`/doctors/${doctorId}/slots`, { params: { date } })
      .then(({ data }) => {
        if (!data.available) {
          setError(data.reason || 'No slots available on this date')
        } else {
          setError('')
          setSlots(data.slots)
        }
      })
      .catch(() => setError('Failed to load slots'))
      .finally(() => setSlotLoading(false))
  }, [date, doctorId])

  // Hold slot when selected
  const handleSlotSelect = async (slot) => {
    setSelectedSlot(slot)
    setError('')
    try {
      const { data } = await api.post('/appointments/hold', {
        doctorId,
        startTime: slot.startTime,
      })
      setHoldId(data.holdId)
      setHoldExpiry(data.expiresAt)
      setActiveStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to hold slot – it may have just been taken')
      setSelectedSlot(null)
    }
  }

  // Confirm booking
  const handleConfirm = async () => {
    if (!symptoms.text.trim()) {
      setError('Please describe your symptoms')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/appointments', {
        holdId,
        symptoms: symptoms.text,
        duration: symptoms.duration,
        severity: symptoms.severity,
        additionalNotes: symptoms.notes,
      })
      toast.success('Appointment booked! Confirmation email sent.')
      navigate('/patient/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  if (!doctor) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
      <CircularProgress />
    </Box>
  )

  // Today's date as min
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Book Appointment</Typography>
      <Typography color="text.secondary" mb={3}>
        with Dr. {doctor.user?.name} · {doctor.specialisation}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 1: Date & Slot */}
      {activeStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Choose a Date</Typography>
            <TextField
              type="date" label="Appointment Date"
              value={date} onChange={(e) => setDate(e.target.value)}
              inputProps={{ min: today }}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 3 }}
            />

            {slotLoading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto' }} />}

            {slots.length > 0 && (
              <>
                <Typography variant="subtitle1" fontWeight={500} gutterBottom>
                  Available Slots ({slots.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {slots.map((slot) => (
                    <Chip
                      key={slot.startTime}
                      label={slot.label}
                      onClick={() => handleSlotSelect(slot)}
                      color="primary"
                      variant="outlined"
                      icon={<AccessTime fontSize="small" />}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.light', color: 'white' } }}
                    />
                  ))}
                </Box>
              </>
            )}

            {date && !slotLoading && slots.length === 0 && !error && (
              <Alert severity="warning">No available slots on this date</Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Symptom Form */}
      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 2 }}>
              <Warning color="warning" />
              <Typography variant="body2">
                Slot held until {holdExpiry ? format(new Date(holdExpiry), 'h:mm a') : '...'}. Complete booking before it expires.
              </Typography>
            </Box>

            <Typography variant="h6" fontWeight={600} gutterBottom>Describe Your Symptoms</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This information will be used to generate an AI summary for your doctor before the visit.
            </Typography>

            <TextField
              fullWidth multiline rows={4} required
              label="Describe your symptoms *"
              placeholder="e.g., I have been experiencing chest pain on the left side for the past 3 days..."
              value={symptoms.text}
              onChange={(e) => setSymptoms({ ...symptoms, text: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="How long have you had these symptoms?"
              placeholder="e.g., 3 days, 2 weeks"
              value={symptoms.duration}
              onChange={(e) => setSymptoms({ ...symptoms, duration: e.target.value })}
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>
                Severity (self-rating): <strong>{symptoms.severity}/10</strong>
              </Typography>
              <Slider
                value={symptoms.severity}
                onChange={(_, v) => setSymptoms({ ...symptoms, severity: v })}
                min={1} max={10} step={1} marks
                valueLabelDisplay="auto"
                color={symptoms.severity >= 8 ? 'error' : symptoms.severity >= 5 ? 'warning' : 'success'}
              />
            </Box>

            <TextField
              fullWidth multiline rows={2}
              label="Any additional notes (allergies, current medications)"
              value={symptoms.notes}
              onChange={(e) => setSymptoms({ ...symptoms, notes: e.target.value })}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={() => setActiveStep(0)}>Back</Button>
              <Button variant="contained" onClick={() => setActiveStep(2)}>Continue</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {activeStep === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Confirm Your Booking</Typography>

            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Doctor</Typography>
                  <Typography fontWeight={600}>Dr. {doctor.user?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{doctor.specialisation}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                  <Typography fontWeight={600}>
                    {selectedSlot ? format(parseISO(selectedSlot.startTime), 'MMM d, yyyy') : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSlot?.label}
                  </Typography>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">Symptoms Summary</Typography>
              <Typography variant="body2" mt={0.5}>{symptoms.text}</Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              After booking, an AI summary will be generated for your doctor. You will receive a confirmation email.
            </Alert>

            <Stack direction="row" spacing={2}>
              <Button variant="outlined" onClick={() => setActiveStep(1)} disabled={loading}>Back</Button>
              <Button
                variant="contained" color="success" size="large"
                onClick={handleConfirm} disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Booking'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
