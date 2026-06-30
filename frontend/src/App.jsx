// src/App.jsx – Root routing with role-based redirects
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import { useAuth } from './contexts/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PatientDashboard from './pages/patient/Dashboard'
import SearchDoctors from './pages/patient/SearchDoctors'
import BookAppointment from './pages/patient/BookAppointment'
import PatientAppointmentDetail from './pages/patient/AppointmentDetail'
import DoctorDashboard from './pages/doctor/Dashboard'
import DoctorAppointmentDetail from './pages/doctor/AppointmentDetail'
import AdminDashboard from './pages/admin/Dashboard'
import AdminDoctorForm from './pages/admin/DoctorForm'
import Layout from './components/Layout'

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress size={48} />
    </Box>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'PATIENT') return <Navigate to="/patient/dashboard" replace />
  if (user.role === 'DOCTOR') return <Navigate to="/doctor/dashboard" replace />
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RoleHome />} />

      {/* Patient */}
      <Route path="/patient" element={
        <RequireAuth roles={['PATIENT']}>
          <Layout role="PATIENT" />
        </RequireAuth>
      }>
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="search" element={<SearchDoctors />} />
        <Route path="book/:doctorId" element={<BookAppointment />} />
        <Route path="appointments/:id" element={<PatientAppointmentDetail />} />
      </Route>

      {/* Doctor */}
      <Route path="/doctor" element={
        <RequireAuth roles={['DOCTOR']}>
          <Layout role="DOCTOR" />
        </RequireAuth>
      }>
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="appointments/:id" element={<DoctorAppointmentDetail />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={
        <RequireAuth roles={['ADMIN']}>
          <Layout role="ADMIN" />
        </RequireAuth>
      }>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="doctors/new" element={<AdminDoctorForm />} />
        <Route path="doctors/:id/edit" element={<AdminDoctorForm />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
