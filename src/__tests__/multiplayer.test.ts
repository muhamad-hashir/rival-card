// src/__tests__/multiplayer.test.ts - Unit tests for Private Room capacity & user-ID-locked player perspective
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ROOM_PLAYERS,
  MAX_ROOM_PLAYERS,
  addPlayerToRoom,
  resolveOnlinePerspectivePlayer,
  isOnlineLocalPlayerTurn,
  RoomPlayer,
} from '../services/multiplayerService';
import { createGame, playCard } from '../gameEngine';

describe('Multiplayer Private Room Capacity & Perspective Sync', () => {
  test('Private room supports 2 to 4 players and rejects 5th player', () => {
    assert.strictEqual(MIN_ROOM_PLAYERS, 2);
    assert.strictEqual(MAX_ROOM_PLAYERS, 4);

    let room: RoomPlayer[] = [
      { id: 'host_1', name: 'Host', avatarId: 'avatar_1', isHost: true, joinedAt: 1 },
    ];

    const p2 = addPlayerToRoom(room, {
      id: 'friend_2',
      name: 'Friend 2',
      avatarId: 'avatar_2',
      isHost: false,
      joinedAt: 2,
    });
    assert.strictEqual(p2.accepted, true);
    assert.strictEqual(p2.players.length, 2);
    room = p2.players;

    const p3 = addPlayerToRoom(room, {
      id: 'friend_3',
      name: 'Friend 3',
      avatarId: 'avatar_3',
      isHost: false,
      joinedAt: 3,
    });
    assert.strictEqual(p3.accepted, true);
    assert.strictEqual(p3.players.length, 3);
    room = p3.players;

    const p4 = addPlayerToRoom(room, {
      id: 'friend_4',
      name: 'Friend 4',
      avatarId: 'avatar_4',
      isHost: false,
      joinedAt: 4,
    });
    assert.strictEqual(p4.accepted, true);
    assert.strictEqual(p4.players.length, 4);
    room = p4.players;

    // 5th player must be rejected
    const p5 = addPlayerToRoom(room, {
      id: 'friend_5',
      name: 'Extra',
      avatarId: 'avatar_5',
      isHost: false,
      joinedAt: 5,
    });
    assert.strictEqual(p5.accepted, false);
    assert.strictEqual(p5.players.length, 4);

    // Re-joining existing player ID updates info cleanly without exceeding 4
    const p2Reconnect = addPlayerToRoom(room, {
      id: 'friend_2',
      name: 'Friend 2 Updated',
      avatarId: 'avatar_2',
      isHost: false,
      joinedAt: 6,
    });
    assert.strictEqual(p2Reconnect.accepted, true);
    assert.strictEqual(p2Reconnect.players.length, 4);
    assert.strictEqual(p2Reconnect.players[1].name, 'Friend 2 Updated');
  });

  test('Client hand perspective remains strictly locked to authenticated user ID across turns in 4-player room', () => {
    let state = createGame(
      [
        { id: 'user_a', name: 'Alice', isBot: false },
        { id: 'user_b', name: 'Bob', isBot: false },
        { id: 'user_c', name: 'Charlie', isBot: false },
        { id: 'user_d', name: 'Dana', isBot: false },
      ],
      'multiplayer'
    );

    // Prepare legal card on user_a's hand to advance turn to user_b
    state.discardPile = [{ id: 'top_0', color: 'red', value: '5', scoreValue: 5 }];
    state.activeColor = 'red';
    state.players[0].hand = [
      { id: 'a_play', color: 'red', value: '8', scoreValue: 8 },
      { id: 'a_keep', color: 'blue', value: '1', scoreValue: 1 },
    ];
    state.players[1].hand = [{ id: 'b_secret', color: 'green', value: '9', scoreValue: 9 }];

    // Initially it is user_a's turn
    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'user_a'), true);
    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'user_b'), false);
    assert.strictEqual(resolveOnlinePerspectivePlayer(state.players, 'user_b').id, 'user_b');

    // user_a plays a card -> turn advances to user_b
    state = playCard(state, 'user_a', 'a_play');
    assert.strictEqual(state.currentTurnIndex, 1);

    // Both clients' perspectives MUST remain locked to their own user IDs!
    const alicePerspective = resolveOnlinePerspectivePlayer(state.players, 'user_a');
    const bobPerspective = resolveOnlinePerspectivePlayer(state.players, 'user_b');
    const charliePerspective = resolveOnlinePerspectivePlayer(state.players, 'user_c');

    assert.strictEqual(alicePerspective.id, 'user_a', 'Alice perspective must never switch to Bob on Bob turn');
    assert.strictEqual(alicePerspective.hand[0].id, 'a_keep');
    assert.strictEqual(bobPerspective.id, 'user_b');
    assert.strictEqual(charliePerspective.id, 'user_c');

    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'user_a'), false);
    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'user_b'), true);
    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'user_c'), false);
  });

  test('End-to-end 4-player private room flow: clockwise, Reverse, Skip, Draw2, and Wild Draw 4 targeting', () => {
    const configs = [
      { id: 'u1', name: 'Host', isBot: false },
      { id: 'u2', name: 'Friend2', isBot: false },
      { id: 'u3', name: 'Friend3', isBot: false },
      { id: 'u4', name: 'Friend4', isBot: false },
    ];
    let state = createGame(configs, 'multiplayer');

    // Confirm all 4 slots are human-only
    assert.strictEqual(state.players.length, 4);
    assert.ok(state.players.every((p) => p.isBot === false));

    // Seed controlled hands + top card for deterministic 4P rotation check
    state.discardPile = [{ id: 'start_5', color: 'red', value: '5', scoreValue: 5 }];
    state.activeColor = 'red';
    state.currentTurnIndex = 0;
    state.direction = 1;

    state.players[0].hand = [
      { id: 'u1_num', color: 'red', value: '7', scoreValue: 7 },
      { id: 'u1_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'u1_keep', color: 'blue', value: '2', scoreValue: 2 },
    ];
    state.players[1].hand = [
      { id: 'u2_num', color: 'red', value: '8', scoreValue: 8 },
      { id: 'u2_keep', color: 'green', value: '4', scoreValue: 4 },
    ];
    state.players[2].hand = [
      { id: 'u3_skip', color: 'red', value: 'skip', scoreValue: 20 },
      { id: 'u3_keep', color: 'yellow', value: '1', scoreValue: 1 },
    ];
    state.players[3].hand = [
      { id: 'u4_rev', color: 'red', value: 'reverse', scoreValue: 20 },
      { id: 'u4_d2', color: 'blue', value: 'draw2', scoreValue: 20 },
      { id: 'u4_keep', color: 'yellow', value: '9', scoreValue: 9 },
    ];

    // Non-active player submitting move must throw
    assert.throws(() => playCard(state, 'u2', 'u2_num'), /not u2's turn/);

    // 1. u1 plays number -> u2 (0 -> 1)
    state = playCard(state, 'u1', 'u1_num');
    assert.strictEqual(state.currentTurnIndex, 1);
    assert.strictEqual(isOnlineLocalPlayerTurn(state, 'u2'), true);

    // 2. u2 plays number -> u3 (1 -> 2)
    state = playCard(state, 'u2', 'u2_num');
    assert.strictEqual(state.currentTurnIndex, 2);

    // 3. u3 plays Skip -> skips u4 (index 3), lands on u1 (index 0)
    state = playCard(state, 'u3', 'u3_skip');
    assert.strictEqual(state.currentTurnIndex, 0);

    // 4. u1 plays Wild Draw 4 choosing 'blue' -> targets next player u2 (index 1), u2 draws 4, turn skips to u3 (index 2)
    const u2HandBeforeWd4 = state.players[1].hand.length;
    state = playCard(state, 'u1', 'u1_wd4', { chosenColor: 'blue' });
    assert.strictEqual(state.activeColor, 'blue');
    assert.strictEqual(state.players[1].hand.length, u2HandBeforeWd4 + 4);
    assert.strictEqual(state.currentTurnIndex, 2);

    // Set up u3 to advance to u4 (2 -> 3) cleanly
    state.players[2].hand.push({ id: 'u3_blue', color: 'blue', value: '6', scoreValue: 6 });
    state = playCard(state, 'u3', 'u3_blue');
    assert.strictEqual(state.currentTurnIndex, 3);

    // 5. u4 plays Draw 2 on clockwise -> targets u1 (index 0), u1 draws 2, skips to u2 (index 1)
    const u1HandBeforeD2 = state.players[0].hand.length;
    state = playCard(state, 'u4', 'u4_d2');
    assert.strictEqual(state.players[0].hand.length, u1HandBeforeD2 + 2);
    assert.strictEqual(state.currentTurnIndex, 1);

    // 6. Test Reverse (u2 -> u3 -> u4 plays Reverse -> direction flips to -1 -> next is u3 (index 2))
    state.players[1].hand.push({ id: 'u2_blue', color: 'blue', value: '3', scoreValue: 3 });
    state = playCard(state, 'u2', 'u2_blue');
    assert.strictEqual(state.currentTurnIndex, 2);

    state.players[2].hand.push({ id: 'u3_blue2', color: 'blue', value: '5', scoreValue: 5 });
    state = playCard(state, 'u3', 'u3_blue2');
    assert.strictEqual(state.currentTurnIndex, 3);

    // Put matching color Reverse on u4
    state.players[3].hand.push({ id: 'u4_blue_rev', color: 'blue', value: 'reverse', scoreValue: 20 });
    state = playCard(state, 'u4', 'u4_blue_rev');
    assert.strictEqual(state.direction, -1);
    assert.strictEqual(state.currentTurnIndex, 2, 'After Reverse from u4 in 4P, counter-clockwise turn moves to u3 (index 2)');

    // Counter-clockwise targeting: u3 plays Skip -> skips u2 (index 1), lands on u1 (index 0)
    state.players[2].hand.push({ id: 'u3_blue_skip', color: 'blue', value: 'skip', scoreValue: 20 });
    state = playCard(state, 'u3', 'u3_blue_skip');
    assert.strictEqual(state.currentTurnIndex, 0, 'Counter-clockwise Skip from u3 skips u2 and lands on u1');

    // Confirm perspective remains strictly locked for all 4 clients
    for (const cfg of configs) {
      assert.strictEqual(resolveOnlinePerspectivePlayer(state.players, cfg.id).id, cfg.id);
    }
  });
});
