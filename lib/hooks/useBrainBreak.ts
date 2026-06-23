'use client';
import { useState, useEffect, useCallback } from 'react';
import { getDailyGameStatus } from '@/app/actions/brain-break';

export type GameStatus = 'completed' | 'available' | 'locked';

export type GameInfo = {
  id: number;
  name: string;
  status: GameStatus;
  unlockTime: Date | null;
  timeRemainingMs: number | null;
};

const GAME_NAMES = [
  'Memory Match',
  'Mini Sudoku',
  '15 Puzzle',
  'Patches'
];

const COOLDOWN_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours

export function useBrainBreak() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [points, setPoints] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [baseStats, setBaseStats] = useState<any>(null);

  // Tick every second for countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyGameStatus();
      if (data) {
        setBaseStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch from DB only once on mount (or manual reload)
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Recalculate local stats every second without hitting the database!
  useEffect(() => {
    if (!baseStats) return;

    const { daily, stats } = baseStats;
    setPoints(stats.total_points);

    const completedAt = [
      daily.game_0_completed_at ? new Date(daily.game_0_completed_at) : null,
      daily.game_1_completed_at ? new Date(daily.game_1_completed_at) : null,
      daily.game_2_completed_at ? new Date(daily.game_2_completed_at) : null,
      daily.game_3_completed_at ? new Date(daily.game_3_completed_at) : null,
    ];

    setProgress(completedAt.filter((t: Date | null) => t !== null).length);

    const gameInfos: GameInfo[] = GAME_NAMES.map((name, i) => {
      let status: GameStatus = 'locked';
      let unlockTime: Date | null = null;

      if (completedAt[i]) {
        status = 'completed';
      } else if (i === 0) {
        status = 'available';
      } else {
        // It's locked. When does it unlock?
        // It unlocks 1.5hrs after the PREVIOUS game was completed.
        const prevCompletedAt = completedAt[i - 1];
        if (prevCompletedAt) {
          unlockTime = new Date(prevCompletedAt.getTime() + COOLDOWN_MS);
          if (now >= unlockTime.getTime()) {
            status = 'available';
          }
        }
      }

      let timeRemainingMs = null;
      if (unlockTime && status === 'locked') {
        timeRemainingMs = Math.max(0, unlockTime.getTime() - now);
        if (timeRemainingMs === 0) status = 'available'; // Catch edge case
      }

      return { id: i, name, status, unlockTime, timeRemainingMs };
    });

    setGames(gameInfos);
  }, [baseStats, now]);

  return { games, points, progress, loading, reload: loadStats };
}
