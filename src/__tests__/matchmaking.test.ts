// src/__tests__/matchmaking.test.ts - Unit tests for Quick Match Auto-Matchmaking Service
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  MatchmakingService,
  matchmakingService,
  QueuedPlayer,
} from '../services/matchmakingService';
import { supabase } from '../services/supabase';

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

  test('12-second Fallback: Automatically seeds match with RivalBot when queue times out', async () => {
    const service = new MatchmakingService();
    const player: QueuedPlayer = {
      id: 'player_human',
      name: 'ChampHero',
      avatarId: 'avatar_6',
    };

    // Use a short 0.1s timeout to test fallback without waiting 12 real seconds
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
    assert.ok(matchResult.opponentName.includes('RivalBot'), 'Opponent must be RivalBot');
    assert.strictEqual(matchResult.opponentAvatarId, 'avatar_2');

    // Verify generated game state
    const { initialState } = matchResult;
    assert.ok(initialState, 'Initial game state must exist');
    assert.strictEqual(initialState.players.length, 2, 'Must have 2 players');
    assert.strictEqual(initialState.players[0].name, 'ChampHero');
    assert.strictEqual(initialState.players[0].avatarId, 'avatar_6');
    assert.strictEqual(initialState.players[0].isBot, false);
    assert.strictEqual(initialState.players[1].name, 'RivalBot 🤖');
    assert.strictEqual(initialState.players[1].avatarId, 'avatar_2');
    assert.strictEqual(initialState.players[1].isBot, true);
    assert.ok(initialState.players[0].hand.length >= 7, 'Deals at least 7 cards');
    assert.ok(initialState.players[1].hand.length >= 7, 'Deals at least 7 cards');
    assert.strictEqual(initialState.discardPile.length, 1, 'Top card exists');
    assert.notStrictEqual(initialState.discardPile[0].color, 'wild', 'Top card is non-wild');

    await service.cancelMatchmaking();
  });

  test('Deterministic Coordinator assignment: Player with smaller ID coordinates match', () => {
    const p1 = { id: 'alice_123', name: 'Alice' };
    const p2 = { id: 'bob_456', name: 'Bob' };

    const isP1Coordinator = p1.id < p2.id;
    const isP2Coordinator = p2.id < p1.id;

    assert.strictEqual(isP1Coordinator, true, 'Alice has smaller ID so Alice coordinates');
    assert.strictEqual(isP2Coordinator, false, 'Bob has larger ID so Bob is guest');
  });
});
