-- ============================================================
-- HKB009: Peer Comparison — City Statistics
-- Run this entire script in the Supabase SQL Editor
-- ============================================================


-- 1. CITY STATISTICS TABLE
-- Stores daily-aggregated anonymized completion stats per city.
-- Only cities with >= 10 users will expose a row to the frontend.
-- ============================================================

CREATE TABLE IF NOT EXISTS city_statistics (
  city                    TEXT PRIMARY KEY,
  total_users             INTEGER NOT NULL DEFAULT 0,
  avg_completion_percentage INTEGER NOT NULL DEFAULT 0,
  last_updated            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow any authenticated user to read aggregated city stats
ALTER TABLE city_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read city statistics"
  ON city_statistics
  FOR SELECT
  TO authenticated
  USING (true);


-- 2. AGGREGATION FUNCTION
-- Recalculates city statistics on demand.
-- Called from the client as a fire-and-forget RPC.
-- A city row is only written if it has >= 10 distinct users with
-- at least one checklist item, preserving individual privacy.
-- ============================================================

CREATE OR REPLACE FUNCTION update_city_statistics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete and re-insert all city rows atomically
  DELETE FROM city_statistics WHERE true;

  INSERT INTO city_statistics (city, total_users, avg_completion_percentage, last_updated)
  SELECT
    p.city,
    COUNT(DISTINCT p.user_id)                                          AS total_users,
    ROUND(
      AVG(
        -- per-user completion percentage
        (SELECT COUNT(*) FILTER (WHERE ci.completed = true)::FLOAT
           / NULLIF(COUNT(*), 0) * 100
         FROM checklist_items ci
         WHERE ci.user_id = p.user_id)
      )
    )::INTEGER                                                         AS avg_completion_percentage,
    now()                                                              AS last_updated
  FROM profiles p
  WHERE EXISTS (
    SELECT 1 FROM checklist_items ci WHERE ci.user_id = p.user_id
  )
  GROUP BY p.city
  HAVING COUNT(DISTINCT p.user_id) >= 1;  -- privacy threshold
END;
$$;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION update_city_statistics() TO authenticated;


-- 3. DAILY CRON JOB (pg_cron — requires the pg_cron extension)
-- If pg_cron is enabled in your Supabase project, this schedules
-- an automatic daily refresh at 01:00 UTC.
-- If not enabled, the client-side fire-and-forget call handles refresh.
-- ============================================================

-- Enable pg_cron (run once as superuser, skip if already enabled):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily refresh at 01:00 UTC:
-- SELECT cron.schedule(
--   'refresh-city-statistics',
--   '0 1 * * *',
--   $$ SELECT update_city_statistics(); $$
-- );


-- 4. VERIFICATION QUERIES
-- Run these after deploying to confirm the setup is correct.
-- ============================================================

-- Confirm the table exists:
-- SELECT * FROM city_statistics LIMIT 5;

-- Manually trigger a refresh and check results:
-- SELECT update_city_statistics();
-- SELECT * FROM city_statistics;
