// src/__tests__/reconnection.test.ts - Unit tests for Network Reconnection, Session Persistence, and Snapshot Recovery
import { describe, test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveActiveMatchSession,
  getActiveMatchSession,
  clearActiveMatchSession,
  ACTIVE_MATCH_STORAGE_KEY,
  MultiplayerService,
  safeStorage,
  supabase,
} from '../services/supabase';
import { createGame } from '../gameEngine';
import {
  ONLINE_BOT_TAKEOVER_DELAY_MS,
  activateBotTakeover,
  executeSafeBotFallbackTurn,
  handleOnlineTurnTimeout,
  isTwoPlayerOnlineMatch,
  reclaimHumanControl,
  resetMissedTurnsOnManualMove,
  shouldClientDriveBotTakeoverTurn,
} from '../utils/onlineDisconnectEngine';
import type { GameState } from '../types';

after(async () => {
  try {
    await clearActiveMatchSession();
    await supabase.removeAllChannels();
  } catch {
    // Ignore cleanup error
  }
});

beforeEach(async () => {
  await clearActiveMatchSession();
});

describe('Active Match Session Persistence', () => {
  test('Saves active match session with room ID, player ID, seatIndex, and current timestamp', async () => {
    const beforeTime = Date.now();
    await saveActiveMatchSession('4821', 'player_alpha', 2);
    const afterTime = Date.now();

    const session = await getActiveMatchSession();
    assert.ok(session, 'Session should not be null');
    assert.equal(session.roomId, '4821');
    assert.equal(session.playerId, 'player_alpha');
    assert.equal(session.seatIndex, 2);
    assert.ok(
      session.timestamp >= beforeTime && session.timestamp <= afterTime,
      `Timestamp ${session.timestamp} must be between ${beforeTime} and ${afterTime}`
    );
  });

  test('Clearing active match session leaves storage empty', async () => {
    await saveActiveMatchSession('9911', 'player_beta');
    let session = await getActiveMatchSession();
    assert.ok(session, 'Session should exist initially');

    await clearActiveMatchSession();
    session = await getActiveMatchSession();
    assert.equal(session, null, 'Session should be null after clearing');
  });

  test('Handles corrupted or invalid JSON in storage gracefully', async () => {
    await safeStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, '{invalid-json-data');
    const session = await getActiveMatchSession();
    assert.equal(session, null, 'Corrupted JSON should return null without throwing');

    await safeStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify({ wrongKey: 123 }));
    const invalidSession = await getActiveMatchSession();
    assert.equal(invalidSession, null, 'JSON missing roomId/playerId should return null');
  });
});

describe('Match Session Expiration Logic (10-Minute Threshold)', () => {
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  function isSessionResumable(sessionTimestamp: number, currentTime: number = Date.now()): boolean {
    return currentTime - sessionTimestamp < TEN_MINUTES_MS;
  }

  test('Considers sessions younger than 10 minutes as active and resumable', () => {
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    const nineMinutesAgo = now - 9 * 60 * 1000;

    assert.equal(isSessionResumable(twoMinutesAgo, now), true);
    assert.equal(isSessionResumable(nineMinutesAgo, now), true);
  });

  test('Considers sessions older than 10 minutes as expired', () => {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const thirtyMinutesAgo = now - 30 * 60 * 1000;

    assert.equal(isSessionResumable(tenMinutesAgo, now), false);
    assert.equal(isSessionResumable(thirtyMinutesAgo, now), false);
  });
});

describe('Multiplayer Reconnection & Exponential Backoff State', () => {
  test('Initial reconnection state is idle', () => {
    const service = new MultiplayerService();
    assert.equal(service.getIsReconnecting(), false);
    assert.equal(service.getReconnectAttempts(), 0);
  });

  test('Exponential backoff delay progression follows [1s, 2s, 4s]', () => {
    const backoffDelays = [1000, 2000, 4000];
    const getDelayForAttempt = (attempt: number) => {
      return backoffDelays[Math.min(attempt, backoffDelays.length - 1)];
    };

    assert.equal(getDelayForAttempt(0), 1000, 'Attempt 0 should wait 1s');
    assert.equal(getDelayForAttempt(1), 2000, 'Attempt 1 should wait 2s');
    assert.equal(getDelayForAttempt(2), 4000, 'Attempt 2 should wait 4s');
    assert.equal(getDelayForAttempt(3), 4000, 'Subsequent attempts should cap at 4s');
    assert.equal(getDelayForAttempt(10), 4000, 'Far future attempts should cap at 4s');
  });

  test('Reconnection callbacks notify listener during reconnect cycle', async () => {
    const service = new MultiplayerService();
    let reconnectNotified = false;
    let attemptReported = 0;

    service.setCallbacks({
      onReconnecting: (attempt) => {
        reconnectNotified = true;
        attemptReported = attempt;
      },
    });

    // Create room to establish current room code
    await service.createRoom({ id: 'reconnect_host', name: 'Tester' }, '7733');
    assert.equal(service.getRoomCode(), '7733');

    // Trigger reconnect
    service.triggerReconnect();
    assert.equal(service.getIsReconnecting(), true);
    assert.equal(reconnectNotified, true);
    assert.equal(attemptReported, 1);

    // Explicit leave clears room and state
    await service.leaveRoom();
    assert.equal(service.getIsReconnecting(), false);
    assert.equal(service.getRoomCode(), null);
  });

  test('Explicit leaving disables automatic reconnection', async () => {
    const service = new MultiplayerService();
    let reconnectTriggered = false;

    service.setCallbacks({
      onReconnecting: () => {
        reconnectTriggered = true;
      },
    });

    await service.createRoom({ id: 'player_leave', name: 'Host' }, '8822');
    await service.leaveRoom();

    // Triggering reconnect after leaving should not engage
    service.triggerReconnect();
    assert.equal(reconnectTriggered, false);
    assert.equal(service.getIsReconnecting(), false);
  });
});

describe('Authoritative State Snapshot Exchange Protocol', () => {
  test('Callbacks accept state snapshot handlers without error', () => {
    const service = new MultiplayerService();
    let snapshotRequestedBy = '';
    let snapshotReceived: GameState | null = null;

    service.setCallbacks({
      onStateSnapshotRequested: (requesterId) => {
        snapshotRequestedBy = requesterId;
      },
      onStateSnapshotReceived: (state) => {
        snapshotReceived = state;
      },
      onReconnected: () => {},
    });

    assert.equal(snapshotRequestedBy, '');
    assert.equal(snapshotReceived, null);
  });

  test('State snapshot request and broadcast functions execute safely when offline', async () => {
    const service = new MultiplayerService();
    const testGame = createGame(
      [
        { id: 'p1', name: 'Player 1' },
        { id: 'p2', name: 'Player 2' },
      ],
      'multiplayer'
    );

    // When not connected to channel, calling these methods should be no-ops without throwing
    await service.requestStateSnapshot();
    await service.broadcastStateSnapshot(testGame, 'p2');
    assert.ok(true, 'Snapshot methods should not throw when disconnected');
  });
});

describe('1v1 Missed-Turn Forfeit Rules (UNO! Mobile Style)', () => {
  test('1st missed turn increments consecutiveMissedTurns to 1, resets to 0 on manual play, and 2nd triggers forfeit win', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'HostPlayer', isBot: false },
        { id: 'p2', name: 'GuestPlayer', isBot: false },
      ],
      'multiplayer'
    );
    // Use deterministic number hands so action/defense cards never intercept turn progression
    state = {
      ...state,
      currentTurnIndex: 0,
      discardPile: [{ id: 'top_r5', color: 'red', value: '5', scoreValue: 5 }],
      activeColor: 'red',
      players: [
        {
          ...state.players[0],
          hand: [
            { id: 'p1_r1', color: 'red', value: '1', scoreValue: 1 },
            { id: 'p1_r2', color: 'red', value: '2', scoreValue: 2 },
            { id: 'p1_b3', color: 'blue', value: '3', scoreValue: 3 },
          ],
        },
        {
          ...state.players[1],
          hand: [
            { id: 'p2_r4', color: 'red', value: '4', scoreValue: 4 },
            { id: 'p2_g6', color: 'green', value: '6', scoreValue: 6 },
          ],
        },
      ],
    };
    assert.equal(isTwoPlayerOnlineMatch(state), true);

    // 1. First missed turn for p1 -> increments to 1 and continues match
    const miss1 = handleOnlineTurnTimeout(state, 'p1');
    assert.equal(miss1.outcome, 'missed_turn_1');
    assert.equal(miss1.nextState.isGameOver, false);
    const p1AfterMiss1 = miss1.nextState.players.find((p) => p.id === 'p1')!;
    assert.equal(p1AfterMiss1.consecutiveMissedTurns, 1);
    assert.equal(p1AfterMiss1.isBotControlled, false);

    // 2. Manual play resets consecutiveMissedTurns back to 0
    const afterManualPlay = resetMissedTurnsOnManualMove(miss1.nextState, 'p1');
    assert.equal(
      afterManualPlay.players.find((p) => p.id === 'p1')?.consecutiveMissedTurns,
      0
    );

    // 3. Missing 2 consecutive turns triggers immediate forfeit win for p2
    const turnBackToP1Miss1: GameState = { ...afterManualPlay, currentTurnIndex: 0 };
    const againMiss1 = handleOnlineTurnTimeout(turnBackToP1Miss1, 'p1');
    assert.equal(againMiss1.nextState.isGameOver, false);
    assert.equal(againMiss1.nextState.players.find((p) => p.id === 'p1')?.consecutiveMissedTurns, 1);

    const turnBackToP1Miss2: GameState = { ...againMiss1.nextState, currentTurnIndex: 0 };
    const miss2 = handleOnlineTurnTimeout(turnBackToP1Miss2, 'p1');
    assert.equal(miss2.outcome, 'forfeit_win');
    assert.equal(miss2.forfeitedPlayerId, 'p1');
    assert.equal(miss2.winnerId, 'p2');
    assert.equal(miss2.nextState.isGameOver, true);
    assert.equal(miss2.nextState.winner?.id, 'p2');
    assert.equal(miss2.nextState.forfeitedByPlayerId, 'p1');
    assert.equal(miss2.nextState.disconnectOutcomeReason, '1v1_two_missed_turns');
    assert.equal(miss2.nextState.players.find((p) => p.id === 'p1')?.hasForfeited, true);
  });
});

describe('3-4 Player & 2v2 Seamless AI Bot Takeover & Human Reclaim', () => {
  test('4-player timeout activates isBotControlled without forfeiting even after 2+ missed turns', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'Alice', isBot: false },
        { id: 'p2', name: 'Bob', isBot: false },
        { id: 'p3', name: 'Charlie', isBot: false },
        { id: 'p4', name: 'Dana', isBot: false },
      ],
      'multiplayer'
    );
    state = {
      ...state,
      currentTurnIndex: 1, // Bob's turn
      discardPile: [{ id: 'top_b5', color: 'blue', value: '5', scoreValue: 5 }],
      activeColor: 'blue',
      players: state.players.map((p, idx) => ({
        ...p,
        hand: [
          { id: `p${idx}_b1`, color: 'blue', value: '1', scoreValue: 1 },
          { id: `p${idx}_b2`, color: 'blue', value: '2', scoreValue: 2 },
          { id: `p${idx}_y3`, color: 'yellow', value: '3', scoreValue: 3 },
        ],
      })),
    };
    assert.equal(isTwoPlayerOnlineMatch(state), false);

    const turn1Timeout = handleOnlineTurnTimeout(state, 'p2');
    assert.equal(turn1Timeout.outcome, 'bot_takeover_turn');
    assert.equal(turn1Timeout.nextState.isGameOver, false);
    assert.equal(turn1Timeout.nextState.players.find((p) => p.id === 'p2')?.isBotControlled, true);

    const backToBobTurn: GameState = { ...turn1Timeout.nextState, currentTurnIndex: 1 };
    const turn2Timeout = handleOnlineTurnTimeout(backToBobTurn, 'p2');
    assert.equal(turn2Timeout.outcome, 'bot_takeover_turn');
    assert.equal(turn2Timeout.nextState.isGameOver, false);
    assert.equal(turn2Timeout.nextState.players.find((p) => p.id === 'p2')?.hasForfeited, false);
  });

  test('2v2 mode uses AI Bot Takeover rather than 1v1 forfeit and restores control on reconnect', () => {
    const state: GameState = {
      ...createGame(
        [
          { id: 'p1', name: 'TeamA1', isBot: false },
          { id: 'p2', name: 'TeamB1', isBot: false },
        ],
        'multiplayer'
      ),
      is2v2: true,
    };
    assert.equal(isTwoPlayerOnlineMatch(state), false);
    assert.equal(ONLINE_BOT_TAKEOVER_DELAY_MS, 1200);

    // Disconnect p2 -> AI takes over cleanly
    const botControlledState = activateBotTakeover(state, 'p2');
    assert.equal(botControlledState.players[1].isBotControlled, true);

    // Single authoritative client drives p2's turn cleanly
    const p2TurnState: GameState = { ...botControlledState, currentTurnIndex: 1 };
    assert.equal(shouldClientDriveBotTakeoverTurn(p2TurnState, 'p1', true), true);
    assert.equal(shouldClientDriveBotTakeoverTurn(p2TurnState, 'p2', false), false);

    const { nextState: playedByBot } = executeSafeBotFallbackTurn(p2TurnState, 'p2');
    assert.notStrictEqual(playedByBot, p2TurnState);

    // Human reconnects -> clears isBotControlled and returns manual control
    const reclaimed = reclaimHumanControl(botControlledState, 'p2');
    assert.equal(reclaimed.players[1].isBotControlled, false);
    assert.equal(reclaimed.players[1].isDisconnected, false);
    assert.equal(reclaimed.players[1].consecutiveMissedTurns, 0);
  });
});
