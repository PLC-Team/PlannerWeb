'use client';
import React, { useState, useEffect } from 'react';

const QUESTIONS = [
  { q: "What does PLC stand for?", opts: ["Programmable Logic Controller", "Private Local Connection", "Public Line Center", "Personal Logic Computer"], a: 0 },
  { q: "In what year was the first PLC invented?", opts: ["1955", "1968", "1982", "1995"], a: 1 },
  { q: "Which company is credited with inventing the first PLC?", opts: ["Siemens", "Allen-Bradley", "Modicon (Bedford Associates)", "General Electric"], a: 2 },
  { q: "Which protocol is commonly used for industrial networking?", opts: ["HTTP", "Modbus", "FTP", "SMTP"], a: 1 }
];

export default function TriviaGame({ onComplete }: { onComplete: (score: number, timeSeconds: number) => void }) {
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<'playing' | 'answered'>('playing');
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    setQuestion(QUESTIONS[dayOfYear % QUESTIONS.length]);
  }, []);

  const handleSelect = (idx: number) => {
    if (status !== 'playing') return;
    setSelected(idx);
    setStatus('answered');
    const isCorrect = idx === question.a;
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    onComplete(isCorrect ? 100 : 0, timeTaken);
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto p-6 backdrop-blur-md bg-slate-900/50 rounded-xl border border-white/10">
      <h3 className="text-xl font-bold text-white font-heading tracking-widest text-center">DAILY TRIVIA</h3>
      <p className="text-[#F8FAFC] text-center font-medium leading-relaxed">
        {question.q}
      </p>
      <div className="flex flex-col gap-3 w-full">
        {question.opts.map((opt, idx) => {
          let btnClass = 'bg-[#1A2333] border border-white/5 hover:border-blue-500/50 text-[#CBD5E1]';
          if (status === 'answered') {
            if (idx === question.a) btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
            else if (idx === selected) btnClass = 'bg-red-500/20 border-red-500 text-red-400';
            else btnClass = 'bg-[#1A2333] border-white/5 opacity-50 text-slate-500';
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={status !== 'playing'}
              className={`p-4 rounded-xl text-sm font-semibold transition-all duration-300 ${btnClass} text-left`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {status === 'answered' && (
        <p className={`font-bold ${selected === question.a ? 'text-emerald-400' : 'text-red-400'}`}>
          {selected === question.a ? '+100 Points!' : 'Incorrect!'}
        </p>
      )}
    </div>
  );
}
