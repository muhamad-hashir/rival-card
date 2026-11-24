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

export type BotEmotePersonaStyle = 'quiet' | 'friendly' | 'cheeky' | 'dramatic' | 'expressive';

export interface BotEmotePersona {
  style: BotEmotePersonaStyle;
  probability: number;
  cooldownMs: number;
  maxEmotesPerMatch: number;
}

export const BOT_EMOTE_PROBABILITY = 0.25;
export const BOT_EMOTE_COOLDOWN_MS = 26_000;
export const BOT_EMOTE_DELAY_MIN_MS = 900;
export const BOT_EMOTE_DELAY_MAX_MS = 2200;
export const MAX_BOT_EMOTES_PER_MATCH = 6;

export const EXPRESSIVE_PERSONA_BOT_IDS: ReadonlySet<string> = new Set([
  'qm_bot_bilal',
  'qm_bot_priya',
  'qm_bot_gojo',
]);

export const TAUNT_EMOJIS = [
  '😎', '😈', '😂', '😱',
  '😭', '😤', '🔥', '😉',
  '👀', '⏳', '👏', '🤝',
  '⚡', '👑', '🛡️', '👋',
  '😏', '😄', '🙌', '💀',
  '🤯', '👍', '🥳', '😅',
] as const;

export const BOT_EMOTE_POOLS: Readonly<Record<BotEmoteEvent, readonly string[]>> = {
  bot_action_card: ['😎', '😈', '😏', '🔥', '⚡', '😉'],
  bot_hit_draw: ['😱', '😭', '😤', '💀', '🤯', '😅'],
  bot_one_card: ['🔥', '😉', '👑', '⚡', '😎'],
  human_slow_turn: ['👀', '⏳', '😅', '👋'],
  match_end: ['👏', '🤝', '😄', '🙌', '👍', '🥳'],
} as const;

const PERSONA_CONFIGS: Readonly<Record<BotEmotePersonaStyle, BotEmotePersona>> = {
  quiet: {
    style: 'quiet',
    probability: 0.14,
    cooldownMs: 36_000,
    maxEmotesPerMatch: 2,
  },
  friendly: {
    style: 'friendly',
    probability: 0.24,
    cooldownMs: 28_000,
    maxEmotesPerMatch: 3,
  },
  cheeky: {
    style: 'cheeky',
    probability: 0.28,
    cooldownMs: 24_000,
    maxEmotesPerMatch: 3,
  },
  dramatic: {
    style: 'dramatic',
    probability: 0.32,
    cooldownMs: 22_000,
    maxEmotesPerMatch: 3,
  },
  expressive: {
    style: 'expressive',
    probability: 0.5,
    cooldownMs: 12_000,
    maxEmotesPerMatch: 6,
  },
};

const PERSONA_STYLES: readonly BotEmotePersonaStyle[] = [
  'quiet',
  'friendly',
  'cheeky',
  'dramatic',
] as const;

const PERSONA_PREFERRED_EMOJIS: Readonly<
  Record<BotEmotePersonaStyle, Readonly<Record<BotEmoteEvent, readonly string[]>>>
> = {
  quiet: {
    bot_action_card: ['😎', '⚡', '😉'],
    bot_hit_draw: ['😤', '😅', '😱'],
    bot_one_card: ['⚡', '🔥'],
    human_slow_turn: ['👀', '⏳'],
    match_end: ['🤝', '👍', '👏'],
  },
  friendly: {
    bot_action_card: ['😉', '😎', '🔥'],
    bot_hit_draw: ['😅', '😭', '😱'],
    bot_one_card: ['😉', '🔥', '👑'],
    human_slow_turn: ['👋', '😅', '👀'],
    match_end: ['👏', '🤝', '😄', '🙌', '🥳'],
  },
  cheeky: {
    bot_action_card: ['😏', '😈', '😎', '🔥'],
    bot_hit_draw: ['😤', '💀', '😱'],
    bot_one_card: ['👑', '😎', '🔥'],
    human_slow_turn: ['⏳', '👀'],
    match_end: ['🤝', '👏', '👍'],
  },
  dramatic: {
    bot_action_card: ['😈', '🔥', '⚡', '😎'],
    bot_hit_draw: ['💀', '🤯', '😭', '😱'],
    bot_one_card: ['🔥', '⚡', '👑'],
    human_slow_turn: ['👀', '⏳', '😅'],
    match_end: ['🙌', '🥳', '😄', '👏'],
  },
  expressive: {
    bot_action_card: ['😈', '😏', '🔥', '😎', '⚡'],
    bot_hit_draw: ['😱', '😭', '💀', '🤯', '😅'],
    bot_one_card: ['🔥', '👑', '😉', '⚡'],
    human_slow_turn: ['👀', '⏳', '👋', '😅'],
    match_end: ['🥳', '🙌', '👏', '😄', '🤝'],
  },
};

function hashBotId(botId: string): number {
  let hash = 0;
  for (let i = 0; i < botId.length; i++) {
    hash = (hash * 31 + botId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Returns a consistent, per-bot emote persona so different undercover bots do not share
 * identical reaction frequencies, cooldowns, or emoji habits.
 */
export function getBotEmotePersona(botId: string): BotEmotePersona {
  if (EXPRESSIVE_PERSONA_BOT_IDS.has(botId)) {
    return PERSONA_CONFIGS.expressive;
  }
  const hash = hashBotId(botId || 'default');
  const style = PERSONA_STYLES[hash % PERSONA_STYLES.length];
  return PERSONA_CONFIGS[style];
}

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
  emoteCountByBot?: Record<string, number>;
  lastEmojiByBot?: Record<string, string>;
  nowMs?: number;
  rng?: () => number;
  probability?: number;
  cooldownMs?: number;
  maxEmotesPerMatch?: number;
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
 * Picks a fitting emoji from the bot's persona-customized situational pool while avoiding
 * repeating the exact same emoji back-to-back.
 */
export function pickBotEmoteForEvent(
  event: BotEmoteEvent,
  rng: () => number = Math.random,
  options?: { botId?: string; lastEmoji?: string }
): string {
  const persona = options?.botId ? getBotEmotePersona(options.botId) : null;
  const basePool = persona
    ? PERSONA_PREFERRED_EMOJIS[persona.style][event]
    : BOT_EMOTE_POOLS[event];

  // Rotate starting subset deterministically by botId so two bots with the same persona
  // still favor different emojis first.
  const offset = options?.botId ? hashBotId(options.botId + ':' + event) % basePool.length : 0;
  const rotatedPool = [...basePool.slice(offset), ...basePool.slice(0, offset)];

  const filteredPool =
    options?.lastEmoji && rotatedPool.length > 1
      ? rotatedPool.filter((e) => e !== options.lastEmoji)
      : rotatedPool;

  const clamped = Math.min(0.999999, Math.max(0, rng()));
  const index = Math.floor(clamped * filteredPool.length);
  return filteredPool[index];
}

/**
 * Computes a natural human-like reaction delay between 900ms and 2200ms.
 */
export function getBotEmoteDelayMs(rng: () => number = Math.random): number {
  const clamped = Math.min(0.999999, Math.max(0, rng()));
  return (
    BOT_EMOTE_DELAY_MIN_MS +
    Math.floor(clamped * (BOT_EMOTE_DELAY_MAX_MS - BOT_EMOTE_DELAY_MIN_MS + 1))
  );
}

/**
 * Evaluates anti-spam guardrails (AI-seat check, per-bot persona cooldown & probability,
 * per-match max cap, and no back-to-back duplicate emoji) and builds a strictly local
 * TauntMessage when triggered (zero Supabase DB writes).
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

  const persona = getBotEmotePersona(input.botId);
  const nowMs = input.nowMs ?? Date.now();
  const cooldownMs = input.cooldownMs ?? persona.cooldownMs;
  const probability = input.probability ?? persona.probability;
  const maxEmotesPerMatch = input.maxEmotesPerMatch ?? persona.maxEmotesPerMatch;
  const rng = input.rng ?? Math.random;

  if (input.emoteCountByBot) {
    const usedCount = input.emoteCountByBot[input.botId] ?? 0;
    if (usedCount >= maxEmotesPerMatch) {
      return null;
    }
  }

  const lastEmoteAt = input.lastEmoteAtByBot[input.botId];
  if (typeof lastEmoteAt === 'number' && nowMs - lastEmoteAt < cooldownMs) {
    return null;
  }

  if (rng() >= probability) {
    return null;
  }

  const lastEmoji = input.lastEmojiByBot?.[input.botId];
  const emoji = pickBotEmoteForEvent(input.event, rng, {
    botId: input.botId,
    lastEmoji,
  });
  const delayMs = getBotEmoteDelayMs(rng);

  input.lastEmoteAtByBot[input.botId] = nowMs;
  if (input.emoteCountByBot) {
    input.emoteCountByBot[input.botId] = (input.emoteCountByBot[input.botId] ?? 0) + 1;
  }
  if (input.lastEmojiByBot) {
    input.lastEmojiByBot[input.botId] = emoji;
  }

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
