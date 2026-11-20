-- Rival Card: Supabase Free-Tier Storage, Index & Auto-Cleanup Migration
-- Ensures lean tables, ranking/matchmaking indexes, and automated stale/finished room pruning.

-- 1. Core tables (idempotent guards)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT 'Player',
  avatar_id TEXT NOT NULL DEFAULT 'avatar_1',
  level INTEGER NOT NULL DEFAULT 1,
  current_xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  coins INTEGER NOT NULL DEFAULT 250,
  gems INTEGER NOT NULL DEFAULT 10,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  is_guest BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting' | 'playing' | 'finished'
  player_count INTEGER NOT NULL DEFAULT 1,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- 2. Hot-Query & Leaderboard Indexes
-- Supports Quick Match open-room lookup and stale-room cleanup sweeps
CREATE INDEX IF NOT EXISTS idx_rooms_status_created_at
  ON public.rooms (status, created_at DESC);

-- Supports fast host-owned room lookup & cleanup on disconnect
CREATE INDEX IF NOT EXISTS idx_rooms_host_status
  ON public.rooms (host_id, status);

-- Supports Coins & Wins leaderboard ranking queries without sequential scans
CREATE INDEX IF NOT EXISTS idx_profiles_coins_desc
  ON public.profiles (coins DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_wins_desc
  ON public.profiles (wins DESC);

-- Supports active cloud-synced profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_guest_updated_at
  ON public.profiles (is_guest, updated_at DESC);

-- 3. Automatic Stale, Empty & Finished Room Cleanup Function
-- Prunes:
--   a) finished rooms (status = 'finished')
--   b) empty rooms (player_count <= 0 or empty players JSON array)
--   c) abandoned rooms untouched for more than 2 hours
CREATE OR REPLACE FUNCTION public.cleanup_stale_rooms(
  stale_age INTERVAL DEFAULT INTERVAL '2 hours'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM public.rooms
  WHERE status = 'finished'
     OR player_count <= 0
     OR jsonb_array_length(COALESCE(players, '[]'::jsonb)) = 0
     OR COALESCE(updated_at, created_at) < (NOW() - stale_age);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. Optional pg_cron Hourly Auto-Cleanup Schedule (safe when pg_cron is disabled on Free Tier)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-stale-rival-rooms')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-rival-rooms'
    );

    PERFORM cron.schedule(
      'cleanup-stale-rival-rooms',
      '0 * * * *',
      'SELECT public.cleanup_stale_rooms(INTERVAL ''2 hours'');'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if cron schema/permissions are restricted on the project tier
    NULL;
END
$$;
