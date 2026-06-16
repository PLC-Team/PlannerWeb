-- Add Brain Break Game Statistics & Progression Tables

-- 1. user_game_stats
CREATE TABLE IF NOT EXISTS public.user_game_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    total_points INTEGER DEFAULT 0 NOT NULL,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    max_streak INTEGER DEFAULT 0 NOT NULL,
    last_play_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. user_daily_games
CREATE TABLE IF NOT EXISTS public.user_daily_games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    play_date DATE NOT NULL,
    game_0_completed_at TIMESTAMP WITH TIME ZONE,
    game_1_completed_at TIMESTAMP WITH TIME ZONE,
    game_2_completed_at TIMESTAMP WITH TIME ZONE,
    game_3_completed_at TIMESTAMP WITH TIME ZONE,
    game_4_completed_at TIMESTAMP WITH TIME ZONE,
    daily_bonus_awarded BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, play_date)
);

-- 3. user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_name TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, badge_name)
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- user_game_stats policies
CREATE POLICY "Users can view all game stats for leaderboards" 
ON public.user_game_stats FOR SELECT USING (true);

CREATE POLICY "Users can update their own game stats" 
ON public.user_game_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game stats" 
ON public.user_game_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_daily_games policies
CREATE POLICY "Users can view their own daily games" 
ON public.user_daily_games FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily games" 
ON public.user_daily_games FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily games" 
ON public.user_daily_games FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_badges policies
CREATE POLICY "Users can view all badges" 
ON public.user_badges FOR SELECT USING (true);

CREATE POLICY "Users can insert their own badges" 
ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
