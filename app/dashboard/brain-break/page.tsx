'use client';
import React, { useState, useEffect } from 'react';
import useUser from '@/lib/hooks/useUser';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Gamepad2, Award, Lock, Trophy } from 'lucide-react';
import MemoryMatch from '@/components/games/MemoryMatch';
import Patches from '@/components/games/Patches';
import MiniSudoku from '@/components/games/MiniSudoku';
import SlidingPuzzle from '@/components/games/SlidingPuzzle';
import { useBrainBreak } from '@/lib/hooks/useBrainBreak';
import { completeGame } from '@/app/actions/brain-break';
import DailyChallengeWidget from '@/components/dashboard/DailyChallengeWidget';

export default function BrainBreakPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameParam = searchParams.get('game');
  const gameIndex = gameParam ? parseInt(gameParam) : null;

  const { games, points, progress, loading, reload } = useBrainBreak();
  const [submitting, setSubmitting] = useState(false);
  const [gameScore, setGameScore] = useState<number | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const handleComplete = React.useCallback(async (finalScore: number, timeSeconds: number) => {
    if (!user || submitting || gameIndex === null) return;
    setSubmitting(true);
    try {
      const res = await completeGame(gameIndex);
      if (res.success && typeof res.pointsEarned === 'number') {
        setPointsEarned(res.pointsEarned);
        setGameScore(finalScore);
        await reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [user?.id, submitting, gameIndex, reload]);

  // If invalid game, redirect to main challenge menu
  useEffect(() => {
    if (gameIndex !== null && (gameIndex < 0 || gameIndex > 3)) {
      router.replace('/dashboard/brain-break');
    }
  }, [gameIndex, router]);

  if (!user || loading) return null;

  if (gameIndex !== null && (gameIndex < 0 || gameIndex > 3)) {
    return null;
  }

  if (gameIndex === null) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-120px)] p-6 animated-fade relative max-w-4xl mx-auto items-center justify-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none z-0" />
        
        <div className="z-10 w-full mb-8 flex items-center justify-start">
          <Link href="/dashboard/home" className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="z-10 w-full max-w-lg flex-grow flex items-center justify-center">
          <DailyChallengeWidget />
        </div>
      </div>
    );
  }

  const currentGame = games.find(g => g.id === gameIndex);
  if (!currentGame) return null;

  const renderGame = () => {
    switch (gameIndex) {
      case 0: return <MemoryMatch onComplete={handleComplete} />;
      case 1: return <MiniSudoku onComplete={handleComplete} />;
      case 2: return <SlidingPuzzle onComplete={handleComplete} />;
      case 3: return <Patches onComplete={handleComplete} />;
      default: return null;
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] p-6 animated-fade relative max-w-4xl mx-auto">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none z-0" />

      <div className="z-10 w-full mb-8 flex items-center justify-between">
        <Link href="/dashboard/brain-break" className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Challenges
        </Link>
        <div className="flex items-center gap-2 text-purple-400 font-heading tracking-widest bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/20">
          <Gamepad2 className="w-4 h-4" /> DAILY BRAIN BREAK
        </div>
      </div>

      <div className="z-10 w-full flex-grow flex flex-col items-center justify-center">
        {currentGame.status === 'locked' ? (
          <div className="flex flex-col items-center justify-center p-8 backdrop-blur-md bg-slate-900/50 rounded-2xl border border-white/10 max-w-sm text-center mx-auto">
            <Lock className="w-16 h-16 text-slate-500 mb-4" />
            <h2 className="text-2xl font-bold text-white font-heading tracking-wider mb-2">GAME LOCKED</h2>
            <p className="text-slate-400 mb-6">
              You must wait 1.5 hours after completing the previous game to unlock this challenge.
            </p>
            <div className="bg-slate-800 border border-white/5 rounded-xl p-4 w-full">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest block mb-1">Time Remaining</span>
              <span className="text-4xl font-extrabold text-cyan-400 font-mono">
                {currentGame.timeRemainingMs !== null ? formatTime(currentGame.timeRemainingMs) : '--:--:--'}
              </span>
            </div>
            <Link href="/dashboard/brain-break" className="mt-6 text-sm text-purple-400 hover:underline uppercase tracking-widest font-bold">
              Return to Challenges
            </Link>
          </div>
        ) : currentGame.status === 'completed' ? (
          <div className="flex flex-col items-center justify-center p-8 backdrop-blur-md bg-slate-900/50 rounded-2xl border border-white/10 max-w-sm text-center mx-auto">
            <Award className="w-16 h-16 text-emerald-400 mb-4" />
            <h2 className="text-2xl font-bold text-white font-heading tracking-wider mb-2">CHALLENGE COMPLETE</h2>
            <p className="text-slate-400 mb-6">
              You've successfully completed this game for today!
            </p>
            <div className="flex gap-4 w-full">
              {gameScore !== null && (
                <div className="bg-slate-800 border border-white/5 rounded-xl p-4 flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Game Score</span>
                  <span className="text-3xl font-extrabold text-cyan-400">{gameScore}</span>
                </div>
              )}
              {pointsEarned !== null && (
                <div className="bg-slate-800 border border-white/5 rounded-xl p-4 flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Points Earned</span>
                  <span className="text-3xl font-extrabold text-yellow-400 flex items-center justify-center gap-1">
                    +{pointsEarned} <Trophy className="w-5 h-5" />
                  </span>
                </div>
              )}
            </div>
            <Link href="/dashboard/brain-break" className="mt-8 bg-purple-500 text-white px-6 py-2 rounded font-bold uppercase tracking-widest hover:bg-purple-400 transition-colors w-full text-center">
              Back to Challenges
            </Link>
          </div>
        ) : (
          <div className="w-full">
            <p className="text-center text-slate-400 mb-8 max-w-lg mx-auto uppercase tracking-widest font-bold text-sm">
              Playing: <span className="text-white">{currentGame.name}</span>
            </p>
            {renderGame()}
          </div>
        )}
      </div>
    </div>
  );
}
