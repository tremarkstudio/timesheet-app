// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import LeaveApplication from './pages/LeaveApplication';
import Settings from './pages/Settings';
import TimesheetsPage from './pages/TimesheetsPage';
import CalendarPage from './pages/CalendarPage';
import UserManagement from './pages/UserManagement';
import ReportingPage from './pages/ReportingPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';  // ← ADD THIS IMPORT

// Protected route wrappers
const ProtectedRoute = ({ children }) => {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const roleId = parseInt(localStorage.getItem('role_id')) || 0;
  return [1, 2].includes(roleId) ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />  {/* ← ADD THIS LINE */}

        <Route path="/" element={
          localStorage.getItem('token') 
            ? <Navigate to="/dashboard" replace /> 
            : <Navigate to="/login" replace />
        } />

        {/* Authenticated routes with Layout */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/leave" element={<LeaveApplication />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />

          {/* Admin-only */}
          <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route path="/reporting" element={<AdminRoute><ReportingPage /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;