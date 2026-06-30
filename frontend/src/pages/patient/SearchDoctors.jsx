// src/pages/patient/SearchDoctors.jsx – Doctor search by specialisation
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Grid, Card, CardContent, CardActions,
  TextField, Button, Chip, InputAdornment, CircularProgress,
  Avatar, Select, MenuItem, FormControl, InputLabel, Alert
} from '@mui/material'
import { Search, AccessTime, MedicalServices } from '@mui/icons-material'
import api from '../../api/client'

const SPECIALISATIONS = [
  'All', 'Cardiology', 'Dermatology', 'General Practice',
  'Orthopedics', 'Neurology', 'Pediatrics', 'Oncology', 'Psychiatry',
]

function DoctorCard({ doctor, onBook }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar
            sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 22, fontWeight: 700 }}
          >
            {doctor.user.name[0]}
          </Avatar>
          <Box>
            <Typography fontWeight={700}>{doctor.user.name}</Typography>
            <Chip
              label={doctor.specialisation}
              size="small"
              color="primary"
              variant="outlined"
              icon={<MedicalServices fontSize="small" />}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>

        {doctor.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
            {doctor.bio}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {doctor.workStartTime} – {doctor.workEndTime}
            {' '}({doctor.slotDurationMins} min slots)
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained" fullWidth
          onClick={() => onBook(doctor.id)}
        >
          Book Appointment
        </Button>
      </CardActions>
    </Card>
  )
}

export default function SearchDoctors() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [spec, setSpec] = useState('All')

  useEffect(() => {
    api.get('/doctors')
      .then(({ data }) => { setDoctors(data); setFiltered(data) })
      .catch(() => setError('Failed to load doctors'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = doctors
    if (spec !== 'All') {
      result = result.filter((d) => d.specialisation.toLowerCase().includes(spec.toLowerCase()))
    }
    if (search.trim()) {
      result = result.filter((d) =>
        d.user.name.toLowerCase().includes(search.toLowerCase()) ||
        d.specialisation.toLowerCase().includes(search.toLowerCase())
      )
    }
    setFiltered(result)
  }, [search, spec, doctors])

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Find a Doctor</Typography>
      <Typography color="text.secondary" mb={3}>
        Search by name or specialisation to find available doctors
      </Typography>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={7}>
          <TextField
            fullWidth
            placeholder="Search by name or specialisation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search color="action" /></InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={5}>
          <FormControl fullWidth>
            <InputLabel>Specialisation</InputLabel>
            <Select value={spec} label="Specialisation" onChange={(e) => setSpec(e.target.value)}>
              {SPECIALISATIONS.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && filtered.length === 0 && (
        <Alert severity="info">No doctors found matching your criteria.</Alert>
      )}

      <Grid container spacing={3}>
        {filtered.map((doctor) => (
          <Grid item xs={12} sm={6} md={4} key={doctor.id}>
            <DoctorCard doctor={doctor} onBook={(id) => navigate(`/patient/book/${id}`)} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
