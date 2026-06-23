'use server';

import { createClient } from '@/lib/supabase/server';

export async function getDailyGameStatus() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];

  // 1. Get Daily Progress
  let { data: daily } = await supabase
    .from('user_daily_games')
    .select('*')
    .eq('user_id', user.id)
    .eq('play_date', today)
    .single();

  if (!daily) {
    const { data: newDaily } = await supabase
      .from('user_daily_games')
      .insert({ user_id: user.id, play_date: today })
      .select()
      .single();
    daily = newDaily;
  }

  // 2. Get Global Stats
  let { data: stats } = await supabase
    .from('user_game_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!stats) {
    const { data: newStats } = await supabase
      .from('user_game_stats')
      .insert({ user_id: user.id })
      .select()
      .single();
    stats = newStats;
  }

  return { daily, stats };
}

export async function completeGame(gameIndex: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // 1. Ensure daily record exists
  let { data: daily } = await supabase
    .from('user_daily_games')
    .select('*')
    .eq('user_id', user.id)
    .eq('play_date', today)
    .single();

  if (!daily) {
    const { data: newDaily } = await supabase
      .from('user_daily_games')
      .insert({ user_id: user.id, play_date: today })
      .select()
      .single();
    daily = newDaily;
  }

  // Double check if already completed
  const colName = `game_${gameIndex}_completed_at`;
  if (daily[colName]) return { success: false, message: 'Game already completed today' };

  // 2. Mark complete
  await supabase
    .from('user_daily_games')
    .update({ [colName]: now })
    .eq('id', daily.id);

  // 3. Update Stats (Points & Streaks)
  let { data: stats } = await supabase
    .from('user_game_stats')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!stats) {
    const { data: newStats } = await supabase
      .from('user_game_stats')
      .insert({ user_id: user.id })
      .select()
      .single();
    stats = newStats;
  }

  let pointsToAdd = 10;
  let currentStreak = stats.current_streak;
  let maxStreak = stats.max_streak;

  // Streak logic (if this is the first game of the day, update streak)
  if (stats.last_play_date !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (stats.last_play_date === yesterdayStr) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
  }

  // Check for daily completion bonus (if they just finished the 5th game)
  // Re-fetch daily to see all
  const { data: updatedDaily } = await supabase
    .from('user_daily_games')
    .select('*')
    .eq('id', daily.id)
    .single();

  const isAllComplete = 
    updatedDaily.game_0_completed_at &&
    updatedDaily.game_1_completed_at &&
    updatedDaily.game_2_completed_at &&
    updatedDaily.game_3_completed_at;

  if (isAllComplete && !updatedDaily.daily_bonus_awarded) {
    pointsToAdd += 50; // Bonus points!
    await supabase.from('user_daily_games').update({ daily_bonus_awarded: true }).eq('id', daily.id);
  }

  // Update Stats table
  await supabase
    .from('user_game_stats')
    .update({
      total_points: stats.total_points + pointsToAdd,
      current_streak: currentStreak,
      max_streak: maxStreak,
      last_play_date: today
    })
    .eq('id', stats.id);

  // 4. Badges Engine (Basic Implementation)
  if (currentStreak === 7) {
    await awardBadge(user.id, 'Consistency King');
  }
  if (isAllComplete) {
    await awardBadge(user.id, 'Brain Booster');
  }

  return { success: true, pointsEarned: pointsToAdd };
}

async function awardBadge(userId: string, badgeName: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .eq('badge_name', badgeName)
    .single();

  if (!data) {
    await supabase.from('user_badges').insert({ user_id: userId, badge_name: badgeName });
  }
}
