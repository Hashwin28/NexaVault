import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login/Login';
import { StudentDashboard } from './pages/Student/StudentDashboard';
import { StaffDashboard } from './pages/Staff/StaffDashboard';

/**
 * AppContent Component
 * 
 * Handles client-side view routing based on authentication and authorization state:
 * - Displays a loading spinner while session verification is in progress.
 * - Redirects unauthenticated users to the Login page.
 * - Routes authenticated users to role-specific views (StaffDashboard or StudentDashboard).
 */
function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading indicator while session/token verification is taking place
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

  // Redirect to login if user is not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Route based on role: staff members receive administrative dashboard, otherwise student dashboard
  if (user?.role === 'staff') {
    return <StaffDashboard />;
  }

  return <StudentDashboard />;
}

/**
 * Root Application Component
 * Wraps the app in the AuthProvider context for global authentication state management.
 */
export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
