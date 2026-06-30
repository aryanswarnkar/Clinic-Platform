// src/pages/admin/Dashboard.jsx – Admin panel: doctor management + leave
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Card, CardContent, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Tooltip
} from '@mui/material'
import {
  Add, Edit, Delete, BeachAccess, PersonOff
} from '@mui/icons-material'
import { format } from 'date-fns'
import api from '../../api/client'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Leave dialog
  const [leaveDialog, setLeaveDialog] = useState({ open: false, doctorId: null, doctorName: '' })
  const [leaveDates, setLeaveDates] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      api.get('/admin/doctors'),
      api.get('/admin/users'),
    ])
      .then(([{ data: d }, { data: u }]) => {
        setDoctors(d)
        setUsers(u)
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete doctor profile for ${name}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/${id}`)
      toast.success(`${name} profile deleted`)
      setDoctors(doctors.filter((d) => d.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const handleAddLeave = async () => {
    const dates = leaveDates.split(',').map((d) => d.trim()).filter(Boolean)
    if (dates.length === 0) { toast.error('Enter at least one date'); return }
    setLeaveSubmitting(true)
    try {
      const { data } = await api.post(`/admin/doctors/${leaveDialog.doctorId}/leave`, {
        dates,
        reason: leaveReason,
      })
      toast.success(`${data.created.length} leave day(s) added. Affected patients notified.`)
      setLeaveDialog({ open: false, doctorId: null, doctorName: '' })
      setLeaveDates('')
      setLeaveReason('')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add leave')
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const stats = [
    { label: 'Total Doctors', value: doctors.length, color: 'primary.main' },
    { label: 'Total Patients', value: users.filter((u) => u.role === 'PATIENT').length, color: 'secondary.main' },
    { label: 'Total Users', value: users.length, color: 'success.main' },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Admin Dashboard</Typography>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => navigate('/admin/doctors/new')}
        >
          Add Doctor
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {stats.map((s) => (
          <Grid item xs={12} sm={4} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={700} color={s.color}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Doctors Table */}
      <Typography variant="h5" fontWeight={600} gutterBottom>Doctor Profiles</Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Specialisation</strong></TableCell>
                <TableCell><strong>Hours</strong></TableCell>
                <TableCell><strong>Slot (min)</strong></TableCell>
                <TableCell><strong>Leave Days</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {doctors.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Typography fontWeight={500}>{doc.user.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{doc.user.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.specialisation} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{doc.workStartTime} – {doc.workEndTime}</TableCell>
                  <TableCell>{doc.slotDurationMins}</TableCell>
                  <TableCell>
                    {doc.leaveDays?.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {doc.leaveDays.slice(0, 3).map((l) => (
                          <Chip
                            key={l.id}
                            label={format(new Date(l.date), 'MMM d')}
                            size="small" color="warning" variant="outlined"
                          />
                        ))}
                        {doc.leaveDays.length > 3 && (
                          <Chip label={`+${doc.leaveDays.length - 3} more`} size="small" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">None</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit profile">
                      <IconButton size="small" onClick={() => navigate(`/admin/doctors/${doc.id}/edit`)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add leave day">
                      <IconButton
                        size="small" color="warning"
                        onClick={() => setLeaveDialog({ open: true, doctorId: doc.id, doctorName: doc.user.name })}
                      >
                        <BeachAccess fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete doctor">
                      <IconButton size="small" color="error" onClick={() => handleDelete(doc.id, doc.user.name)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Leave Dialog */}
      <Dialog open={leaveDialog.open} onClose={() => setLeaveDialog({ open: false, doctorId: null, doctorName: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonOff color="warning" />
            Add Leave Days – Dr. {leaveDialog.doctorName}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Patients with existing bookings on these dates will be automatically notified via email.
          </Alert>
          <TextField
            fullWidth label="Dates (comma-separated YYYY-MM-DD)"
            placeholder="2025-08-01, 2025-08-02"
            value={leaveDates}
            onChange={(e) => setLeaveDates(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth label="Reason (optional)"
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLeaveDialog({ open: false })} disabled={leaveSubmitting}>Cancel</Button>
          <Button
            variant="contained" color="warning"
            onClick={handleAddLeave} disabled={leaveSubmitting}
          >
            {leaveSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Add Leave & Notify Patients'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
