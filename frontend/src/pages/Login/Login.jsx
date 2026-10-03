import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { NexaLogo } from '../../components/layout/NexaLogo';
import { HeroVaultGraphic } from '../../components/layout/HeroVaultGraphic';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Alert } from '../../components/ui/Alert';
import './Login.css';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email or username is required';
    } else if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setAlert(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate backend auth check
    setTimeout(() => {
      setIsLoading(false);
      if (email === 'demo@university.edu' || email === 'student@nexavault.edu' || email.length > 3) {
        setAlert({
          type: 'success',
          title: 'Authentication Successful',
          message: 'Redirecting to your NexaVault academic workspace...',
        });
      } else {
        setAlert({
          type: 'error',
          title: 'Invalid Credentials',
          message: 'The email or password you entered is incorrect. Please try again.',
        });
      }
    }, 1200);
  };

  const handleSocialLogin = (provider) => {
    setAlert(null);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setAlert({
        type: 'info',
        title: `${provider} SSO Initiated`,
        message: `Redirecting to ${provider} authentication gateway...`,
      });
    }, 800);
  };

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

        {/* Hero & Login Composition (Asymmetric Split) */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-12 lg:py-16 my-auto">
          
          {/* Left Column: Brand Hero & Statement */}
          <div className="lg:col-span-6 space-y-8 pr-0 lg:pr-8">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-500/20 text-[11px] font-display tracking-widest text-teal-400 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              ACADEMIC WORKSPACE
            </div>

            {/* Main Statement */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white font-display">
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

          {/* Right Column: Login Card Component */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-vault-surface/85 login-card-blur border border-teal-500/20 rounded-2xl p-7 sm:p-9 shadow-card-subtle relative group transition-all duration-300 hover:border-teal-500/30">
              
              {/* Card Subtle Top-Left Accent Highlight */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

              {/* Form Title & Welcome Message */}
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Welcome back
                </h2>
                <p className="text-xs text-slate-400 mt-1.5">
                  Sign in to continue to NexaVault
                </p>
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

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Email Field */}
                <Input
                  id="email"
                  type="email"
                  label="Email"
                  placeholder="you@university.edu"
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                  }}
                  icon={Lock}
                  error={fieldErrors.password}
                  required
                  autoComplete="current-password"
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

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between pt-1">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    label="Remember me"
                    disabled={isLoading}
                  />

                  <a
                    href="#forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      setAlert({
                        type: 'info',
                        title: 'Password Reset',
                        message: 'Contact your NexaVault system administrator or check your university portal.',
                      });
                    }}
                    className="text-xs text-teal-400 hover:text-teal-300 hover:underline transition-colors font-medium"
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                  endIcon={ArrowRight}
                  className="w-full mt-2 py-3 text-sm font-semibold tracking-wide"
                >
                  Sign in
                </Button>
              </form>

              {/* Social / SSO Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-vault-border/60" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-vault-surface px-3 text-slate-500 font-mono uppercase tracking-wider">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Google')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-teal-400/40"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C1.2 8.7.8 10.3.8 12s.4 3.3 1.1 4.7l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
                  </svg>
                  <span>Google</span>
                </button>

                {/* Microsoft Button */}
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Microsoft')}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-teal-400/40"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Microsoft</span>
                </button>
              </div>

              {/* Registration Link */}
              <div className="mt-6 text-center text-xs text-slate-400">
                <span>New to NexaVault? </span>
                <a
                  href="#create-account"
                  onClick={(e) => {
                    e.preventDefault();
                    setAlert({
                      type: 'info',
                      title: 'Registration',
                      message: 'Account creation is managed through university enrollment services.',
                    });
                  }}
                  className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Create an account
                </a>
              </div>

            </div>
          </div>

        </main>

        {/* Footer info line */}
        <footer className="py-4 text-center md:text-left text-[11px] font-mono text-slate-600 flex flex-col sm:flex-row justify-between items-center border-t border-vault-border/20 gap-2">
          <p>© 2026 NexaVault Platform. Engineering Academic Workspace.</p>
          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy</a>
            <span>•</span>
            <a href="#terms" className="hover:text-slate-400 transition-colors">Terms</a>
            <span>•</span>
            <a href="#security" className="hover:text-slate-400 transition-colors">Security</a>
          </div>
        </footer>

      </div>
    </div>
  );
};
