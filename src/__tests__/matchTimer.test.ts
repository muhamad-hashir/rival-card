// src/__tests__/matchTimer.test.ts - Unit tests for 3-minute match timer, sync & card-priority tie-breaker
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_DURATION_MS,
  MATCH_DURATION_SECONDS,
  computeRemainingMsFromStart,
  createGame,
  evaluatePlayerTimeoutHand,
  formatMatchTimer,
  getCardTimeoutPriorityTier,
  resolveMatchTimeout,
} from '../gameEngine';
import { stampOnlineMatchTimer } from '../services/multiplayerService';
import type { Card, Player } from '../types';

function makePlayer(id: string, name: string, hand: Card[]): Player {
  return {
    id,
    name,
    isBot: false,
    hand,
    isMuted: false,
    mutedRoundsRemaining: 0,
    hasDeclaredRival: false,
  };
}

describe('3-Minute Match Timer & Card-Priority Tie-Breaker', () => {
  test('createGame initializes 180-second match timer defaults', () => {
    const game = createGame([
      { id: 'p1', name: 'Alex', isBot: false },
      { id: 'bot1', name: 'RivalBot', isBot: true },
    ]);

    assert.equal(MATCH_DURATION_SECONDS, 180);
    assert.equal(MATCH_DURATION_MS, 180_000);
    assert.equal(game.matchDurationSeconds, 180);
    assert.equal(game.matchTimeRemainingMs, 180_000);
    assert.equal(game.endedByTimeout, false);
  });

  test('formatMatchTimer and computeRemainingMsFromStart format and clamp cleanly', () => {
    assert.equal(formatMatchTimer(180_000), '03:00');
    assert.equal(formatMatchTimer(165_000), '02:45');
    assert.equal(formatMatchTimer(30_000), '00:30');
    assert.equal(formatMatchTimer(9_100), '00:10');
    assert.equal(formatMatchTimer(0), '00:00');
    assert.equal(formatMatchTimer(-500), '00:00');

    const startMs = 1_000_000;
    assert.equal(computeRemainingMsFromStart(startMs, startMs - 1500), 180_000);
    assert.equal(computeRemainingMsFromStart(startMs, startMs + 45_000), 135_000);
    assert.equal(computeRemainingMsFromStart(startMs, startMs + 200_000), 0);

    const game = createGame(
      [
        { id: 'p1', name: 'Host', isBot: false },
        { id: 'p2', name: 'Guest', isBot: false },
      ],
      'multiplayer'
    );
    const stamped = stampOnlineMatchTimer(game, 50_000);
    assert.ok(stamped.matchStartedAt && stamped.matchStartedAt > 50_000);
    const preserved = stampOnlineMatchTimer(stamped, 90_000);
    assert.equal(preserved.matchStartedAt, stamped.matchStartedAt);
  });

  test('Primary rule: player with fewer cards wins at timeout regardless of card types', () => {
    const base = createGame(
      [
        { id: 'p1', name: 'NumberHolder', isBot: false },
        { id: 'p2', name: 'WildHolder', isBot: false },
      ],
      'pass_and_play'
    );

    base.players = [
      makePlayer('p1', 'NumberHolder', [
        { id: 'n1', color: 'red', value: '2', scoreValue: 2 },
      ]),
      makePlayer('p2', 'WildHolder', [
        { id: 's1', color: 'wild', value: 'shield', scoreValue: 50 },
        { id: 'w4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      ]),
    ];

    const ended = resolveMatchTimeout(base);
    assert.equal(ended.isGameOver, true);
    assert.equal(ended.endedByTimeout, true);
    assert.equal(ended.timeoutUsedTieBreaker, false);
    assert.equal(ended.winner?.id, 'p1');
    assert.equal(ended.matchTimeRemainingMs, 0);
    assert.equal(ended.privacyMask.isActive, false);
    assert.equal(ended.logs[ended.logs.length - 1].actionType, 'MATCH_TIMEOUT');
  });

  test('Tie-breaker favors Tier 1 specials & wilds (10 pts) over Tier 2 actions (5 pts) and Tier 3 numbers (1 pt)', () => {
    const tier1Values: Card['value'][] = [
      'rival_swap',
      'mute',
      'shield',
      'mirror',
      'wild_draw4',
      'wild',
    ];

    for (const val of tier1Values) {
      assert.deepEqual(
        getCardTimeoutPriorityTier({ id: `t_${val}`, color: 'wild', value: val, scoreValue: 50 }),
        { tier: 1, points: 10 },
        `${val} must be Tier 1 (10 pts)`
      );

      const game = createGame(
        [
          { id: 'p_num', name: 'NumPlayer', isBot: false },
          { id: 'p_act', name: 'ActPlayer', isBot: false },
          { id: 'p_spc', name: 'SpecialPlayer', isBot: false },
        ],
        'multiplayer'
      );

      game.players = [
        makePlayer('p_num', 'NumPlayer', [
          { id: 'c_num', color: 'blue', value: '9', scoreValue: 9 },
        ]),
        makePlayer('p_act', 'ActPlayer', [
          { id: 'c_act', color: 'green', value: 'skip', scoreValue: 20 },
        ]),
        makePlayer('p_spc', 'SpecialPlayer', [
          { id: 'c_spc', color: 'wild', value: val, scoreValue: 50 },
        ]),
      ];

      const ended = resolveMatchTimeout(game);
      assert.equal(ended.winner?.id, 'p_spc', `${val} must beat Action and Number cards on tie`);
      assert.equal(ended.timeoutUsedTieBreaker, true);
      assert.equal(ended.timeoutStandings?.[0].priorityScore, 10);
      assert.equal(ended.timeoutStandings?.[1].playerId, 'p_act');
      assert.equal(ended.timeoutStandings?.[2].playerId, 'p_num');
    }
  });

  test('Tie-breaker favors Tier 2 actions (Skip, Reverse, +2 = 5 pts) over Tier 3 numbers (1 pt)', () => {
    const tier2Values: Card['value'][] = ['skip', 'reverse', 'draw2'];

    for (const val of tier2Values) {
      assert.deepEqual(
        getCardTimeoutPriorityTier({ id: `t_${val}`, color: 'red', value: val, scoreValue: 20 }),
        { tier: 2, points: 5 },
        `${val} must be Tier 2 (5 pts)`
      );

      const game = createGame(
        [
          { id: 'p_num', name: 'NumPlayer', isBot: false },
          { id: 'p_act', name: 'ActionPlayer', isBot: false },
        ],
        'vs_bot'
      );

      game.players = [
        makePlayer('p_num', 'NumPlayer', [
          { id: 'c_9', color: 'yellow', value: '9', scoreValue: 9 },
          { id: 'c_8', color: 'red', value: '8', scoreValue: 8 },
        ]),
        makePlayer('p_act', 'ActionPlayer', [
          { id: 'c_a', color: 'blue', value: val, scoreValue: 20 },
          { id: 'c_1', color: 'green', value: '1', scoreValue: 1 },
        ]),
      ];

      const ended = resolveMatchTimeout(game);
      assert.equal(ended.winner?.id, 'p_act', `${val} + number (6 pts) must beat two numbers (2 pts)`);
      assert.equal(ended.timeoutUsedTieBreaker, true);
      assert.equal(evaluatePlayerTimeoutHand(game.players[1]).priorityScore, 6);
      assert.equal(evaluatePlayerTimeoutHand(game.players[0]).priorityScore, 2);
    }
  });

  test('resolveMatchTimeout clears pending states and is idempotent if game already ended', () => {
    const game = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
      ],
      'pass_and_play'
    );
    game.pendingColorChoice = true;
    game.pendingDefense = {
      attackerIndex: 0,
      targetIndex: 1,
      attackType: 'draw2',
      drawPenalty: 2,
      mirrorBounceCount: 0,
      expiresAt: Date.now() + 3000,
    };
    game.players = [
      makePlayer('p1', 'P1', [
        { id: 's1', color: 'wild', value: 'shield', scoreValue: 50 },
        { id: 'n1', color: 'red', value: '1', scoreValue: 1 },
      ]),
      makePlayer('p2', 'P2', [
        { id: 'a1', color: 'red', value: 'draw2', scoreValue: 20 },
        { id: 'a2', color: 'blue', value: 'reverse', scoreValue: 20 },
      ]),
    ];

    const firstEnd = resolveMatchTimeout(game);
    // 10 + 1 = 11 pts beats 5 + 5 = 10 pts
    assert.equal(firstEnd.winner?.id, 'p1');
    assert.equal(firstEnd.pendingColorChoice, false);
    assert.equal(firstEnd.pendingDefense, null);

    const secondEnd = resolveMatchTimeout(firstEnd);
    assert.equal(secondEnd, firstEnd);
  });
});
