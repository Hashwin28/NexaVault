import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login/Login';
import { StudentDashboard } from './pages/Student/StudentDashboard';
import { StaffDashboard } from './pages/Staff/StaffDashboard';

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C0E] flex items-center justify-center text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Authenticating NexaVault Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (user?.role === 'staff') {
    return <StaffDashboard />;
  }

  return <StudentDashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
