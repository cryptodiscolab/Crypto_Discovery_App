-- Migration: Atomic off-chain XP claim
-- Creates a single transaction to record a claim and increment XP safely

CREATE OR REPLACE FUNCTION public.fn_record_claim_and_award_xp(
    p_wallet_address text,
    p_task_id text,
    p_xp_earned integer,
    p_platform text,
    p_action_type text,
    p_target_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claim_id uuid;
    v_normalized_wallet text;
    v_already_claimed boolean;
BEGIN
    v_normalized_wallet := lower(p_wallet_address);

    -- 1. Ensure profile exists
    INSERT INTO public.user_profiles (wallet_address, total_xp, tier, created_at, updated_at)
    VALUES (v_normalized_wallet, 0, 1, now(), now())
    ON CONFLICT (wallet_address) DO NOTHING;

    -- 2. Anti-cheat: Check if target is already claimed by this user
    IF p_target_id IS NOT NULL AND p_target_id != '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_task_claims
            WHERE wallet_address = v_normalized_wallet
              AND platform = p_platform
              AND action_type = p_action_type
              AND target_id = p_target_id
        ) INTO v_already_claimed;

        IF v_already_claimed THEN
            RETURN json_build_object('success', false, 'error', '[Security] Target account already claimed by this user');
        END IF;
    END IF;

    -- 3. Insert claim
    BEGIN
        INSERT INTO public.user_task_claims (
            wallet_address,
            task_id,
            xp_earned,
            platform,
            action_type,
            target_id,
            claimed_at
        ) VALUES (
            v_normalized_wallet,
            p_task_id,
            p_xp_earned,
            p_platform,
            p_action_type,
            p_target_id,
            now()
        ) RETURNING id INTO v_claim_id;
    EXCEPTION WHEN unique_violation THEN
        -- Task already claimed
        RETURN json_build_object('success', false, 'alreadyClaimed', true, 'error', 'Task already claimed');
    END;

    -- 4. Increment XP via existing fn_increment_xp logic
    PERFORM public.fn_increment_xp(v_normalized_wallet, p_xp_earned);

    RETURN json_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'xpAwarded', p_xp_earned
    );
END;
$$;
