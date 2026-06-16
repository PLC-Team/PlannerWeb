'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Lock, Loader2, Shield, CheckCircle, Save } from 'lucide-react';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check if we actually have a session (the user should be logged in via the recovery link)
  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      if (!res.data || !res.data.session) {
        setErrorMsg('Invalid or expired recovery link. Please try resetting your password again.');
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setErrorMsg('Please enter both fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Your password has been successfully updated!');
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060B16] to-[#0B1220] flex flex-col justify-center items-center p-4 relative overflow-hidden scada-grid">
      <div className="scada-scanner" />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[130px] pointer-events-none" />
      
      <div className="w-full max-w-lg backdrop-blur-xl bg-[#090f1d]/75 border border-blue-500/20 p-8 rounded-2xl flex flex-col gap-6 relative z-10 scada-card-glow transition-all duration-300">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#06B6D4]/60 rounded-tl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#06B6D4]/60 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#06B6D4]/60 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#06B6D4]/60 rounded-br" />

        <div className="flex flex-col items-center gap-2 mb-2 text-center">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Lock className="w-7 h-7 text-[#F8FAFC]" />
          </div>
          <h1 className="font-extrabold text-xl tracking-wider text-[#F8FAFC] font-heading uppercase mt-3">
            Set New Password
          </h1>
          <p className="text-xs text-gray-400 font-mono">
            Please enter your new secure access password.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 animated-fade font-mono">
            <Shield className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>ERR: {errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 animated-fade font-mono">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#06B6D4]" /> New Password
            </label>
            <div className="input-icon-wrapper relative">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition-all duration-300 outline-none w-full text-sm font-mono pl-10"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>

          <div className="form-group">
            <label className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#06B6D4]" /> Confirm New Password
            </label>
            <div className="input-icon-wrapper relative">
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition-all duration-300 outline-none w-full text-sm font-mono pl-10"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-white font-extrabold uppercase tracking-widest text-xs py-3.5 mt-2 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save New Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
