// src/pages/doctor/AppointmentDetail.jsx – Doctor view with pre-visit brief + post-visit form
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Button, TextField, Grid,
  CircularProgress, Alert, Divider, Chip, IconButton,
  List, ListItem, ListItemText, Accordion, AccordionSummary,
  AccordionDetails, Stack
} from '@mui/material'
import {
  ArrowBack, ExpandMore, Add, Delete, Warning, CheckCircle
} from '@mui/icons-material'
import { format } from 'date-fns'
import api from '../../api/client'
import toast from 'react-hot-toast'

const urgencyColor = { HIGH: 'error', MEDIUM: 'warning', LOW: 'success', UNKNOWN: 'default' }

const emptyMed = { name: '', dosage: '', frequency: '', duration: '' }

export default function DoctorAppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [appt, setAppt] = useState(null)
  const [summaries, setSummaries] = useState({ preVisit: null, postVisit: null })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPostVisitForm, setShowPostVisitForm] = useState(false)

  // Post-visit form state
  const [notes, setNotes] = useState('')
  const [medications, setMedications] = useState([{ ...emptyMed }])
  const [followUpSteps, setFollowUpSteps] = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`/appointments/${id}`),
      api.get(`/summaries/appointment/${id}`),
    ])
      .then(([{ data: a }, { data: s }]) => {
        setAppt(a)
        setSummaries(s)
        if (a.status === 'COMPLETED') {
          setShowPostVisitForm(false)
        }
      })
      .catch(() => setError('Failed to load appointment'))
      .finally(() => setLoading(false))
  }, [id])

  const addMedication = () => setMedications([...medications, { ...emptyMed }])
  const removeMedication = (i) => setMedications(medications.filter((_, idx) => idx !== i))
  const updateMedication = (i, field, value) => {
    const updated = [...medications]
    updated[i] = { ...updated[i], [field]: value }
    setMedications(updated)
  }

  const handleSubmitPostVisit = async () => {
    if (!notes.trim()) { setError('Doctor notes are required'); return }
    const invalidMed = medications.find((m) => !m.name || !m.dosage || !m.frequency || !m.duration)
    if (invalidMed) { setError('All medication fields are required'); return }

    setSubmitting(true)
    setError('')
    try {
      await api.post(`/appointments/${id}/post-visit`, {
        doctorNotes: notes,
        medications,
        followUpSteps,
      })
      toast.success('Post-visit notes submitted! Patient summary is being generated.')
      setAppt({ ...appt, status: 'COMPLETED' })
      setShowPostVisitForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>
  if (error && !appt) return <Alert severity="error">{error}</Alert>
  if (!appt) return null

  const preContent = summaries.preVisit?.content

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/doctor/dashboard')} sx={{ mb: 2 }}>
        Back
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Patient: {appt.patient.name}</Typography>
          <Typography color="text.secondary">{appt.patient.email}</Typography>
          <Typography variant="body2" mt={1}>
            📅 {format(new Date(appt.startTime), 'EEEE, MMMM d, yyyy')} ·{' '}
            {format(new Date(appt.startTime), 'h:mm a')} – {format(new Date(appt.endTime), 'h:mm a')}
          </Typography>
        </Box>
        <Chip
          label={appt.status}
          color={appt.status === 'COMPLETED' ? 'success' : appt.status === 'CONFIRMED' ? 'info' : 'default'}
          size="medium"
        />
      </Box>

      {/* AI Pre-Visit Brief */}
      {summaries.preVisit ? (
        <Card sx={{ mb: 3, borderLeft: '4px solid', borderColor: 'warning.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Warning color="warning" />
              <Typography variant="h6" fontWeight={700}>AI Pre-Visit Brief</Typography>
            </Box>

            {summaries.preVisit.status === 'unavailable' ? (
              <Alert severity="warning">AI summary unavailable. Review symptoms below manually.</Alert>
            ) : (
              <>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={`Urgency: ${summaries.preVisit.urgencyLevel}`}
                    color={urgencyColor[summaries.preVisit.urgencyLevel]}
                  />
                </Stack>

                {preContent?.chiefComplaint && (
                  <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={600} gutterBottom>Chief Complaint</Typography>
                    <Typography variant="body2" sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                      {preContent.chiefComplaint}
                    </Typography>
                  </Box>
                )}

                {preContent?.suggestedQuestions?.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={600} gutterBottom>Suggested Questions to Ask</Typography>
                    <List dense>
                      {preContent.suggestedQuestions.map((q, i) => (
                        <ListItem key={i} sx={{ pl: 0, py: 0.5 }}>
                          <ListItemText primary={`${i + 1}. ${q}`} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {preContent?.summary && (
                  <Box>
                    <Typography fontWeight={600} gutterBottom>Summary</Typography>
                    <Typography variant="body2" color="text.secondary">{preContent.summary}</Typography>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>AI summary is being generated...</Alert>
      )}

      {/* Patient Symptoms */}
      {appt.symptomForm && (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight={600}>Patient-Reported Symptoms</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2"><strong>Symptoms:</strong> {appt.symptomForm.symptoms}</Typography>
            {appt.symptomForm.duration && (
              <Typography variant="body2" mt={1}><strong>Duration:</strong> {appt.symptomForm.duration}</Typography>
            )}
            {appt.symptomForm.severity && (
              <Typography variant="body2" mt={1}><strong>Severity:</strong> {appt.symptomForm.severity}/10</Typography>
            )}
            {appt.symptomForm.additionalNotes && (
              <Typography variant="body2" mt={1}><strong>Notes:</strong> {appt.symptomForm.additionalNotes}</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Post-Visit Section */}
      {appt.status === 'COMPLETED' && !showPostVisitForm ? (
        <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircle color="success" />
              <Typography variant="h6" fontWeight={700}>Post-Visit Notes Submitted</Typography>
            </Box>
            {appt.prescription && (
              <>
                <Typography variant="body2" gutterBottom>
                  <strong>Notes:</strong> {appt.prescription.doctorNotes}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography fontWeight={600} gutterBottom>Medications Prescribed</Typography>
                {Array.isArray(appt.prescription.medications) && appt.prescription.medications.map((m, i) => (
                  <Box key={i} sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, mb: 1 }}>
                    <Typography variant="body2">
                      <strong>{m.name}</strong> · {m.dosage} · {m.frequency} · {m.duration}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      ) : appt.status === 'CONFIRMED' && (
        <>
          {!showPostVisitForm ? (
            <Button
              variant="contained" color="success" size="large"
              onClick={() => setShowPostVisitForm(true)}
            >
              Submit Post-Visit Notes
            </Button>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Post-Visit Notes</Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <TextField
                  fullWidth multiline rows={4} required
                  label="Clinical Notes *"
                  placeholder="Describe examination findings, diagnosis, treatment plan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{ mb: 3 }}
                />

                <Typography fontWeight={600} gutterBottom>Medications</Typography>
                {medications.map((med, i) => (
                  <Box key={i} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth size="small" label="Medication Name *"
                          value={med.name} onChange={(e) => updateMedication(i, 'name', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth size="small" label="Dosage *"
                          placeholder="e.g., 10mg"
                          value={med.dosage} onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth size="small" label="Frequency *"
                          placeholder="e.g., Twice daily"
                          value={med.frequency} onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth size="small" label="Duration *"
                          placeholder="e.g., 7 days"
                          value={med.duration} onChange={(e) => updateMedication(i, 'duration', e.target.value)}
                        />
                      </Grid>
                      {medications.length > 1 && (
                        <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton size="small" color="error" onClick={() => removeMedication(i)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}

                <Button startIcon={<Add />} onClick={addMedication} sx={{ mb: 3 }}>
                  Add Medication
                </Button>

                <TextField
                  fullWidth multiline rows={2}
                  label="Follow-Up Steps (optional)"
                  placeholder="e.g., Return in 2 weeks, blood test required..."
                  value={followUpSteps}
                  onChange={(e) => setFollowUpSteps(e.target.value)}
                  sx={{ mb: 3 }}
                />

                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" onClick={() => setShowPostVisitForm(false)}>Cancel</Button>
                  <Button
                    variant="contained" color="success"
                    onClick={handleSubmitPostVisit} disabled={submitting}
                  >
                    {submitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Notes'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}
