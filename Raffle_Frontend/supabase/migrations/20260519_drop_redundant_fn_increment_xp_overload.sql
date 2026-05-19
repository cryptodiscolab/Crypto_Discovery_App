-- Migration: Drop redundant integer overload of fn_increment_xp to prevent PGRST203 overload ambiguity
-- Created: 2026-05-19
-- Category: Database Schema Hardening
-- Status: Applied Live, Tracked for Portability

-- Drop the integer signature which caused PostgREST PGRST203 ambiguity errors.
-- We retain the single authoritative numeric overload: fn_increment_xp(p_wallet text, p_amount numeric)
DROP FUNCTION IF EXISTS public.fn_increment_xp(p_wallet text, p_amount integer);
