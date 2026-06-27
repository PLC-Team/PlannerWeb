'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import useUser from '@/lib/hooks/useUser';
import { getEmailFromEmployeeId } from '@/app/actions/auth';
import { Lock, Mail, Loader2, Sparkles, Shield, User as UserIcon, Cpu, Layers, Terminal } from 'lucide-react';



export default function LoginPage() {
  const { user, session, loading } = useUser();
  const router = useRouter();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Redirect if already logged in and prefetch dashboard for faster login
  useEffect(() => {
    if (!loading && session && user) {
      router.replace(`/dashboard/home`);
    } else if (!loading && !session) {
      // Prefetch the dashboard so that the JS chunks load in the background while user is typing
      router.prefetch('/dashboard/home');
    }
  }, [loading, session, user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !password) {
      setErrorMsg('Please enter both Employee ID and password.');
      return;
    }

    setLoginLoading(true);
    setErrorMsg('');

    try {
      // 1. Look up email by Employee ID
      const { email, error: lookupError } = await getEmailFromEmployeeId(employeeId);
      
      if (lookupError || !email) {
        setErrorMsg(lookupError || 'Employee ID not found.');
        setLoginLoading(false);
        return;
      }

      // 2. Authenticate using the fetched email
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoginLoading(false);
      }
      // On success, we keep loginLoading true until the redirect happens automatically via AuthContext
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setLoginLoading(false);
    }
  };


  if (loading || (session && user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#060B16] gap-4 relative overflow-hidden scada-grid">
        <div className="scada-scanner" />
        <Loader2 className="w-12 h-12 text-[#06B6D4] animate-spin" />
        <p className="text-[#94A3B8] font-mono text-xs uppercase tracking-widest">Initialising Secure Link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060B16] to-[#0B1220] flex flex-col justify-center items-center p-4 relative overflow-hidden scada-grid">
      {/* SCADA scanner line */}
      <div className="scada-scanner" />

      {/* Futuristic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[130px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg backdrop-blur-xl bg-[#090f1d]/75 border border-blue-500/20 p-8 rounded-2xl flex flex-col gap-6 relative z-10 scada-card-glow transition-all duration-300">
        
        {/* Decorative corner brackets for industrial UI theme */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#06B6D4]/60 rounded-tl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#06B6D4]/60 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#06B6D4]/60 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#06B6D4]/60 rounded-br" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-500/10 hover:shadow-cyan-500/30 transition-all duration-300">
            <Cpu className="w-7 h-7 text-[#F8FAFC]" />
          </div>
          <div className="flex flex-col items-center mt-2">
            <span className="text-[#06B6D4] font-mono text-[9px] font-extrabold uppercase tracking-[0.25em] bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
              CONTROL_SYS // ACTIVE
            </span>
            <h1 className="font-extrabold text-2xl tracking-wider text-[#F8FAFC] mt-2 font-heading">
              WorkSync
            </h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 animated-fade font-mono">
            <Shield className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>ERR: {errorMsg}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="form-group">
            <label htmlFor="employeeId" className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[#06B6D4]" /> Employee ID
            </label>
            <div className="input-icon-wrapper">
              <input
                id="employeeId"
                type="text"
                placeholder="e.g. EMP123"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition-all duration-300 outline-none w-full text-sm font-mono"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#06B6D4]" /> Access Password
            </label>
            <div className="input-icon-wrapper">
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition-all duration-300 outline-none w-full text-sm font-mono"
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-xs text-[#06B6D4] hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-white font-extrabold uppercase tracking-widest text-xs py-3.5 mt-2 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loginLoading}
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Connecting...
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4" /> Login
              </>
            )}
          </button>
        </form>


      </div>
    </div>
  );
}
