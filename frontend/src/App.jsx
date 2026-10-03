import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login/Login';
import { StudentDashboard } from './pages/Student/StudentDashboard';
import { LayoutDashboard, LogIn } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'login' | 'dashboard'

  // Determine active screen based on viewMode or Auth state
  const isDashboardActive = 
    viewMode === 'dashboard' || 
    (viewMode === 'auto' && isAuthenticated);

  return (
    <div className="relative">
      {/* Top Demo View Switcher Bar for Seamless Navigation */}
      <div className="fixed bottom-4 right-4 z-50 bg-vault-surface/90 backdrop-blur-md border border-teal-500/30 rounded-full p-1.5 shadow-2xl flex items-center gap-1 text-xs select-none">
        <button
          onClick={() => setViewMode('login')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            !isDashboardActive 
              ? 'bg-teal-500 text-slate-950 font-bold' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LogIn size={14} />
          <span>Login UI</span>
        </button>

        <button
          onClick={() => setViewMode('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            isDashboardActive 
              ? 'bg-teal-500 text-slate-950 font-bold' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard size={14} />
          <span>Student UI</span>
        </button>
      </div>

      {/* Render Active Page Component */}
      {isDashboardActive ? <StudentDashboard /> : <Login />}
    </div>
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
