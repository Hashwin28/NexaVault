import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, LogOut, User, UserPlus, Loader2 } from 'lucide-react';
import { NexaLogo } from '../../components/layout/NexaLogo';
import { HeroVaultGraphic } from '../../components/layout/HeroVaultGraphic';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import './Login.css';

export const Login = () => {
  const { user, login, register, logout, isAuthenticated, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    authApi.prewarm(true);

    const handleServerStatus = (e) => {
      if (e.detail && typeof e.detail.isWaking === 'boolean') {
        setIsWaking(e.detail.isWaking);
      }
    };

    window.addEventListener('nexavault:server-status', handleServerStatus);
    return () => window.removeEventListener('nexavault:server-status', handleServerStatus);
  }, []);

  const validateForm = () => {
    const errors = {};
    if (mode === 'register' && !fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'register' && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        const newUser = await register(email, password, fullName);
        setAlert({
          type: 'success',
          title: 'Account Created',
          message: `Welcome, ${newUser.full_name}! Your student account is active.`,
        });
      } else {
        const activeUser = await login(email, password);
        setAlert({
          type: 'success',
          title: 'Authentication Successful',
          message: `Welcome back, ${activeUser.full_name}! Session verified as ${activeUser.role.toUpperCase()}.`,
        });
      }
    } catch (err) {
      setAlert({
        type: 'error',
        title: mode === 'register' ? 'Registration Error' : 'Invalid Credentials',
        message: err.message || 'An error occurred during authentication. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <div className="min-h-screen w-full bg-[#080C0E] text-[#ECF1F4] flex flex-col justify-between relative overflow-hidden font-sans">
      <HeroVaultGraphic />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-8 py-8 flex-1 flex flex-col justify-between">
        
        {/* Top Header */}
        <header className="flex items-center justify-between w-full pb-5 border-b border-[#1B262E]">
          <NexaLogo size="md" />
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>SYSTEM OPERATIONAL</span>
          </div>
        </header>

        {/* Content Body */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center py-10 lg:py-16 my-auto">
          
          {/* Left Column: Institutional Info */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#11181C] border border-[#1B262E] text-xs font-mono text-teal-400 uppercase">
              Academic Platform
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Academic Project & Milestone Governance
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
                Structured workspace management, collaborative group tracking, and rigorous multi-round evaluation for university departments.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                <span>Role-Based Access: Student, Staff, and Administrator</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                <span>Immutable audit logs and continuous deliverable tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                <span>Departmental oversight and multi-workspace administration</span>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Form Card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-[#11181C] border border-[#1B262E] rounded-lg p-6 sm:p-8">
              
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  {isAuthenticated ? 'Active Session' : mode === 'register' ? 'Create Student Account' : 'Institutional Sign In'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isAuthenticated 
                    ? 'You are currently authenticated.'
                    : mode === 'register'
                    ? 'Register your academic student account'
                    : 'Enter your credentials to access your dashboard'}
                </p>
              </div>

              {isWaking && !alert && (
                <div className="mb-5 p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                  <Loader2 size={14} className="animate-spin shrink-0 text-amber-400" />
                  <div>
                    <span className="font-semibold">Backend Initializing: </span>
                    <span className="text-amber-200/90">Connecting to database. Please wait...</span>
                  </div>
                </div>
              )}

              {alert && (
                <div className="mb-5">
                  <Alert
                    type={alert.type}
                    title={alert.title}
                    message={alert.message}
                    onClose={() => setAlert(null)}
                  />
                </div>
              )}

              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="p-4 rounded bg-[#0B0F12] border border-[#1B262E] space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-semibold text-xs">
                        <User size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[#1B262E] flex justify-between items-center text-xs">
                      <span className="text-slate-500">Active Role:</span>
                      <span className="text-teal-400 font-semibold uppercase">{user?.role}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={logout}
                    startIcon={LogOut}
                    className="w-full text-xs text-rose-400 hover:text-rose-300 border-rose-900/30 hover:bg-rose-950/20"
                  >
                    Sign Out & Switch Account
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <Input
                      id="fullName"
                      type="text"
                      label="Full Name"
                      placeholder="e.g. Jane Doe"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: null }));
                      }}
                      icon={User}
                      error={fieldErrors.fullName}
                      required
                      autoComplete="name"
                      disabled={isLoading}
                    />
                  )}

                  <Input
                    id="email"
                    type="email"
                    label="University Email"
                    placeholder="student@university.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                    }}
                    icon={Mail}
                    error={fieldErrors.email}
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />

                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                    }}
                    icon={Lock}
                    error={fieldErrors.password}
                    required
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    disabled={isLoading}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />

                  {mode === 'register' && (
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      label="Confirm Password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: null }));
                      }}
                      icon={Lock}
                      error={fieldErrors.confirmPassword}
                      required
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    endIcon={mode === 'register' ? UserPlus : ArrowRight}
                    className="w-full mt-2 py-2.5 text-xs font-semibold"
                  >
                    {mode === 'register' ? 'Create Student Account' : 'Sign In'}
                  </Button>

                  <div className="pt-3 border-t border-[#1B262E] text-center text-xs text-slate-400">
                    {mode === 'login' ? (
                      <>
                        <span>New student? </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('register');
                            setAlert(null);
                            setFieldErrors({});
                          }}
                          className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2 ml-1"
                        >
                          Register an account
                        </button>
                      </>
                    ) : (
                      <>
                        <span>Already registered? </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login');
                            setAlert(null);
                            setFieldErrors({});
                          }}
                          className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2 ml-1"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}

            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="py-4 text-xs font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center border-t border-[#1B262E] gap-2">
          <p>© 2026 NexaVault Academic Platform.</p>
          <div className="flex items-center gap-4 text-slate-500">
            <span>PostgreSQL Secured</span>
            <span>•</span>
            <span>Institutional Access</span>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default Login;
