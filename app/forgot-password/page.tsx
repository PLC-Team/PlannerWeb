'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Mail, Loader2, Shield, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Password reset instructions have been sent to your email.');
        setEmail('');
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

        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-xl tracking-wider text-[#F8FAFC] font-heading uppercase">
            Recover Access
          </h1>
        </div>

        <p className="text-xs text-gray-400 font-mono">
          Enter your registered email address to receive a secure link to reset your password.
        </p>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 animated-fade font-mono">
            <Shield className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>ERR: {errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-lg flex items-center gap-2 animated-fade font-mono">
            <Shield className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <div className="form-group">
            <label htmlFor="email" className="text-[#93C5FD] text-[10px] font-extrabold tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#06B6D4]" /> Email Address
            </label>
            <div className="input-icon-wrapper relative">
              <input
                id="email"
                type="email"
                placeholder="operator@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#1A2333] border border-blue-500/20 text-[#F8FAFC] placeholder-slate-500 focus:border-[#06B6D4] focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] rounded-xl px-4 py-3 transition-all duration-300 outline-none w-full text-sm font-mono pl-10"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Reset Link
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
