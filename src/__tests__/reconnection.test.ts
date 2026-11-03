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
  test('Saves active match session with room ID, player ID, and current timestamp', async () => {
    const beforeTime = Date.now();
    await saveActiveMatchSession('4821', 'player_alpha');
    const afterTime = Date.now();

    const session = await getActiveMatchSession();
    assert.ok(session, 'Session should not be null');
    assert.equal(session.roomId, '4821');
    assert.equal(session.playerId, 'player_alpha');
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
