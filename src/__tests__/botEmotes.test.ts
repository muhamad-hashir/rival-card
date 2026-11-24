// src/__tests__/botEmotes.test.ts - Unit tests for purely local situational AI bot emoji reactions
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_EMOTE_COOLDOWN_MS,
  BOT_EMOTE_DELAY_MAX_MS,
  BOT_EMOTE_DELAY_MIN_MS,
  BOT_EMOTE_POOLS,
  BOT_EMOTE_PROBABILITY,
  EXPRESSIVE_PERSONA_BOT_IDS,
  MAX_BOT_EMOTES_PER_MATCH,
  TAUNT_EMOJIS,
  classifyBotPlayedCardEmoteEvent,
  evaluateBotEmoteTrigger,
  getBotEmoteDelayMs,
  getBotEmotePersona,
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
      assert.ok(pool.length >= 4, `Pool for ${ev} should have varied emojis`);

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

  test('undercover bots have varied personas, distinct emoji picks, and non-spammy match caps', () => {
    const personas = new Set(
      UNDERCOVER_QUICK_MATCH_BOTS.map((b) => getBotEmotePersona(b.id).style)
    );
    assert.ok(
      personas.size >= 3,
      '20 undercover bots must span multiple distinct emote personalities'
    );

    // Distinct bots do not all pick the exact same emoji sequence
    const firstActionEmojis = new Set(
      UNDERCOVER_QUICK_MATCH_BOTS.map((b) =>
        pickBotEmoteForEvent('bot_action_card', () => 0, { botId: b.id })
      )
    );
    assert.ok(
      firstActionEmojis.size >= 3,
      'Different undercover bots must favor varied emojis rather than all using the same one'
    );

    // Anti-spam: bots cannot repeat the same emoji back-to-back or exceed per-match cap
    const cooldowns: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const lastEmoji: Record<string, string> = {};
    const persona = getBotEmotePersona('qm_bot_hamza');

    const emitted: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = evaluateBotEmoteTrigger({
        botId: 'qm_bot_hamza',
        botName: 'Hamza_OP',
        isAiSeat: true,
        event: 'bot_action_card',
        lastEmoteAtByBot: cooldowns,
        emoteCountByBot: counts,
        lastEmojiByBot: lastEmoji,
        nowMs: 100_000 + i * 60_000,
        rng: () => 0.01,
      });
      if (res) {
        emitted.push(res.taunt.emoji);
      }
    }

    assert.strictEqual(emitted.length, persona.maxEmotesPerMatch);
    assert.ok(emitted.length <= 3, 'Balanced undercover bot caps at 2-3 emotes per match');
    for (let i = 1; i < emitted.length; i++) {
      assert.notStrictEqual(
        emitted[i],
        emitted[i - 1],
        'Bot must not repeat the exact same emoji back-to-back'
      );
    }
  });

  test('2-3 specific undercover bots have an expressive chatty persona (45-55% chance, 10-14s cooldown, 5-6 cap)', () => {
    assert.ok(
      EXPRESSIVE_PERSONA_BOT_IDS.size >= 2 && EXPRESSIVE_PERSONA_BOT_IDS.size <= 3,
      'Must have 2-3 expressive undercover bots'
    );

    const expressiveBotId = Array.from(EXPRESSIVE_PERSONA_BOT_IDS)[0];
    const persona = getBotEmotePersona(expressiveBotId);
    assert.strictEqual(persona.style, 'expressive');
    assert.ok(persona.probability >= 0.45 && persona.probability <= 0.55);
    assert.ok(persona.cooldownMs >= 10_000 && persona.cooldownMs <= 14_000);
    assert.ok(persona.maxEmotesPerMatch >= 5 && persona.maxEmotesPerMatch <= MAX_BOT_EMOTES_PER_MATCH);

    const cooldowns: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const lastEmoji: Record<string, string> = {};
    const emitted: string[] = [];

    for (let i = 0; i < 10; i++) {
      const res = evaluateBotEmoteTrigger({
        botId: expressiveBotId,
        botName: 'Bilal_King',
        isAiSeat: true,
        event: 'bot_action_card',
        lastEmoteAtByBot: cooldowns,
        emoteCountByBot: counts,
        lastEmojiByBot: lastEmoji,
        nowMs: 100_000 + i * persona.cooldownMs,
        rng: () => 0.48, // Higher than balanced bots (~0.14-0.32) yet passes expressive ~0.50!
      });
      if (res) {
        emitted.push(res.taunt.emoji);
      }
    }

    assert.strictEqual(emitted.length, persona.maxEmotesPerMatch);
    for (let i = 1; i < emitted.length; i++) {
      assert.notStrictEqual(
        emitted[i],
        emitted[i - 1],
        'Expressive bot must still never repeat the exact same emoji back-to-back'
      );
    }
  });

  test('enforces conservative probability guardrail and never triggers for non-AI human seats', () => {
    const cooldowns: Record<string, number> = {};

    const humanRes = evaluateBotEmoteTrigger({
      botId: 'human_1',
      botName: 'Human',
      isAiSeat: false,
      event: 'bot_action_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 100_000,
      rng: () => 0.05,
    });
    assert.strictEqual(humanRes, null);

    assert.ok(BOT_EMOTE_PROBABILITY <= 0.3);

    const skipped = evaluateBotEmoteTrigger({
      botId: 'qm_bot_hamza',
      botName: 'Hamza_OP',
      isAiSeat: true,
      event: 'bot_action_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 100_000,
      rng: () => 0.5,
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
      rng: () => 0.05,
    });
    assert.ok(triggered);
    assert.ok((TAUNT_EMOJIS as readonly string[]).includes(triggered.taunt.emoji));
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

    assert.strictEqual(
      isUndercoverEmoteEligible({ id: 'bot1', name: 'RivalBot', isBot: true }),
      false
    );
    assert.strictEqual(
      isUndercoverEmoteEligible({ id: 'user_1', name: 'Hamza_OP', isBot: false }),
      false
    );
  });

  test('enforces per-bot persona cooldown while allowing distinct undercover bots to emote independently', () => {
    const cooldowns: Record<string, number> = {};
    const aaravPersona = getBotEmotePersona('qm_bot_aarav');
    assert.ok(BOT_EMOTE_COOLDOWN_MS >= 20_000);

    // Undercover Bot A emotes at t = 50,000ms
    const first = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'bot_hit_draw',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000,
      rng: () => 0.05,
    });
    assert.ok(first);

    // Undercover Bot A blocked before its cooldown expires
    const blocked = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'bot_one_card',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000 + aaravPersona.cooldownMs - 1000,
      rng: () => 0.05,
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
      rng: () => 0.05,
    });
    assert.ok(otherBot);
    assert.ok((TAUNT_EMOJIS as readonly string[]).includes(otherBot.taunt.emoji));

    // Undercover Bot A allowed again once cooldown elapsed
    const afterCooldown = evaluateBotEmoteTrigger({
      botId: 'qm_bot_aarav',
      botName: 'Aarav_OP',
      isAiSeat: true,
      countsTowardCareerStats: true,
      event: 'match_end',
      lastEmoteAtByBot: cooldowns,
      nowMs: 50_000 + aaravPersona.cooldownMs,
      rng: () => 0.05,
    });
    assert.ok(afterCooldown);
    assert.ok((TAUNT_EMOJIS as readonly string[]).includes(afterCooldown.taunt.emoji));
  });

  test('natural reaction delay stays within 900ms-2200ms', () => {
    assert.strictEqual(getBotEmoteDelayMs(() => 0), 900);
    assert.strictEqual(getBotEmoteDelayMs(() => 0.9999), 2200);
  });
});
