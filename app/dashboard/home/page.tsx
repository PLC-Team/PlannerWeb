'use client';

import React, { useState, useEffect } from 'react';
import useUser from '@/lib/hooks/useUser';
import { getQuoteOfTheDay } from '@/app/actions/quote';
import { Loader2, Gamepad2 } from 'lucide-react';
import Link from 'next/link';

export default function HomeDashboard() {
  const { user } = useUser();
  const [quote, setQuote] = useState({ text: "Loading daily inspiration...", author: "" });
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Quote
    getQuoteOfTheDay().then((q) => {
      setQuote(q);
      setLoading(false);
    });

    // 2. Start Clock
    const timer = setInterval(() => setTime(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  if (!user || loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  const fullName = user.name || '';
  const firstName = fullName.split(' ')[0];

  const weekday = time.toLocaleDateString('en-US', { weekday: 'long' });
  const day = time.getDate().toString().padStart(2, '0');
  const month = time.toLocaleDateString('en-US', { month: 'long' });
  const year = time.getFullYear();
  const formattedDate = `${weekday}, ${day} ${month} ${year}`;
  
  const formattedTime = time.toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', hour12: true 
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] animated-fade relative w-full max-w-4xl mx-auto px-4">
      {/* Soft background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none z-0" />

      <div className="z-10 w-full text-center mb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#F8FAFC] font-heading mb-4">
          Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{firstName}</span>
        </h1>
        <p className="text-base text-[#64748B] font-medium tracking-wide">
          {formattedDate} | {formattedTime}
        </p>
      </div>

      {/* Minimal Quote of the Day */}
      <div className="z-10 w-full max-w-3xl relative text-center px-4 md:px-12">
        <p className="text-2xl md:text-3xl font-medium text-[#F8FAFC] leading-relaxed mb-8 text-balance font-serif">
          "{quote.text}"
        </p>
        
        {quote.author && (
          <p className="text-sm md:text-base font-semibold text-[#94A3B8] tracking-widest uppercase">
            – {quote.author}
          </p>
        )}
      </div>

      {/* Brain Break Entry */}
      <div className="z-10 mt-12 mb-8 animate-fade-in delay-200">
        <Link 
          href="/dashboard/brain-break" 
          className="flex items-center gap-3 backdrop-blur-md bg-purple-500/10 border border-purple-500/20 hover:border-purple-400/50 hover:bg-purple-500/20 text-purple-300 px-6 py-3 rounded-full transition-all duration-300 group shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)]"
        >
          <Gamepad2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-heading tracking-widest text-sm font-bold">DAILY CHALLENGES</span>
        </Link>
      </div>

    </div>
  );
}
