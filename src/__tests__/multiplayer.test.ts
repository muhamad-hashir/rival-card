// src/__tests__/multiplayer.test.ts - Unit tests for Supabase client, room codes, and multiplayer service
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRoomCode,
  MultiplayerService,
  supabase,
} from '../services/supabase';
import { createGame } from '../gameEngine';

after(async () => {
  try {
    await supabase.removeAllChannels();
  } catch {
    // Ignore cleanup error
  }
});

describe('Supabase Client Configuration', () => {
  test('Initializes Supabase client instance with realtime and auth configuration', () => {
    assert.ok(supabase, 'Supabase client must be defined');
    assert.equal(typeof supabase.channel, 'function', 'Supabase channel function must exist');
    assert.ok(supabase.auth, 'Supabase auth must be initialized');
  });
});

describe('4-Digit Room Code Generation', () => {
  test('Generates a valid 4-digit numeric string between 1000 and 9999', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      assert.equal(typeof code, 'string');
      assert.equal(code.length, 4, `Code "${code}" must be exactly 4 digits long`);
      const num = parseInt(code, 10);
      assert.ok(num >= 1000 && num <= 9999, `Code ${num} must be in [1000, 9999]`);
      assert.match(code, /^\d{4}$/, 'Code must consist of 4 numeric digits');
    }
  });

  test('Generates non-static randomized codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode());
    }
    // In 20 random numbers in range [1000, 9999], we should have at least 15 unique values
    assert.ok(codes.size >= 15, `Expected high entropy, got ${codes.size} unique codes`);
  });
});

describe('MultiplayerService Lifecycle & Validation', () => {
  test('Initial state is disconnected with no room', () => {
    const service = new MultiplayerService();
    assert.equal(service.getConnectionStatus(), 'disconnected');
    assert.equal(service.getRoomCode(), null);
    assert.equal(service.getMyPlayer(), null);
    assert.deepEqual(service.getRoomPlayers(), []);
  });

  test('Host room creation sets room code, player as host, and status to connecting', async () => {
    const service = new MultiplayerService();
    const roomCode = await service.createRoom(
      { id: 'player_host', name: 'Alice' },
      '4321'
    );

    assert.equal(roomCode, '4321');
    assert.equal(service.getRoomCode(), '4321');
    assert.equal(service.getMyPlayer()?.id, 'player_host');
    assert.equal(service.getMyPlayer()?.name, 'Alice');
    assert.equal(service.getMyPlayer()?.isHost, true);
    assert.equal(service.getRoomPlayers().length, 1);
    assert.equal(service.getConnectionStatus(), 'connecting');

    await service.leaveRoom();
    assert.equal(service.getRoomCode(), null);
    assert.equal(service.getConnectionStatus(), 'disconnected');
  });

  test('Rejects non-4-digit room codes when joining', async () => {
    const service = new MultiplayerService();
    let errorReceived = '';
    service.setCallbacks({
      onError: (err) => {
        errorReceived = err;
      },
    });

    const resultShort = await service.joinRoom('12', { id: 'p2', name: 'Bob' });
    assert.equal(resultShort, false);
    assert.ok(errorReceived.includes('4-digit'), 'Should report 4-digit code error');

    const resultAlpha = await service.joinRoom('ABCD', { id: 'p2', name: 'Bob' });
    assert.equal(resultAlpha, false);

    const resultLong = await service.joinRoom('12345', { id: 'p2', name: 'Bob' });
    assert.equal(resultLong, false);
  });

  test('Accepts valid 4-digit room code and sets guest player', async () => {
    const service = new MultiplayerService();
    const success = await service.joinRoom('8842', { id: 'guest_1', name: 'Charlie' });

    assert.equal(success, true);
    assert.equal(service.getRoomCode(), '8842');
    assert.equal(service.getMyPlayer()?.id, 'guest_1');
    assert.equal(service.getMyPlayer()?.isHost, false);
    assert.equal(service.getConnectionStatus(), 'connecting');

    await service.leaveRoom();
    assert.equal(service.getRoomCode(), null);
  });

  test('Multiplayer callbacks registration and dispatch', () => {
    const service = new MultiplayerService();
    let statusDispatched = '';

    service.setCallbacks({
      onConnectionChange: (st) => {
        statusDispatched = st;
      },
    });

    // When leaving room, onConnectionChange should trigger with disconnected
    service.leaveRoom();
    assert.equal(statusDispatched, 'disconnected');
  });
});

describe('Multiplayer Game State Engine Compatibility', () => {
  test('Creates multiplayer game without privacy masking', () => {
    const game = createGame(
      [
        { id: 'p1', name: 'Host Player' },
        { id: 'p2', name: 'Guest Player' },
      ],
      'multiplayer'
    );

    assert.equal(game.gameMode, 'multiplayer');
    assert.equal(game.players.length, 2);
    assert.equal(game.players[0].hand.length >= 7, true);
    assert.equal(game.players[1].hand.length >= 7, true);
    // In multiplayer mode, privacy mask should NOT be active
    assert.equal(game.privacyMask.isActive, false);
    assert.equal(game.isGameOver, false);
    assert.equal(game.winner, null);
    assert.ok(game.activeColor, 'Must have an active color');
    assert.ok(game.discardPile.length >= 1, 'Must have top discard card');
  });
});
