import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, LogOut, User, UserPlus } from 'lucide-react';
import { NexaLogo } from '../../components/layout/NexaLogo';
import { HeroVaultGraphic } from '../../components/layout/HeroVaultGraphic';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
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
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

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
          message: `Welcome back, ${activeUser.full_name}! Active session verified as ${activeUser.role.toUpperCase()}.`,
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
    <div className="min-h-screen w-full bg-vault-bg text-vault-heading flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Graphic Layer */}
      <HeroVaultGraphic />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 flex-1 flex flex-col justify-between">
        
        {/* Top Header Row */}
        <header className="flex items-center justify-between w-full pb-6 border-b border-vault-border/40">
          <NexaLogo size="md" />

          {/* Header motto line */}
          <div className="hidden md:flex items-center gap-3 text-xs tracking-widest font-display text-vault-muted uppercase">
            <span>PEOPLE</span>
            <span className="text-teal-500/50">•</span>
            <span>PROJECTS</span>
            <span className="text-teal-500/50">•</span>
            <span>PROGRESS</span>
            <span className="text-teal-500/50">•</span>
            <span>TOGETHER</span>
            <div className="w-8 h-[2px] bg-teal-500/60 ml-1 rounded-full" />
          </div>
        </header>

        {/* Hero & Form Split */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-10 lg:py-16 my-auto">
          
          {/* Left Column: Brand Hero & Statement */}
          <div className="lg:col-span-6 space-y-8 pr-0 lg:pr-8">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-500/20 text-[11px] font-display italic tracking-widest text-teal-400 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              ACADEMIC WORKSPACE
            </div>

            {/* Main Statement */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white font-display italic">
                Build <br />
                <span className="text-teal-400 underline decoration-teal-500/30 underline-offset-8">Collaborate</span> <br />
                Achieve
              </h1>
              
              <div className="w-12 h-1 bg-teal-500 rounded-full" />

              <p className="font-serif italic text-slate-200 text-xl sm:text-2xl tracking-normal leading-relaxed max-w-lg pt-3">
                Plan better. Work together. Deliver on time.
              </p>
            </div>

            {/* Bottom Stacked Motto */}
            <div className="pt-8 border-t border-vault-border/30 max-w-xs">
              <div className="font-display text-[11px] tracking-widest text-slate-500 uppercase leading-snug space-y-0.5">
                <p>KNOWLEDGE</p>
                <p className="text-slate-400">BUILDS</p>
                <p className="text-slate-300">BRIGHTER</p>
                <p className="text-teal-400 font-semibold">TOMORROWS</p>
              </div>
            </div>
          </div>

          {/* Right Column: Auth Card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-vault-surface/85 login-card-blur border border-teal-500/20 rounded-2xl p-7 sm:p-9 shadow-card-subtle relative group transition-all duration-300 hover:border-teal-500/30">
              
              {/* Card Subtle Accent Highlight */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

              {/* Title & Mode Switcher */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {isAuthenticated ? 'Authenticated Session' : mode === 'register' ? 'Student Registration' : 'Welcome back'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAuthenticated 
                      ? 'Connected to NexaVault API Security Core' 
                      : mode === 'register'
                      ? 'Create your Student account to access academic workspaces'
                      : 'Sign in to access your groups, projects, and deliverables'}
                  </p>
                </div>
              </div>

              {/* Alert Feedback Banner */}
              {alert && (
                <Alert
                  type={alert.type}
                  title={alert.title}
                  message={alert.message}
                  className="mb-6"
                />
              )}

              {/* If Authenticated: Active Profile */}
              {isAuthenticated && user ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-teal-950/40 border border-teal-500/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold">
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{user.full_name}</h3>
                        <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-teal-500/20 flex items-center justify-between text-xs font-mono text-slate-300">
                      <span>Role: <strong className="text-teal-400 uppercase">{user.role}</strong></span>
                      <span className="flex items-center gap-1 text-teal-400">
                        <ShieldCheck size={14} /> Active
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={logout}
                    endIcon={LogOut}
                    className="w-full py-2.5 text-xs text-rose-300 hover:text-rose-200 border-rose-500/30 hover:border-rose-500/50"
                  >
                    Sign Out Session
                  </Button>
                </div>
              ) : (
                /* Authentication Form */
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {mode === 'register' && (
                    <Input
                      id="fullName"
                      type="text"
                      label="Full Name"
                      placeholder="e.g. Alex Chen"
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

                  {/* Email Field */}
                  <Input
                    id="email"
                    type="email"
                    label="Email"
                    placeholder="student@nexavault.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                    }}
                    icon={Mail}
                    error={fieldErrors.email}
                    required
                    autoComplete="email"
                    disabled={isLoading}
                  />

                  {/* Password Field */}
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    placeholder="Enter password (min 6 characters)"
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
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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

                  {/* Submit Action */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    endIcon={mode === 'register' ? UserPlus : ArrowRight}
                    className="w-full mt-4 py-3 text-sm font-semibold tracking-wide"
                  >
                    {mode === 'register' ? 'Create Student Account' : 'Sign In'}
                  </Button>

                  {/* Mode Toggle */}
                  <div className="pt-4 border-t border-vault-border/40 text-center text-xs text-slate-400">
                    {mode === 'login' ? (
                      <>
                        <span>New to NexaVault? </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('register');
                            setAlert(null);
                            setFieldErrors({});
                          }}
                          className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2 transition-colors ml-1"
                        >
                          Create a student account
                        </button>
                      </>
                    ) : (
                      <>
                        <span>Already have an account? </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login');
                            setAlert(null);
                            setFieldErrors({});
                          }}
                          className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2 transition-colors ml-1"
                        >
                          Sign in instead
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}

            </div>
          </div>

        </main>

        {/* Footer info line */}
        <footer className="py-4 text-center md:text-left text-[11px] font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center border-t border-vault-border/20 gap-2">
          <p>© 2026 NexaVault Platform. Academic Workspace & Deliverable Lifecycle Core.</p>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">PostgreSQL Secured</span>
            <span>•</span>
            <span className="text-slate-500">Student Domain</span>
          </div>
        </footer>

      </div>
    </div>
  );
};
