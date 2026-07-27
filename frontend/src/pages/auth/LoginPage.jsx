import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import { Leaf, Mail, Lock, Eye, EyeOff, Activity, Map, BarChart3 } from 'lucide-react';

const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-focus email field on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const clearError = () => { if (error) setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already logged in, redirect
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 font-sans">

      {/* =========================================================
          LEFT PANEL (40%) — Branding & Marketing 
          ========================================================= */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12 xl:p-16 bg-white dark:bg-slate-950 border-r border-gray-100 dark:border-slate-800 z-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16 animate-fade-in hover:animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-400 flex items-center justify-center shadow-md shadow-brand-500/30">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              SWCMAS
            </span>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              Smart Waste<br />Collection<br />Management and Assessment System
            </h1>
            <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
              Making waste collection smarter, cleaner and more efficient using real-time IoT monitoring and AI-powered analytics.
            </p>
          </div>

          {/* Feature List */}
          <div className="mt-12 space-y-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 shrink-0 border border-emerald-100 dark:border-emerald-500/20">
                <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Live Bin Monitoring</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor smart bins in real time.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 shrink-0 border border-emerald-100 dark:border-emerald-500/20">
                <Map className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Route Optimization</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI-powered waste collection routes.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 shrink-0 border border-emerald-100 dark:border-emerald-500/20">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">County Analytics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Powerful dashboards for decision making.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-sm text-gray-400 dark:text-gray-500 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <p>© {new Date().getFullYear()} County Government.</p>
          <p>Version 2.4.0</p>
        </div>
      </div>

      {/* =========================================================
          RIGHT PANEL (60%) — Login Form 
          ========================================================= */}
      <div
        className="w-full lg:w-3/5 min-h-screen relative flex items-center justify-center p-6 sm:p-12 lg:p-24 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at bottom left, #34D399 0%, #10B981 25%, #059669 50%, #065F46 80%, #022C22 100%)'
        }}
        aria-label="Login Section"
      >
        {/* Background Decorations (Blobs & Particles) */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-[100px] animate-blob pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-black/20 rounded-full mix-blend-overlay filter blur-[80px] animate-blob pointer-events-none" style={{ animationDelay: '2000ms' }} aria-hidden="true" />
        <div className="absolute top-1/3 left-1/3 w-2 h-2 bg-white rounded-full blur-[1px] animate-pulse pointer-events-none" aria-hidden="true" />
        <div className="absolute top-2/3 right-1/3 w-3 h-3 bg-emerald-200 rounded-full blur-[2px] animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} aria-hidden="true" />

        {/* Mobile Header (Hidden on Desktop split view) */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">
            SWCMAS
          </span>
        </div>

        {/* Glassmorphism Logic Card */}
        <div
          className="w-full max-w-md relative z-10 p-8 sm:p-10 rounded-[24px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-slide-up bg-white/10 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
              Welcome Back
            </h2>
            <p className="mt-3 text-sm text-emerald-50 font-medium">
              Sign in to continue managing your waste collection system.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="p-4 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl text-sm font-medium text-white flex items-start gap-3 animate-fade-in shadow-lg shadow-red-500/10"
              >
                <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                </div>
                {error}
              </div>
            )}

            <div className="space-y-5">

              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-2 ml-1" htmlFor="email">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/50 group-focus-within:text-white transition-colors duration-200">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="appearance-none block w-full h-[56px] pl-12 pr-4 bg-white/10 dark:bg-slate-900/30 border border-white/20 dark:border-white/10 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 border-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.1)] focus:bg-white/20 dark:focus:bg-slate-900/50 transition-all duration-200 transform focus:scale-[1.01]"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1 mr-1">
                  <label className="block text-sm font-semibold text-white/90" htmlFor="password">
                    Password
                  </label>
                  <Link
                    to="/auth/reset-password"
                    className="text-sm font-medium text-emerald-100 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1 -mx-1"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/50 group-focus-within:text-white transition-colors duration-200">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="appearance-none block w-full h-[56px] pl-12 pr-12 bg-white/10 dark:bg-slate-900/30 border border-white/20 dark:border-white/10 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 border-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.1)] focus:bg-white/20 dark:focus:bg-slate-900/50 transition-all duration-200 transform focus:scale-[1.01]"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-r-2xl h-[56px] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex items-center justify-center w-full h-[56px] mt-8 rounded-2xl font-semibold text-white transition-all duration-300 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] focus:outline-none focus:ring-4 focus:ring-emerald-400/30"
              style={{
                background: 'linear-gradient(135deg, #34D399, #10B981)',
              }}
            >
              {/* Shimmer effect inside button on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-button-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

              {isSubmitting ? (
                <span className="flex items-center gap-2 drop-shadow-md relative z-10">
                  <LoadingSpinner size="sm" />
                  Signing in...
                </span>
              ) : (
                <span className="drop-shadow-md text-base relative z-10">Sign In</span>
              )}
            </button>

          </form>

          <div className="mt-8 text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
            <p className="text-sm text-emerald-50">
              Don't have an account?{' '}
              <Link
                to="/auth/register"
                className="font-semibold text-white underline decoration-white/30 decoration-2 underline-offset-4 hover:decoration-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1 -mx-1"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
