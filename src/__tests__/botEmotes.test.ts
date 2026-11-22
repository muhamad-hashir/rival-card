// src/__tests__/botEmotes.test.ts - Unit tests for purely local situational AI bot emoji reactions
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_EMOTE_COOLDOWN_MS,
  BOT_EMOTE_DELAY_MAX_MS,
  BOT_EMOTE_DELAY_MIN_MS,
  BOT_EMOTE_POOLS,
  BOT_EMOTE_PROBABILITY,
  TAUNT_EMOJIS,
  classifyBotPlayedCardEmoteEvent,
  evaluateBotEmoteTrigger,
  getBotEmoteDelayMs,
  isUndercoverEmoteEligible,
  pickBotEmoteForEvent,
} from '../utils/botEmotes';
import {
  SIGNATURE_QUICK_MATCH_BOTS,
  UNDERCOVER_QUICK_MATCH_BOTS,
} from '../constants/quickMatchBots';

describe('Bot Situational Emoji Reactions Engine', () => {
  test('maps action cards (+2, +4, Skip, Reverse) and excludes normal number cards', () => {
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('draw2'), 'bot_action_card');
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('wild_draw4'), 'bot_action_card');
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('skip'), 'bot_action_card');
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('reverse'), 'bot_action_card');

    assert.strictEqual(classifyBotPlayedCardEmoteEvent('5'), null);
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('wild'), null);
    assert.strictEqual(classifyBotPlayedCardEmoteEvent('shield'), null);
  });

  test('picks valid situational emojis matching each event and all exist in TauntBar tray', () => {
    const events = [
      'bot_action_card',
      'bot_hit_draw',
      'bot_one_card',
      'human_slow_turn',
      'match_end',
    ] as const;

    for (const ev of events) {
      const pool = BOT_EMOTE_POOLS[ev];
      assert.ok(pool.length >= 2, `Pool for ${ev} should have varied emojis`);

      const first = pickBotEmoteForEvent(ev, () => 0);
      const last = pickBotEmoteForEvent(ev, () => 0.9999);
      assert.ok(pool.includes(first));
      assert.ok(pool.includes(last));

      for (const emoji of pool) {
        assert.ok(
          (TAUNT_EMOJIS as readonly string[]).includes(emoji),
          `TauntBar TAUNT_EMOJIS must include bot emoji "${emoji}" for ${ev}`
        );
      }
    }
  });

  test('enforces ~40% probability guardrail and never triggers for non-AI human seats', () => {
    const cooldowns: Record<string, number> = {};

    // Non-AI human seat is never auto-emoted
    const humanRes = evaluateBotEmoteTrigger({
      botId: 'human_1',
      botName: 'Human',
      isAiSeat: false,
      event: 'bot_action_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 100_000,
      rng: () => 0.1,
    });
    assert.strictEqual(humanRes, null);

    // Probability check: rng() < 0.4 triggers, rng() >= 0.4 skips
    assert.strictEqual(BOT_EMOTE_PROBABILITY, 0.4);

    const skipped = evaluateBotEmoteTrigger({
      botId: 'qm_bot_hamza',
      botName: 'Hamza_OP',
      isAiSeat: true,
      event: 'bot_action_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 100_000,
      rng: () => 0.45,
    });
    assert.strictEqual(skipped, null);

    const triggered = evaluateBotEmoteTrigger({
      botId: 'qm_bot_hamza',
      botName: 'Hamza_OP',
      botAvatarId: 'tiger',
      isAiSeat: true,
      event: 'bot_action_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 100_000,
      rng: () => 0.2,
    });
    assert.ok(triggered);
    assert.ok(BOT_EMOTE_POOLS.bot_action_card.includes(triggered.taunt.emoji));
    assert.strictEqual(triggered.taunt.senderId, 'qm_bot_hamza');
    assert.strictEqual(triggered.taunt.senderName, 'Hamza_OP');
    assert.ok(
      triggered.delayMs >= BOT_EMOTE_DELAY_MIN_MS &&
        triggered.delayMs <= BOT_EMOTE_DELAY_MAX_MS
    );
  });

  test('allows ONLY the 20 undercover Quick Match bots and blocks all 3 signature bots and Solo bots', () => {
    for (const uBot of UNDERCOVER_QUICK_MATCH_BOTS) {
      assert.strictEqual(
        isUndercoverEmoteEligible({
          id: uBot.id,
          name: uBot.name,
          isBot: true,
          countsTowardCareerStats: uBot.countsTowardCareerStats,
        }),
        true,
        `${uBot.name} must be eligible for situational bot emojis`
      );
    }

    for (const sBot of SIGNATURE_QUICK_MATCH_BOTS) {
      assert.strictEqual(
        isUndercoverEmoteEligible({
          id: sBot.id,
          name: sBot.name,
          isBot: true,
          countsTowardCareerStats: sBot.countsTowardCareerStats,
        }),
        false,
        `${sBot.name} must NEVER trigger emojis`
      );

      const sigResult = evaluateBotEmoteTrigger({
        botId: sBot.id,
        botName: sBot.name,
        isAiSeat: true,
        countsTowardCareerStats: false,
        event: 'bot_action_card',
        lastEmoteAtByBot: {},
        nowMs: 100_000,
        rng: () => 0.05,
      });
      assert.strictEqual(sigResult, null, `${sBot.name} evaluateBotEmoteTrigger must always return null`);
    }

    // Also block Solo RivalBot and humans
    assert.strictEqual(
      isUndercoverEmoteEligible({ id: 'bot1', name: 'RivalBot', isBot: true }),
      false
    );
    assert.strictEqual(
      isUndercoverEmoteEligible({ id: 'user_1', name: 'Hamza_OP', isBot: false }),
      false
    );
  });

  test('enforces per-bot 15-second cooldown while allowing distinct undercover bots to emote independently', () => {
    const cooldowns: Record<string, number> = {};

    // Undercover Bot A emotes at t = 50,000ms
    const first = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'bot_hit_draw',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000,
      rng: () => 0.1,
    });
    assert.ok(first);

    // Undercover Bot A blocked at +10s (< 15s cooldown)
    const blocked = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'bot_one_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000 + 10_000,
      rng: () => 0.1,
    });
    assert.strictEqual(blocked, null);

    // Distinct Undercover Bot B is NOT blocked by Bot A's cooldown
    const otherBot = evaluateBotEmoteTrigger({
      botId: 'qm_bot_kaito',
      botName: 'Kaito_99',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'human_slow_turn',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000 + 2_000,
      rng: () => 0.1,
    });
    assert.ok(otherBot);
    assert.ok(BOT_EMOTE_POOLS.human_slow_turn.includes(otherBot.taunt.emoji));

    // Undercover Bot A allowed again once >= 15s elapsed
    const afterCooldown = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'match_end',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000 + BOT_EMOTE_COOLDOWN_MS,
      rng: () => 0.1,
    });
    assert.ok(afterCooldown);
    assert.ok(BOT_EMOTE_POOLS.match_end.includes(afterCooldown.taunt.emoji));
  });

  test('natural reaction delay stays within 600ms-1200ms', () => {
    assert.strictEqual(getBotEmoteDelayMs(() => 0), 600);
    assert.strictEqual(getBotEmoteDelayMs(() => 0.9999), 1200);
  });
});
