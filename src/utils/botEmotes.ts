// src/utils/botEmotes.ts - Pure local situational emoji reactions strictly for 20 undercover Quick Match bots
import {
  SIGNATURE_QUICK_MATCH_BOTS,
  UNDERCOVER_QUICK_MATCH_BOTS,
} from '../constants/quickMatchBots';
import type { CardValue } from '../types';

export type BotEmoteEvent =
  | 'bot_action_card'
  | 'bot_hit_draw'
  | 'bot_one_card'
  | 'human_slow_turn'
  | 'match_end';

export const BOT_EMOTE_PROBABILITY = 0.4;
export const BOT_EMOTE_COOLDOWN_MS = 15_000;
export const BOT_EMOTE_DELAY_MIN_MS = 600;
export const BOT_EMOTE_DELAY_MAX_MS = 1200;

export const TAUNT_EMOJIS = [
  '😎', '😈', '😂', '😱',
  '😭', '😤', '🔥', '😉',
  '👀', '⏳', '👏', '🤝',
  '⚡', '👑', '🛡️', '👋',
] as const;

export const BOT_EMOTE_POOLS: Readonly<Record<BotEmoteEvent, readonly string[]>> = {
  bot_action_card: ['😎', '😈', '😂'],
  bot_hit_draw: ['😱', '😭', '😤'],
  bot_one_card: ['🔥', '😉'],
  human_slow_turn: ['👀', '⏳'],
  match_end: ['👏', '🤝'],
} as const;

export interface LocalBotTauntMessage {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  senderAvatarId?: string;
  timestamp: number;
}

export interface BotEmoteTriggerInput {
  botId: string;
  botName: string;
  botAvatarId?: string;
  isAiSeat: boolean;
  countsTowardCareerStats?: boolean;
  event: BotEmoteEvent;
  lastEmoteAtByBot: Record<string, number>;
  nowMs?: number;
  rng?: () => number;
  probability?: number;
  cooldownMs?: number;
}

const UNDERCOVER_BOT_ID_SET = new Set(UNDERCOVER_QUICK_MATCH_BOTS.map((b) => b.id));
const UNDERCOVER_BOT_NAME_SET = new Set(
  UNDERCOVER_QUICK_MATCH_BOTS.map((b) => b.name.trim().toLowerCase())
);
const SIGNATURE_BOT_ID_SET = new Set([
  ...SIGNATURE_QUICK_MATCH_BOTS.map((b) => b.id),
  'bot1',
  'bot2',
  'bot3',
  'bot_rival',
  'tutorial_coach',
]);
const SIGNATURE_BOT_NAME_SET = new Set([
  ...SIGNATURE_QUICK_MATCH_BOTS.map((b) => b.name.trim().toLowerCase()),
  'rivalbot',
  'coachbot',
]);

/**
 * Returns true ONLY for the 20 human-named undercover Quick Match bots.
 * The 3 named signature game bots (NovaBot, CyberBot, EchoBot), Solo bots, and humans return false.
 */
export function isUndercoverEmoteEligible(player: {
  id?: string;
  name?: string;
  isBot?: boolean;
  isBotControlled?: boolean;
  countsTowardCareerStats?: boolean;
}): boolean {
  if (!player.isBot) {
    return false;
  }

  const normalizedName = player.name?.trim().toLowerCase().replace(/\s*🤖$/, '');
  if (player.id && SIGNATURE_BOT_ID_SET.has(player.id)) {
    return false;
  }
  if (normalizedName && SIGNATURE_BOT_NAME_SET.has(normalizedName)) {
    return false;
  }
  if (player.countsTowardCareerStats === false) {
    return false;
  }
  if (player.countsTowardCareerStats === true) {
    return true;
  }
  if (player.id && UNDERCOVER_BOT_ID_SET.has(player.id)) {
    return true;
  }
  if (normalizedName && UNDERCOVER_BOT_NAME_SET.has(normalizedName)) {
    return true;
  }
  return false;
}

export interface BotEmoteTriggerResult {
  taunt: LocalBotTauntMessage;
  delayMs: number;
}

const ACTION_CARD_VALUES: ReadonlySet<CardValue> = new Set([
  'draw2',
  'wild_draw4',
  'skip',
  'reverse',
]);

/**
 * Maps a card played by an AI seat to its situational emote event (`+2`, `+4`, `Skip`, `Reverse`).
 */
export function classifyBotPlayedCardEmoteEvent(cardValue: CardValue): BotEmoteEvent | null {
  return ACTION_CARD_VALUES.has(cardValue) ? 'bot_action_card' : null;
}

/**
 * Picks a fitting emoji from the situational event pool.
 */
export function pickBotEmoteForEvent(
  event: BotEmoteEvent,
  rng: () => number = Math.random
): string {
  const pool = BOT_EMOTE_POOLS[event];
  const clamped = Math.min(0.999999, Math.max(0, rng()));
  const index = Math.floor(clamped * pool.length);
  return pool[index];
}

/**
 * Computes a natural human-like reaction delay between 600ms and 1200ms.
 */
export function getBotEmoteDelayMs(rng: () => number = Math.random): number {
  const clamped = Math.min(0.999999, Math.max(0, rng()));
  return (
    BOT_EMOTE_DELAY_MIN_MS +
    Math.floor(clamped * (BOT_EMOTE_DELAY_MAX_MS - BOT_EMOTE_DELAY_MIN_MS + 1))
  );
}

/**
 * Evaluates anti-spam guardrails (AI-seat check, 15s per-bot cooldown, ~40% probability)
 * and builds a strictly local TauntMessage when triggered (zero Supabase DB writes).
 */
export function evaluateBotEmoteTrigger(
  input: BotEmoteTriggerInput
): BotEmoteTriggerResult | null {
  if (
    !input.botId ||
    !isUndercoverEmoteEligible({
      id: input.botId,
      name: input.botName,
      isBot: input.isAiSeat,
      countsTowardCareerStats: input.countsTowardCareerStats,
    })
  ) {
    return null;
  }

  const nowMs = input.nowMs ?? Date.now();
  const cooldownMs = input.cooldownMs ?? BOT_EMOTE_COOLDOWN_MS;
  const probability = input.probability ?? BOT_EMOTE_PROBABILITY;
  const rng = input.rng ?? Math.random;

  const lastEmoteAt = input.lastEmoteAtByBot[input.botId];
  if (typeof lastEmoteAt === 'number' && nowMs - lastEmoteAt < cooldownMs) {
    return null;
  }

  if (rng() >= probability) {
    return null;
  }

  const emoji = pickBotEmoteForEvent(input.event, rng);
  const delayMs = getBotEmoteDelayMs(rng);

  input.lastEmoteAtByBot[input.botId] = nowMs;

  return {
    taunt: {
      id: `bot_emote_${input.botId}_${nowMs}_${Math.floor(rng() * 10000)}`,
      emoji,
      senderId: input.botId,
      senderName: input.botName,
      senderAvatarId: input.botAvatarId,
      timestamp: nowMs,
    },
    delayMs,
  };
}
