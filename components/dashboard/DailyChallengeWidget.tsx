'use client';

import React from 'react';
import Link from 'next/link';
import { Gamepad2, CheckCircle2, Lock, PlayCircle, Trophy } from 'lucide-react';
import { useBrainBreak } from '@/lib/hooks/useBrainBreak';

export default function DailyChallengeWidget() {
  const { games, points, progress, loading } = useBrainBreak();

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-6 animate-pulse h-[400px]">
        <div className="h-6 w-48 bg-slate-800 rounded mb-6"></div>
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-full bg-slate-800 rounded"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl flex flex-col h-full relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Gamepad2 className="w-48 h-48" />
      </div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/30">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-white font-heading tracking-widest">DAILY CHALLENGES</h3>
      </div>

      <div className="flex-grow space-y-3 relative z-10">
        {games.map((game, idx) => {
          const isCompleted = game.status === 'completed';
          const isAvailable = game.status === 'available';
          const isLocked = game.status === 'locked';

          return (
            <div 
              key={game.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' :
                isAvailable ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' :
                'bg-slate-800/50 border-slate-700/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isAvailable && <PlayCircle className="w-5 h-5 text-purple-400 animate-pulse" />}
                {isLocked && <Lock className="w-5 h-5 text-slate-500" />}
                <span className={`font-semibold ${isCompleted ? 'text-emerald-100' : isAvailable ? 'text-white' : 'text-slate-400'}`}>
                  {game.name}
                </span>
              </div>
              
              <div className="text-sm font-mono text-right">
                {isCompleted && <span className="text-emerald-400 font-bold">Completed</span>}
                {isAvailable && (
                  <Link href={`/dashboard/brain-break?game=${game.id}`} className="bg-purple-500 text-white px-3 py-1 rounded font-bold hover:bg-purple-400 transition-colors">
                    PLAY NOW
                  </Link>
                )}
                {isLocked && (
                  <span className="text-slate-400">
                    {game.timeRemainingMs !== null 
                      ? `Unlocks in ${formatTime(game.timeRemainingMs)}` 
                      : 'Locked'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between relative z-10">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Today's Progress</p>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-black text-white">{progress}<span className="text-slate-500 text-lg">/4</span></div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Reward Points</p>
          <div className="flex items-center justify-end gap-2 text-cyan-400 font-black text-2xl">
            <Trophy className="w-5 h-5" /> {points}
          </div>
        </div>
      </div>
    </div>
  );
}
