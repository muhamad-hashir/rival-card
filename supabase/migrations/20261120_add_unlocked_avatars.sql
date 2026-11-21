-- Rival Card: Additive migration for 12-Avatar Level + Coin unlock progression
-- Safe & idempotent: adds unlocked_avatars column and preserves any existing equipped avatar.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unlocked_avatars TEXT[] NOT NULL DEFAULT ARRAY['fox', 'bot'];

-- Backfill existing players so their currently equipped legacy/canonical avatar is always preserved
UPDATE public.profiles
SET unlocked_avatars = (
  SELECT ARRAY(
    SELECT DISTINCT elem
    FROM unnest(
      COALESCE(unlocked_avatars, ARRAY['fox', 'bot']) ||
      ARRAY[
        'fox',
        'bot',
        CASE LOWER(COALESCE(avatar_id, 'fox'))
          WHEN 'avatar_1' THEN 'fox'
          WHEN 'avatar_2' THEN 'bot'
          WHEN 'avatar_3' THEN 'tiger'
          WHEN 'avatar_4' THEN 'panda'
          WHEN 'avatar_5' THEN 'rival'
          WHEN 'avatar_6' THEN 'champ'
          WHEN 'avatar_7' THEN 'shield'
          WHEN 'avatar_8' THEN 'wolf'
          WHEN 'avatar_9' THEN 'ninja'
          WHEN 'avatar_10' THEN 'jester'
          WHEN 'avatar_11' THEN 'flame'
          WHEN 'avatar_12' THEN 'dragon'
          ELSE LOWER(COALESCE(avatar_id, 'fox'))
        END
      ]
    ) AS elem
    WHERE elem IN (
      'fox', 'bot', 'panda', 'shield', 'tiger', 'wolf',
      'rival', 'ninja', 'jester', 'flame', 'champ', 'dragon'
    )
  )
);
