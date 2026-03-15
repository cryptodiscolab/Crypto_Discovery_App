-- Bug 1 Fix: Diamond Tier has the wrong XP threshold
-- Due to Supabase REST permissions treating sbt_thresholds as a view or caching issue, 
-- please run this manually in your Supabase SQL Editor.

-- Method 1: If sbt_thresholds is a real table
UPDATE sbt_thresholds SET min_xp = 5000 WHERE level = 5;

-- Method 2: If sbt_thresholds is a view pulling from point_settings, run this instead
-- UPDATE point_settings SET points_value = 5000 WHERE activity_key = 'tier_5_req';

-- Force clear the PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
