// src/pages/patient/AppointmentDetail.jsx – Patient view of appointment + summaries
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Button, Chip, Grid,
  CircularProgress, Alert, Divider, Stack, Accordion,
  AccordionSummary, AccordionDetails, List, ListItem, ListItemText
} from '@mui/material'
import {
  ArrowBack, ExpandMore, Warning, CheckCircle,
  Cancel, MedicationLiquid, Assignment
} from '@mui/icons-material'
import { format } from 'date-fns'
import api from '../../api/client'
import toast from 'react-hot-toast'

export default function PatientAppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [appt, setAppt] = useState(null)
  const [summaries, setSummaries] = useState({ preVisit: null, postVisit: null })
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`/appointments/${id}`),
      api.get(`/summaries/appointment/${id}`),
    ])
      .then(([{ data: apptData }, { data: summaryData }]) => {
        setAppt(apptData)
        setSummaries(summaryData)
      })
      .catch(() => setError('Failed to load appointment details'))
      .finally(() => setLoading(false))
  }, [id])

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return
    setCancelling(true)
    try {
      await api.patch(`/appointments/${id}/cancel`)
      toast.success('Appointment cancelled')
      setAppt({ ...appt, status: 'CANCELLED' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>
  if (!appt) return null

  const preVisitContent = summaries.preVisit?.content
  const postVisitContent = summaries.postVisit?.content

  const urgencyColor = {
    HIGH: 'error', MEDIUM: 'warning', LOW: 'success', UNKNOWN: 'default'
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/patient/dashboard')} sx={{ mb: 2 }}>
        Back to Dashboard
      </Button>

      <Typography variant="h4" fontWeight={700} gutterBottom>Appointment Details</Typography>

      {/* Main Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={600}>Dr. {appt.doctor.user.name}</Typography>
              <Typography color="text.secondary">{appt.doctor.specialisation}</Typography>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2">
                  📅 {format(new Date(appt.startTime), 'EEEE, MMMM d, yyyy')}
                </Typography>
                <Typography variant="body2">
                  🕐 {format(new Date(appt.startTime), 'h:mm a')} – {format(new Date(appt.endTime), 'h:mm a')}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={appt.status}
              color={
                appt.status === 'CONFIRMED' ? 'success' :
                appt.status === 'COMPLETED' ? 'info' :
                appt.status === 'CANCELLED' ? 'error' : 'warning'
              }
              size="medium"
            />
          </Box>

          {['CONFIRMED', 'PENDING'].includes(appt.status) && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined" color="error" size="small"
                startIcon={<Cancel />}
                onClick={handleCancel} disabled={cancelling}
              >
                Cancel Appointment
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Symptom Form */}
      {appt.symptomForm && (
        <Accordion defaultExpanded sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight={600}>Your Symptom Report</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" gutterBottom><strong>Symptoms:</strong> {appt.symptomForm.symptoms}</Typography>
            {appt.symptomForm.duration && (
              <Typography variant="body2" gutterBottom><strong>Duration:</strong> {appt.symptomForm.duration}</Typography>
            )}
            {appt.symptomForm.severity && (
              <Typography variant="body2" gutterBottom><strong>Severity:</strong> {appt.symptomForm.severity}/10</Typography>
            )}
            {appt.symptomForm.additionalNotes && (
              <Typography variant="body2"><strong>Notes:</strong> {appt.symptomForm.additionalNotes}</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Pre-Visit AI Summary */}
      {summaries.preVisit && (
        <Card sx={{ mb: 3, borderLeft: '4px solid', borderColor: 'warning.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Warning color="warning" />
              <Typography fontWeight={700}>AI Pre-Visit Summary</Typography>
            </Box>

            {summaries.preVisit.status === 'unavailable' ? (
              <Alert severity="warning">Summary generation failed. Your doctor will review your symptoms manually.</Alert>
            ) : (
              <>
                <Chip
                  label={`Urgency: ${summaries.preVisit.urgencyLevel}`}
                  color={urgencyColor[summaries.preVisit.urgencyLevel]}
                  sx={{ mb: 2 }}
                />
                {preVisitContent?.chiefComplaint && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Chief Complaint:</strong> {preVisitContent.chiefComplaint}
                  </Typography>
                )}
                {preVisitContent?.summary && (
                  <Typography variant="body2" color="text.secondary">{preVisitContent.summary}</Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Visit Summary */}
      {summaries.postVisit && (
        <Card sx={{ mb: 3, borderLeft: '4px solid', borderColor: 'success.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircle color="success" />
              <Typography fontWeight={700}>Post-Visit Summary</Typography>
            </Box>

            {summaries.postVisit.status === 'unavailable' ? (
              <Alert severity="warning">Summary unavailable. Contact the clinic for details.</Alert>
            ) : (
              <>
                {postVisitContent?.summary && (
                  <Typography variant="body2" sx={{ mb: 2 }}>{postVisitContent.summary}</Typography>
                )}

                {postVisitContent?.medicationSchedule?.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography fontWeight={600} gutterBottom>
                      <MedicationLiquid sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      Medication Schedule
                    </Typography>
                    <List dense>
                      {postVisitContent.medicationSchedule.map((med, i) => (
                        <ListItem key={i} sx={{ pl: 0 }}>
                          <ListItemText
                            primary={med.name}
                            secondary={`${med.instructions} · ${med.duration}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}

                {postVisitContent?.followUpSteps?.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography fontWeight={600} gutterBottom>Follow-Up Steps</Typography>
                    <List dense>
                      {postVisitContent.followUpSteps.map((step, i) => (
                        <ListItem key={i} sx={{ pl: 0 }}>
                          <ListItemText primary={`${i + 1}. ${step}`} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}

                {postVisitContent?.warningSignsToWatch?.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Alert severity="warning" icon={<Warning />}>
                      <Typography fontWeight={600} gutterBottom>Warning Signs to Watch</Typography>
                      <List dense sx={{ p: 0 }}>
                        {postVisitContent.warningSignsToWatch.map((sign, i) => (
                          <ListItem key={i} sx={{ pl: 0, py: 0 }}>
                            <ListItemText primary={`• ${sign}`} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prescription */}
      {appt.prescription && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assignment />
              <Typography fontWeight={600}>Prescription Details</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" gutterBottom>
              <strong>Doctor's Notes:</strong> {appt.prescription.doctorNotes}
            </Typography>
            {Array.isArray(appt.prescription.medications) && appt.prescription.medications.map((med, i) => (
              <Box key={i} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 2, mb: 1 }}>
                <Typography fontWeight={600}>{med.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {med.dosage} · {med.frequency} · {med.duration}
                </Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}
