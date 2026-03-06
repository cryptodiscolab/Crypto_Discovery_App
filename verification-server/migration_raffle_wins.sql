-- Migration: Add raffle_wins support
-- Run this in Supabase SQL Editor

-- 1. Add raffle_wins column to user_profiles (default 0)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS raffle_wins INTEGER DEFAULT 0 NOT NULL;

-- 2. Add point_settings entry for raffle_win (winning the prize)
INSERT INTO public.point_settings (activity_key, points_value, platform, action_type, description, is_active)
VALUES 
    ('raffle_win', 1000, 'system', 'Claim', 'Bonus XP for winning and claiming an NFT Raffle prize', true)
ON CONFLICT (activity_key) 
DO UPDATE SET 
    points_value = EXCLUDED.points_value,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- 3. Create RPC function to increment raffle_wins atomically
CREATE OR REPLACE FUNCTION public.fn_increment_raffle_wins(p_wallet TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_profiles
    SET raffle_wins = raffle_wins + 1
    WHERE wallet_address = lower(p_wallet);
END;
$$;
