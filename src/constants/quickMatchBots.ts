// src/constants/quickMatchBots.ts - Zero-Empty-Lobby Quick Match Bot Roster & Rotation Rules
import { safeStorage } from '../services/supabase';
import type { AvatarKey } from './avatars';

/**
 * Single-line feature flag: set to `false` once live player concurrency (500+ downloads)
 * is self-sustaining so Quick Match fallback uses only the 3 signature AI bots.
 */
export const ENABLE_UNDERCOVER_QUICK_MATCH_BOTS = true;

/**
 * Default live-queue search duration before seamlessly falling back to a Quick Match bot.
 */
export const QUICK_MATCH_SEARCH_TIMEOUT_SECONDS = 6;

export const QUICK_MATCH_BOT_COUNTER_KEY = '@rivalcard:quick_match_bot_counter';

export type QuickMatchBotRegion = 'pakistani' | 'indian' | 'anime' | 'signature';

export interface QuickMatchBotProfile {
  id: string;
  name: string;
  level: number;
  avatarId: AvatarKey;
  isUndercover: boolean;
  countsTowardCareerStats: boolean;
  region: QuickMatchBotRegion;
}

/**
 * 20 realistic Pakistani, Indian, and anime-inspired undercover profiles
 * with natural levels (2-14) and unlocked avatars up to Wolf.
 */
export const UNDERCOVER_QUICK_MATCH_BOTS: readonly QuickMatchBotProfile[] = [
  // Pakistani (8)
  { id: 'qm_bot_hamza', name: 'Hamza_OP', level: 9, avatarId: 'tiger', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_zain', name: 'ZainPlays', level: 6, avatarId: 'panda', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_ayesha', name: 'Ayesha_GG', level: 11, avatarId: 'fox', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_bilal', name: 'Bilal_King', level: 14, avatarId: 'wolf', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_usman', name: 'Usman_786', level: 4, avatarId: 'shield', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_mahnoor', name: 'Mahnoor_X', level: 8, avatarId: 'panda', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_saad', name: 'Saad_Clutch', level: 12, avatarId: 'wolf', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },
  { id: 'qm_bot_daniyal', name: 'Daniyal_PK', level: 3, avatarId: 'bot', isUndercover: true, countsTowardCareerStats: true, region: 'pakistani' },

  // Indian (7)
  { id: 'qm_bot_aarav', name: 'Aarav_OP', level: 10, avatarId: 'tiger', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_rohan', name: 'RohanPlays', level: 5, avatarId: 'fox', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_priya', name: 'Priya_GG', level: 7, avatarId: 'shield', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_kabir', name: 'Kabir_X', level: 13, avatarId: 'wolf', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_ananya', name: 'Ananya_99', level: 2, avatarId: 'panda', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_vikram', name: 'Vikram_IND', level: 11, avatarId: 'shield', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },
  { id: 'qm_bot_dev', name: 'Dev_Clutch', level: 8, avatarId: 'tiger', isUndercover: true, countsTowardCareerStats: true, region: 'indian' },

  // Anime / Global (5)
  { id: 'qm_bot_kaito', name: 'Kaito_99', level: 9, avatarId: 'tiger', isUndercover: true, countsTowardCareerStats: true, region: 'anime' },
  { id: 'qm_bot_hokage', name: 'ShadowHokage', level: 14, avatarId: 'wolf', isUndercover: true, countsTowardCareerStats: true, region: 'anime' },
  { id: 'qm_bot_itachi', name: 'ItachiVibes', level: 12, avatarId: 'wolf', isUndercover: true, countsTowardCareerStats: true, region: 'anime' },
  { id: 'qm_bot_gojo', name: 'Gojo_Satoru', level: 13, avatarId: 'shield', isUndercover: true, countsTowardCareerStats: true, region: 'anime' },
  { id: 'qm_bot_zoro', name: 'ZoroLostAgain', level: 6, avatarId: 'fox', isUndercover: true, countsTowardCareerStats: true, region: 'anime' },
] as const;

/**
 * Existing 3 named signature AI bots kept as the signature pool and post-500-download fallback.
 */
export const SIGNATURE_QUICK_MATCH_BOTS: readonly QuickMatchBotProfile[] = [
  { id: 'bot_nova', name: 'NovaBot', level: 10, avatarId: 'bot', isUndercover: false, countsTowardCareerStats: false, region: 'signature' },
  { id: 'bot_cyber', name: 'CyberBot', level: 8, avatarId: 'bot', isUndercover: false, countsTowardCareerStats: false, region: 'signature' },
  { id: 'bot_echo', name: 'EchoBot', level: 12, avatarId: 'bot', isUndercover: false, countsTowardCareerStats: false, region: 'signature' },
] as const;

const UNDERCOVER_BOT_ID_SET = new Set(UNDERCOVER_QUICK_MATCH_BOTS.map((b) => b.id));
const UNDERCOVER_BOT_NAME_SET = new Set(UNDERCOVER_QUICK_MATCH_BOTS.map((b) => b.name.toLowerCase()));

/**
 * Determines whether a single Quick Match opponent counts toward competitive Career Stats
 * (`games_played`, `wins`, `win_streak`):
 * - Real human players: true
 * - 20 human-named undercover Quick Match bots: true
 * - 3 named signature AI bots (NovaBot, CyberBot, EchoBot) or built-in solo bots: false
 */
export function doesOpponentCountTowardCareerStats(opponent: {
  id?: string;
  name?: string;
  isBot?: boolean;
  countsTowardCareerStats?: boolean;
}): boolean {
  if (typeof opponent.countsTowardCareerStats === 'boolean') {
    return opponent.countsTowardCareerStats;
  }
  if (!opponent.isBot) {
    return true;
  }
  if (opponent.id && UNDERCOVER_BOT_ID_SET.has(opponent.id)) {
    return true;
  }
  if (opponent.name && UNDERCOVER_BOT_NAME_SET.has(opponent.name.trim().toLowerCase())) {
    return true;
  }
  return false;
}

interface PersistedBotCounterState {
  count: number;
  nextSignatureAt: number;
}

function pickRandomFromPool(
  pool: readonly QuickMatchBotProfile[],
  rng: () => number = Math.random,
  excludeBotId?: string
): QuickMatchBotProfile {
  const candidates =
    excludeBotId && pool.length > 1
      ? pool.filter((b) => b.id !== excludeBotId)
      : pool;
  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length))
  );
  return candidates[idx];
}

function pickSignatureCadenceStep(rng: () => number = Math.random): 3 | 4 {
  return rng() < 0.5 ? 3 : 4;
}

/**
 * Pure deterministic rotation selector:
 * - When `enableUndercover` is false, always picks from the 3 signature bots.
 * - Otherwise, every `signatureInterval` (3rd or 4th) bot-matched Quick Match selects
 *   one of the 3 named signature bots; all others pick from the 20 undercover bots.
 */
export function selectQuickMatchBotForMatchNumber(
  botMatchNumber: number,
  options?: {
    signatureInterval?: 3 | 4;
    enableUndercover?: boolean;
    forceUndercover?: boolean;
    excludeBotId?: string;
    rng?: () => number;
  }
): QuickMatchBotProfile {
  const rng = options?.rng ?? Math.random;
  if (options?.forceUndercover) {
    return pickRandomFromPool(UNDERCOVER_QUICK_MATCH_BOTS, rng, options?.excludeBotId);
  }
  const enableUndercover = options?.enableUndercover ?? ENABLE_UNDERCOVER_QUICK_MATCH_BOTS;
  const interval = options?.signatureInterval ?? 4;

  if (!enableUndercover) {
    return pickRandomFromPool(SIGNATURE_QUICK_MATCH_BOTS, rng, options?.excludeBotId);
  }

  const shouldUseSignature = botMatchNumber > 0 && botMatchNumber % interval === 0;
  const pool = shouldUseSignature ? SIGNATURE_QUICK_MATCH_BOTS : UNDERCOVER_QUICK_MATCH_BOTS;
  return pickRandomFromPool(pool, rng, options?.excludeBotId);
}

/**
 * Persistently increments the Quick Match bot counter and returns the next bot opponent,
 * scheduling a named signature bot every 3rd or 4th bot-matched Quick Match.
 * When `forceUndercover` is true (e.g. 2-loss recovery match), always selects one of the
 * 20 human-named undercover bots without exposing a signature bot.
 */
export async function selectNextQuickMatchBot(options?: {
  enableUndercover?: boolean;
  forceUndercover?: boolean;
  excludeBotId?: string;
  rng?: () => number;
}): Promise<QuickMatchBotProfile> {
  const rng = options?.rng ?? Math.random;
  if (options?.forceUndercover) {
    return pickRandomFromPool(UNDERCOVER_QUICK_MATCH_BOTS, rng, options?.excludeBotId);
  }
  const enableUndercover = options?.enableUndercover ?? ENABLE_UNDERCOVER_QUICK_MATCH_BOTS;

  let state: PersistedBotCounterState = {
    count: 0,
    nextSignatureAt: pickSignatureCadenceStep(rng),
  };

  try {
    const raw = await safeStorage.getItem(QUICK_MATCH_BOT_COUNTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.count === 'number' && parsed.count >= 0) {
        state = {
          count: parsed.count,
          nextSignatureAt:
            typeof parsed.nextSignatureAt === 'number' && parsed.nextSignatureAt > parsed.count
              ? parsed.nextSignatureAt
              : parsed.count + pickSignatureCadenceStep(rng),
        };
      }
    }
  } catch {
    // Fallback cleanly to default initial counter state
  }

  const nextCount = state.count + 1;
  const useSignature = !enableUndercover || nextCount >= state.nextSignatureAt;

  const chosen = useSignature
    ? pickRandomFromPool(SIGNATURE_QUICK_MATCH_BOTS, rng, options?.excludeBotId)
    : pickRandomFromPool(UNDERCOVER_QUICK_MATCH_BOTS, rng, options?.excludeBotId);

  const nextState: PersistedBotCounterState = {
    count: nextCount,
    nextSignatureAt:
      nextCount >= state.nextSignatureAt
        ? nextCount + pickSignatureCadenceStep(rng)
        : state.nextSignatureAt,
  };

  try {
    await safeStorage.setItem(QUICK_MATCH_BOT_COUNTER_KEY, JSON.stringify(nextState));
  } catch {
    // Non-fatal storage error
  }

  return chosen;
}

/**
 * Resets persisted Quick Match bot counter (primarily for unit tests).
 */
export async function resetQuickMatchBotCounter(): Promise<void> {
  try {
    await safeStorage.removeItem(QUICK_MATCH_BOT_COUNTER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Natural human-like thinking delay (~2.2s to 3.6s) for Quick Match bot opponents
 * so human players have comfortable time to read each play.
 */
export function getQuickMatchBotThinkingDelayMs(
  fastBots: boolean = false,
  rng: () => number = Math.random
): number {
  const normalizedRng = Math.min(0.999999, Math.max(0, rng()));
  if (fastBots) {
    return 1000 + Math.floor(normalizedRng * 501);
  }
  return 2200 + Math.floor(normalizedRng * 1401);
}
