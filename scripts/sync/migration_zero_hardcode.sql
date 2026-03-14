-- Migration: Whitelisted Tokens & Campaign Schema Expansion
-- Enable dynamic token selection for sponsorships

-- 1. Create allowed_tokens table (Unified naming with Multi-Chain support)
CREATE TABLE IF NOT EXISTS public.allowed_tokens (
    address TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT,
    decimals INTEGER DEFAULT 18,
    is_active BOOLEAN DEFAULT true,
    chain_id INTEGER DEFAULT 8453, -- Default to Base Mainnet
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (chain_id, address),
    CONSTRAINT address_lowercase CHECK (address = LOWER(address))
);

-- Enable RLS
ALTER TABLE public.allowed_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.allowed_tokens
    FOR SELECT USING (true);

-- 2. Add columns to campaigns table for tracking rewards
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS payment_token TEXT,
ADD COLUMN IF NOT EXISTS reward_symbol TEXT;

-- 3. Seed initial tokens
INSERT INTO public.allowed_tokens (address, symbol, name, decimals, chain_id)
VALUES 
    ('0x0000000000000000000000000000000000000000', 'ETH', 'Native Ether', 18, 8453),
    (LOWER('0x3ba0C1fA4D6F2f758B8Fb222B063b8f6969dAFB4'), 'CREATOR', 'Creator Token', 18, 8453) -- Based on DAILY_APP's creatorToken address
ON CONFLICT (address) DO UPDATE SET 
    symbol = EXCLUDED.symbol,
    name = EXCLUDED.name,
    decimals = EXCLUDED.decimals,
    chain_id = EXCLUDED.chain_id;

-- 4. Add sponsorship_reward_amount to system_settings
INSERT INTO public.system_settings (key, value)
VALUES ('sponsorship_reward_amount', 5.0)
ON CONFLICT (key) DO NOTHING;

-- ✅ Database Schema Updated for Zero Hardcode.
