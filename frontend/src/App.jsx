import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

const Login = lazy(() => import('./pages/Login/Login').then(m => ({ default: m.Login })));
const StudentDashboard = lazy(() => import('./pages/Student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const StaffDashboard = lazy(() => import('./pages/Staff/StaffDashboard').then(m => ({ default: m.StaffDashboard })));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

function FullPageLoading({ text = 'Authenticating NexaVault Session...' }) {
  return (
    <div className="min-h-screen bg-[#080C0E] flex items-center justify-center text-slate-400 font-mono text-xs">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <span>{text}</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <FullPageLoading text="Authenticating NexaVault Session..." />;
  }

  return (
    <Suspense fallback={<FullPageLoading text="Loading interface..." />}>
      {!isAuthenticated && <Login />}
      {isAuthenticated && user?.role === 'staff' && <StaffDashboard />}
      {isAuthenticated && user?.role === 'administrator' && <AdminDashboard />}
      {isAuthenticated && user?.role !== 'staff' && user?.role !== 'administrator' && <StudentDashboard />}
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
