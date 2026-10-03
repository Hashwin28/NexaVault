import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login/Login';
import { StudentDashboard } from './pages/Student/StudentDashboard';

function AppContent() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <StudentDashboard /> : <Login />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
