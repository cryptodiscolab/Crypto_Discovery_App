-- Migration: Atomic UGC campaign reward pool decrement
-- Keeps campaign.remaining_reward_pool consistent during concurrent reward claims.

CREATE OR REPLACE FUNCTION public.fn_decrement_campaign_reward_pool_atomic(
    p_campaign_id uuid,
    p_reward_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_remaining numeric;
BEGIN
    IF p_campaign_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'CAMPAIGN_ID_REQUIRED');
    END IF;

    IF p_reward_amount IS NULL OR p_reward_amount < 0 THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_REWARD_AMOUNT');
    END IF;

    IF p_reward_amount = 0 THEN
        SELECT remaining_reward_pool
        INTO v_remaining
        FROM public.campaigns
        WHERE id = p_campaign_id;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'error', 'CAMPAIGN_NOT_FOUND');
        END IF;

        RETURN json_build_object('success', true, 'remaining_reward_pool', v_remaining);
    END IF;

    UPDATE public.campaigns
    SET remaining_reward_pool = remaining_reward_pool - p_reward_amount
    WHERE id = p_campaign_id
      AND remaining_reward_pool >= p_reward_amount
    RETURNING remaining_reward_pool INTO v_remaining;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'INSUFFICIENT_REWARD_POOL');
    END IF;

    RETURN json_build_object('success', true, 'remaining_reward_pool', v_remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_decrement_campaign_reward_pool_atomic(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_decrement_campaign_reward_pool_atomic(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.fn_decrement_campaign_reward_pool_atomic(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decrement_campaign_reward_pool_atomic(uuid, numeric) TO service_role;
