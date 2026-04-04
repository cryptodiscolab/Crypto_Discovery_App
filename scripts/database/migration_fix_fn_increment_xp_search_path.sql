-- Fix: function_search_path_mutable security warning
-- Target: public.fn_increment_xp
-- Rationale: SECURITY DEFINER functions without a search_path are vulnerable to search path hijacking.

ALTER FUNCTION public.fn_increment_xp SET search_path = public, pg_catalog;
