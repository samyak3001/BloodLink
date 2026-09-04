import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/shared/ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';

// Public Pages
import { LandingPage } from '../pages/public/LandingPage';
import { HowItWorksPage } from '../pages/public/HowItWorksPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { HospitalLoginPage } from '../pages/auth/HospitalLoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { DesignSystemPage } from '../pages/DesignSystemPage';
import { NotFoundPage } from '../pages/NotFoundPage';

// Donor Pages
import { DonorDashboardPage } from '../pages/donor/DonorDashboardPage';
import { DonorRequestsPage } from '../pages/donor/DonorRequestsPage';
import { DonorHistoryPage } from '../pages/donor/DonorHistoryPage';
import { DonorNotificationsPage } from '../pages/donor/DonorNotificationsPage';
import { DonorProfilePage } from '../pages/donor/DonorProfilePage';

// Hospital Pages
import { HospitalDashboardPage } from '../pages/hospital/HospitalDashboardPage';
import { CreateRequestPage } from '../pages/hospital/CreateRequestPage';
import { ActiveRequestsPage } from '../pages/hospital/ActiveRequestsPage';
import { RequestDetailsPage } from '../pages/hospital/RequestDetailsPage';
import { HospitalNotificationsPage } from '../pages/hospital/HospitalNotificationsPage';
import { HospitalProfilePage } from '../pages/hospital/HospitalProfilePage';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminRequestsPage } from '../pages/admin/AdminRequestsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminHospitalsPage } from '../pages/admin/AdminHospitalsPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';

// Shared Authenticated Pages
import { SettingsPage } from '../pages/shared/SettingsPage';

// Layout wrapper helper
const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppLayout showSidebar={false}>{children}</AppLayout>
);

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppLayout showSidebar={true}>{children}</AppLayout>
);

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ------------------------------------------------------------- */}
      {/* Public / Auth Routes */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'DONOR' ? (
              <Navigate to="/donor/dashboard" replace />
            ) : user.role === 'HOSPITAL' ? (
              <Navigate to="/hospital/dashboard" replace />
            ) : (
              <Navigate to="/admin/analytics" replace />
            )
          ) : (
            <PublicLayout>
              <LandingPage />
            </PublicLayout>
          )
        }
      />

      <Route
        path="/login"
        element={
          user ? (
            user.role === 'DONOR' ? (
              <Navigate to="/donor/dashboard" replace />
            ) : user.role === 'HOSPITAL' ? (
              <Navigate to="/hospital/dashboard" replace />
            ) : (
              <Navigate to="/admin/analytics" replace />
            )
          ) : (
            <PublicLayout>
              <LoginPage />
            </PublicLayout>
          )
        }
      />

      <Route
        path="/hospital/sign-in"
        element={
          user ? (
            user.role === 'HOSPITAL' ? (
              <Navigate to="/hospital/dashboard" replace />
            ) : user.role === 'DONOR' ? (
              <Navigate to="/donor/dashboard" replace />
            ) : (
              <Navigate to="/admin/analytics" replace />
            )
          ) : (
            <PublicLayout>
              <HospitalLoginPage />
            </PublicLayout>
          )
        }
      />

      <Route path="/hospital/login" element={<Navigate to="/hospital/sign-in" replace />} />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <PublicLayout>
              <RegisterPage />
            </PublicLayout>
          )
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicLayout>
            <ForgotPasswordPage />
          </PublicLayout>
        }
      />

      <Route
        path="/reset-password"
        element={
          <PublicLayout>
            <ResetPasswordPage />
          </PublicLayout>
        }
      />

      <Route
        path="/design-system"
        element={
          <PublicLayout>
            <DesignSystemPage />
          </PublicLayout>
        }
      />

      <Route
        path="/how-it-works"
        element={
          <PublicLayout>
            <HowItWorksPage />
          </PublicLayout>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Protected Donor Routes */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="/donor/dashboard"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout>
              <DonorDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/donor/requests"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout>
              <DonorRequestsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/donor/history"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout>
              <DonorHistoryPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/donor/notifications"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout>
              <DonorNotificationsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/donor/profile"
        element={
          <ProtectedRoute allowedRoles={['DONOR']}>
            <DashboardLayout>
              <DonorProfilePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Protected Hospital Routes */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="/hospital/dashboard"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <HospitalDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/requests/new"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <CreateRequestPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/requests"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <ActiveRequestsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/requests/:id"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <RequestDetailsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/profile"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <HospitalProfilePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hospital/notifications"
        element={
          <ProtectedRoute allowedRoles={['HOSPITAL']}>
            <DashboardLayout>
              <HospitalNotificationsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Protected Admin Routes */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>
              <AdminDashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/requests"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>
              <AdminRequestsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>
              <AdminUsersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/hospitals"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>
              <AdminHospitalsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout>
              <AdminAuditLogsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Shared Settings & Privacy Route */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['DONOR', 'HOSPITAL', 'ADMIN']}>
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Catch-all 404 Route */}
      {/* ------------------------------------------------------------- */}
      <Route
        path="*"
        element={
          <PublicLayout>
            <NotFoundPage />
          </PublicLayout>
        }
      />
    </Routes>
  );
};
