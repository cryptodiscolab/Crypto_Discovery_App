-- Migration: Whitelisted Tokens & Campaign Schema Expansion
-- Enable dynamic token selection for sponsorships

-- 1. Create whitelisted_tokens table
CREATE TABLE IF NOT EXISTS public.whitelisted_tokens (
    address TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT,
    decimals INTEGER DEFAULT 18,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT address_lowercase CHECK (address = LOWER(address))
);

-- 2. Add columns to campaigns table for tracking rewards
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS payment_token TEXT,
ADD COLUMN IF NOT EXISTS reward_symbol TEXT;

-- 3. Seed initial tokens
INSERT INTO public.whitelisted_tokens (address, symbol, name, decimals)
VALUES 
    ('0x0000000000000000000000000000000000000000', 'ETH', 'Native Ether', 18),
    (LOWER('0x3ba0C1fA4D6F2f758B8Fb222B063b8f6969dAFB4'), 'CREATOR', 'Creator Token', 18) -- Based on DAILY_APP's creatorToken address
ON CONFLICT (address) DO UPDATE SET 
    symbol = EXCLUDED.symbol,
    name = EXCLUDED.name,
    decimals = EXCLUDED.decimals;

-- 4. Add sponsorship_reward_amount to system_settings
INSERT INTO public.system_settings (key, value)
VALUES ('sponsorship_reward_amount', 5.0)
ON CONFLICT (key) DO NOTHING;

-- ✅ Database Schema Updated for Zero Hardcode.
