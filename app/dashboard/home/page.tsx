'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import useUser from '@/lib/hooks/useUser';
import { getQuoteOfTheDay } from '@/app/actions/quote';
import { Loader2, Gamepad2 } from 'lucide-react';
import Link from 'next/link';

export default function HomeDashboard() {
  const { user } = useUser();
  const [time, setTime] = useState(new Date());

  const fetchQuote = async () => {
    const q = await getQuoteOfTheDay();
    return q;
  };

  const { data: quoteData } = useSWR('quoteOfTheDay', fetchQuote, {
    fallbackData: { text: "Loading daily inspiration...", author: "" },
    revalidateOnFocus: false,
    dedupingInterval: 3600000 // 1 hour
  });

  const quote = quoteData || { text: "Loading daily inspiration...", author: "" };
  const loading = !quoteData;

  useEffect(() => {
    // Start Clock
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

      <div className="z-10 w-full text-center mb-16 animate-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#F8FAFC] font-heading mb-4">
          Welcome, <span className="text-[#3B82F6]">{firstName}</span>
        </h1>
        <p className="text-sm text-[#94A3B8] font-bold tracking-[0.2em] uppercase">
          {formattedDate} <span className="mx-2 text-[#475569]">|</span> {formattedTime}
        </p>
      </div>

      {/* Minimal Quote of the Day */}
      <div className="z-10 w-full max-w-3xl relative text-center px-8 md:px-12 py-10 glass-panel animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <p className="text-2xl md:text-3xl font-medium text-[#F8FAFC] leading-relaxed mb-6 text-balance font-serif drop-shadow-sm">
          "{quote.text}"
        </p>
        
        {quote.author && (
          <p className="text-sm md:text-base font-semibold text-[#94A3B8] tracking-widest uppercase">
            – {quote.author}
          </p>
        )}
      </div>

      <div className="z-10 mt-12 mb-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <Link 
          href="/dashboard/brain-break" 
          className="flex items-center gap-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-3.5 rounded-full transition-all duration-300 group shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_25px_rgba(37,99,235,0.6)]"
        >
          <Gamepad2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-heading tracking-widest text-sm font-bold uppercase">Let's Play</span>
        </Link>
      </div>

    </div>
  );
}
