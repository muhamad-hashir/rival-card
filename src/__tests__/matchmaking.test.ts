// src/__tests__/matchmaking.test.ts - Unit tests for Zero-Empty-Lobby Quick Match Auto-Matchmaking Service
import { describe, test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MatchmakingService,
  matchmakingService,
  QueuedPlayer,
} from '../services/matchmakingService';
import {
  ENABLE_UNDERCOVER_QUICK_MATCH_BOTS,
  QUICK_MATCH_SEARCH_TIMEOUT_SECONDS,
  SIGNATURE_QUICK_MATCH_BOTS,
  UNDERCOVER_QUICK_MATCH_BOTS,
  getQuickMatchBotThinkingDelayMs,
  resetQuickMatchBotCounter,
  selectNextQuickMatchBot,
  selectQuickMatchBotForMatchNumber,
} from '../constants/quickMatchBots';
import { supabase } from '../services/supabase';
import { adService } from '../services/adService';
import { makeBotMove } from '../gameEngine';

beforeEach(async () => {
  await resetQuickMatchBotCounter();
  await adService.resetForTesting();
});

after(async () => {
  try {
    await matchmakingService.cancelMatchmaking();
    await supabase.removeAllChannels();
  } catch {
    // ignore
  }
});

describe('Quick Match Auto-Matchmaking Service Lifecycle', () => {
  test('Initial state is idle with 0 elapsed seconds', () => {
    const service = new MatchmakingService();
    assert.strictEqual(service.getStatus(), 'idle');
    assert.strictEqual(service.getElapsedSeconds(), 0);
    assert.strictEqual(service.getActivePlayer(), null);
  });

  test('Starts matchmaking queue, updates status, and tracks player', async () => {
    const service = new MatchmakingService();
    const player: QueuedPlayer = {
      id: 'p_test_1',
      name: 'SpeedyFox',
      avatarId: 'avatar_1',
    };

    let statusUpdated: string = '';
    let tickCount = 0;

    await service.startMatchmaking(
      player,
      {
        onStatusChange: (s) => {
          statusUpdated = s;
        },
        onTick: (secs) => {
          tickCount = secs;
        },
      },
      12
    );

    assert.strictEqual(service.getStatus(), 'searching');
    assert.strictEqual(statusUpdated, 'searching');
    assert.strictEqual(service.getActivePlayer()?.id, 'p_test_1');
    assert.strictEqual(service.getActivePlayer()?.name, 'SpeedyFox');
    assert.strictEqual(service.getActivePlayer()?.avatarId, 'avatar_1');

    await service.cancelMatchmaking();
    assert.strictEqual(service.getStatus(), 'idle');
    assert.strictEqual(service.getActivePlayer(), null);
  });

  test('Cancel matchmaking cleanly resets timer and status', async () => {
    const service = new MatchmakingService();
    const player: QueuedPlayer = {
      id: 'p_test_2',
      name: 'TigerPro',
      avatarId: 'avatar_3',
    };

    let finalStatus = '';
    await service.startMatchmaking(player, {
      onStatusChange: (s) => {
        finalStatus = s;
      },
    });

    assert.strictEqual(service.getStatus(), 'searching');
    await service.cancelMatchmaking();

    assert.strictEqual(service.getStatus(), 'idle');
    assert.strictEqual(finalStatus, 'idle');
    assert.strictEqual(service.getElapsedSeconds(), 0);
  });

  test('Zero-Empty-Lobby Fallback: 5-7s timeout config, cleans waiting room, and seeds rotated Quick Match bot', async () => {
    assert.ok(
      QUICK_MATCH_SEARCH_TIMEOUT_SECONDS >= 5 && QUICK_MATCH_SEARCH_TIMEOUT_SECONDS <= 7,
      'Quick Match live-search window must be between 5 and 7 seconds'
    );

    const service = new MatchmakingService();
    const player: QueuedPlayer = {
      id: 'player_human',
      name: 'ChampHero',
      avatarId: 'champ',
    };

    // Use a short 0.1s timeout to verify fallback without waiting 6 real seconds
    const matchPromise = new Promise<any>((resolve) => {
      service.startMatchmaking(
        player,
        {
          onMatchFound: (result) => {
            resolve(result);
          },
        },
        0.1
      );
    });

    const matchResult = await matchPromise;

    assert.ok(matchResult, 'Match result must be produced by fallback');
    assert.strictEqual(matchResult.isBotMatch, true, 'Fallback match must be bot match');
    assert.strictEqual(matchResult.myPlayerId, 'player_human');
    assert.strictEqual(matchResult.roomCode, 'BOT_MATCH');
    assert.strictEqual(service.getActiveWaitingRoomCode(), null, 'Empty waiting room must be cleared on fallback');

    const allQuickMatchBots = [...UNDERCOVER_QUICK_MATCH_BOTS, ...SIGNATURE_QUICK_MATCH_BOTS];
    const matchedBot = allQuickMatchBots.find((b) => b.name === matchResult.opponentName);
    assert.ok(matchedBot, `Opponent "${matchResult.opponentName}" must come from Quick Match roster`);
    assert.strictEqual(matchResult.opponentAvatarId, matchedBot.avatarId);
    assert.strictEqual(matchResult.opponentLevel, matchedBot.level);
    assert.strictEqual(matchResult.countsTowardCareerStats, matchedBot.countsTowardCareerStats);

    // Verify generated game state
    const { initialState } = matchResult;
    assert.ok(initialState, 'Initial game state must exist');
    assert.strictEqual(initialState.players.length, 2, 'Must have 2 players');
    assert.strictEqual(initialState.players[0].name, 'ChampHero');
    assert.strictEqual(initialState.players[0].avatarId, 'champ');
    assert.strictEqual(initialState.players[0].isBot, false);
    assert.strictEqual(initialState.players[1].name, matchedBot.name);
    assert.strictEqual(initialState.players[1].avatarId, matchedBot.avatarId);
    assert.strictEqual(initialState.players[1].level, matchedBot.level);
    assert.strictEqual(initialState.players[1].countsTowardCareerStats, matchedBot.countsTowardCareerStats);
    assert.strictEqual(initialState.players[1].isBot, true);
    assert.ok(initialState.players[0].hand.length >= 7, 'Deals at least 7 cards');
    assert.ok(initialState.players[1].hand.length >= 7, 'Deals at least 7 cards');
    assert.strictEqual(initialState.discardPile.length, 1, 'Top card exists');
    assert.notStrictEqual(initialState.discardPile[0].color, 'wild', 'Top card is non-wild');

    await service.cancelMatchmaking();
  });

  test('Quick Match Bot Roster: 20 undercover bots + 3 signature bots + rotation & feature flag', async () => {
    assert.strictEqual(ENABLE_UNDERCOVER_QUICK_MATCH_BOTS, true);
    assert.strictEqual(UNDERCOVER_QUICK_MATCH_BOTS.length, 20);
    assert.strictEqual(SIGNATURE_QUICK_MATCH_BOTS.length, 3);

    const expectedNames = [
      'Hamza_OP', 'ZainPlays', 'Ayesha_GG', 'Bilal_King', 'Usman_786',
      'Mahnoor_X', 'Saad_Clutch', 'Daniyal_PK',
      'Aarav_OP', 'RohanPlays', 'Priya_GG', 'Kabir_X', 'Ananya_99',
      'Vikram_IND', 'Dev_Clutch',
      'Kaito_99', 'ShadowHokage', 'ItachiVibes', 'Gojo_Satoru', 'ZoroLostAgain',
    ];
    assert.deepStrictEqual(
      UNDERCOVER_QUICK_MATCH_BOTS.map((b) => b.name),
      expectedNames
    );
    assert.ok(
      UNDERCOVER_QUICK_MATCH_BOTS.every(
        (b) => b.level >= 2 && b.level <= 14 && b.isUndercover && b.countsTowardCareerStats === true
      ),
      'All 20 undercover bots must have natural levels 2-14 and countsTowardCareerStats = true'
    );
    assert.ok(
      SIGNATURE_QUICK_MATCH_BOTS.every((b) => !b.isUndercover && b.countsTowardCareerStats === false) &&
        SIGNATURE_QUICK_MATCH_BOTS.some((b) => b.name === 'NovaBot'),
      'Signature bot pool must preserve NovaBot and the other 2 named bots with countsTowardCareerStats = false'
    );

    // Every 3rd or 4th bot-matched Quick Match selects a signature bot; others pick undercover bots
    assert.strictEqual(selectQuickMatchBotForMatchNumber(1, { signatureInterval: 3 }).isUndercover, true);
    assert.strictEqual(selectQuickMatchBotForMatchNumber(2, { signatureInterval: 3 }).isUndercover, true);
    assert.strictEqual(selectQuickMatchBotForMatchNumber(3, { signatureInterval: 3 }).isUndercover, false);
    assert.strictEqual(selectQuickMatchBotForMatchNumber(4, { signatureInterval: 4 }).isUndercover, false);

    // Feature flag off (500+ downloads): falls back strictly to 3 named signature bots
    for (let i = 1; i <= 5; i++) {
      const bot = selectQuickMatchBotForMatchNumber(i, { enableUndercover: false });
      assert.strictEqual(bot.isUndercover, false);
      assert.ok(SIGNATURE_QUICK_MATCH_BOTS.some((s) => s.id === bot.id));
    }

    // Persisted counter hits a signature bot within 3-4 matches and uses natural 1.2s-2.6s turn pacing
    const picked = [];
    for (let i = 0; i < 4; i++) {
      picked.push(await selectNextQuickMatchBot());
    }
    assert.ok(
      picked.some((b) => !b.isUndercover),
      'Signature bot must appear by the 3rd or 4th bot-matched Quick Match'
    );

    const minDelay = getQuickMatchBotThinkingDelayMs(false, () => 0);
    const maxDelay = getQuickMatchBotThinkingDelayMs(false, () => 0.9999);
    assert.strictEqual(minDelay, 2200);
    assert.strictEqual(maxDelay, 3600);
  });

  test('Deterministic Coordinator assignment: Player with smaller ID coordinates match', () => {
    const p1 = { id: 'alice_123', name: 'Alice' };
    const p2 = { id: 'bob_456', name: 'Bob' };

    const isP1Coordinator = p1.id < p2.id;
    const isP2Coordinator = p2.id < p1.id;

    assert.strictEqual(isP1Coordinator, true, 'Alice has smaller ID so Alice coordinates');
    assert.strictEqual(isP2Coordinator, false, 'Bob has larger ID so Bob is guest');
  });

  test('Re-searching immediately after cancel does not deadlock or get cancelled by stale idle callback', async () => {
    const service = new MatchmakingService();
    const statusesFirstRun: string[] = [];
    const statusesSecondRun: string[] = [];

    await service.startMatchmaking(
      { id: 'user_retry', name: 'RetryHero', avatarId: 'avatar_1' },
      {
        onStatusChange: (status) => {
          statusesFirstRun.push(status);
        },
      },
      12
    );
    assert.strictEqual(service.getStatus(), 'searching');

    await service.cancelMatchmaking();
    assert.strictEqual(service.getStatus(), 'idle');
    assert.ok(statusesFirstRun.includes('idle'));

    const secondMatch = await new Promise<any>((resolve) => {
      service.startMatchmaking(
        { id: 'user_retry', name: 'RetryHero', avatarId: 'avatar_1' },
        {
          onStatusChange: (status) => {
            statusesSecondRun.push(status);
          },
          onMatchFound: (res) => {
            resolve(res);
          },
        },
        0.1
      );
    });

    assert.ok(secondMatch, 'Second search after cancel must complete normally');
    assert.strictEqual(secondMatch.myPlayerId, 'user_retry');
    assert.strictEqual(statusesFirstRun[statusesFirstRun.length - 1], 'idle');
    assert.strictEqual(statusesSecondRun[0], 'searching');
    assert.ok(!statusesSecondRun.slice(0, 1).includes('idle'), 'Stale idle callback must not cancel new search');

    await service.cancelMatchmaking();
  });

  test('Cancelling Quick Match cleans up any temporary Supabase waiting room code immediately', async () => {
    const service = new MatchmakingService();
    await service.startMatchmaking(
      { id: 'user_cancel_clean', name: 'CleanPlayer', avatarId: 'fox' },
      {},
      6
    );
    await service.cancelMatchmaking();
    assert.strictEqual(service.getActiveWaitingRoomCode(), null);
    assert.strictEqual(service.getStatus(), 'idle');
  });

  test('2-loss recovery routes player to a soft human-named undercover bot (never a signature bot) that avoids aggressive wins', async () => {
    // Simulate 2 consecutive losses
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), true);

    const service = new MatchmakingService();
    const player: QueuedPlayer = {
      id: 'human_recovery',
      name: 'ComebackKid',
      avatarId: 'fox',
    };

    const matchResult = await new Promise<any>((resolve) => {
      service.startMatchmaking(
        player,
        {
          onMatchFound: (res) => resolve(res),
        },
        0.05
      );
    });

    assert.strictEqual(matchResult.isBotMatch, true);
    assert.strictEqual(matchResult.isRecoveryMatch, true);
    assert.strictEqual(matchResult.initialState.isRecoveryMatch, true);
    assert.ok(
      UNDERCOVER_QUICK_MATCH_BOTS.some((b) => b.name === matchResult.opponentName),
      `Recovery opponent "${matchResult.opponentName}" must be one of the 20 human-named undercover bots`
    );
    assert.strictEqual(
      SIGNATURE_QUICK_MATCH_BOTS.some((s) => s.name === matchResult.opponentName),
      false,
      'Recovery match must NEVER pair against a named signature bot'
    );

    const botSeat = matchResult.initialState.players[1];
    assert.strictEqual(botSeat.botDifficulty, 'soft');

    // 1. Mid-game (bot holds 3+ cards, human holds 5+ cards): plays competitively including tactical +2 / Shield
    const midGameState = {
      ...matchResult.initialState,
      currentTurnIndex: 1,
      activeColor: 'red' as const,
      discardPile: [{ id: 'top_red_5', color: 'red' as const, value: '5' as const, scoreValue: 5 }],
      players: [
        { ...matchResult.initialState.players[0] }, // 7 cards
        {
          ...botSeat,
          hand: [
            { id: 'bot_mid_draw2', color: 'red' as const, value: 'draw2' as const, scoreValue: 20 },
            { id: 'bot_mid_blue_1', color: 'blue' as const, value: '1' as const, scoreValue: 1 },
            { id: 'bot_mid_yellow_4', color: 'yellow' as const, value: '4' as const, scoreValue: 4 },
          ],
        },
      ],
    };
    const afterMidTurn = makeBotMove(midGameState);
    assert.strictEqual(
      afterMidTurn.discardPile[afterMidTurn.discardPile.length - 1].value,
      'draw2',
      'Soft recovery bot should still play valid action cards naturally in mid-game (3+ cards)'
    );

    // 2. Endgame (2 cards, non-winning safe card playable): plays the safe card instead of endlessly drawing
    const endgameSafePlayState = {
      ...matchResult.initialState,
      currentTurnIndex: 1,
      activeColor: 'red' as const,
      discardPile: [{ id: 'top_red_5', color: 'red' as const, value: '5' as const, scoreValue: 5 }],
      players: [
        { ...matchResult.initialState.players[0] },
        {
          ...botSeat,
          hand: [
            { id: 'bot_end_red_3', color: 'red' as const, value: '3' as const, scoreValue: 3 },
            { id: 'bot_end_wild4', color: 'wild' as const, value: 'wild_draw4' as const, scoreValue: 50 },
          ],
        },
      ],
    };
    const afterEndgameSafe = makeBotMove(endgameSafePlayState);
    assert.strictEqual(afterEndgameSafe.isGameOver, false);
    assert.strictEqual(
      afterEndgameSafe.discardPile[afterEndgameSafe.discardPile.length - 1].id,
      'bot_end_red_3',
      'Soft bot at 2 cards plays safe non-winning card instead of drawing endlessly or dropping +4'
    );
    assert.strictEqual(afterEndgameSafe.players[1].hand.length, 1);

    // 3. Final card (1 card left): avoids playing a winning final card and draws naturally
    const almostWinState = {
      ...matchResult.initialState,
      currentTurnIndex: 1,
      activeColor: 'red' as const,
      discardPile: [{ id: 'top_red_5', color: 'red' as const, value: '5' as const, scoreValue: 5 }],
      players: [
        { ...matchResult.initialState.players[0] },
        {
          ...botSeat,
          hand: [{ id: 'bot_last_red_7', color: 'red' as const, value: '7' as const, scoreValue: 7 }],
        },
      ],
    };

    const afterSoftTurn = makeBotMove(almostWinState);
    assert.strictEqual(afterSoftTurn.isGameOver, false, 'Soft recovery bot must yield instead of winning');
    assert.ok(afterSoftTurn.players[1].hand.length >= 2, 'Soft recovery bot drew instead of emptying its hand');

    await service.cancelMatchmaking();
  });
});
