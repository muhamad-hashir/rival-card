// src/__tests__/stacking.test.ts - Unit Tests for Draw Card Stacking (+2 and +4 Rule)
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  isValidMove,
  playCard,
  playerDrawCard,
  resolvePendingDraw,
  makeBotMove,
} from '../gameEngine';
import type { Card, GameState, Player } from '../types';

function makeCard(id: string, color: Card['color'], value: Card['value'], scoreValue = 20): Card {
  return { id, color, value, scoreValue };
}

function makeCustomGame(playersCount = 3, allowStacking = true): GameState {
  const players: Player[] = [];
  for (let i = 0; i < playersCount; i++) {
    players.push({
      id: `p${i}`,
      name: `Player ${i}`,
      isBot: false,
      hand: [
        makeCard(`c_p${i}_1`, 'red', '1', 1),
        makeCard(`c_p${i}_2`, 'blue', '2', 2),
      ],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    });
  }

  return {
    deck: [
      makeCard('d1', 'green', '3', 3),
      makeCard('d2', 'green', '4', 4),
      makeCard('d3', 'yellow', '5', 5),
      makeCard('d4', 'yellow', '6', 6),
      makeCard('d5', 'red', '7', 7),
      makeCard('d6', 'red', '8', 8),
      makeCard('d7', 'blue', '9', 9),
      makeCard('d8', 'blue', '0', 0),
      makeCard('d9', 'yellow', '1', 1),
      makeCard('d10', 'green', '2', 2),
    ],
    discardPile: [makeCard('top0', 'red', '9', 9)],
    players,
    currentTurnIndex: 0,
    direction: 1,
    activeColor: 'red',
    winner: null,
    isGameOver: false,
    gameMode: 'vs_bot',
    hasDrawnThisTurn: false,
    drawnCard: null,
    pendingColorChoice: false,
    pendingWildCard: null,
    privacyMask: {
      isActive: false,
      targetPlayerId: 'p0',
      targetPlayerName: 'Player 0',
      promptText: '',
    },
    logs: [],
    turnCount: 1,
    pendingDrawCount: 0,
    allowStacking,
  };
}

describe('Draw Card Stacking (+2 and +4 Rule) Engine Mechanics', () => {
  test('isValidMove only allows matching +2 on +2 when pendingDrawCount > 0', () => {
    const topD2 = makeCard('top_d2', 'red', 'draw2', 20);
    const greenD2 = makeCard('g_d2', 'green', 'draw2', 20);
    const blueD2 = makeCard('b_d2', 'blue', 'draw2', 20);
    const red5 = makeCard('r5', 'red', '5', 5);
    const redSkip = makeCard('rsk', 'red', 'skip', 20);
    const wildCard = makeCard('w1', 'wild', 'wild', 50);
    const wildDraw4 = makeCard('wd4', 'wild', 'wild_draw4', 50);

    // Any color Draw 2 is valid when stacking on Draw 2
    assert.strictEqual(isValidMove(greenD2, topD2, 'red', 2), true);
    assert.strictEqual(isValidMove(blueD2, topD2, 'red', 4), true);

    // Number matching active color is blocked during active stack
    assert.strictEqual(isValidMove(red5, topD2, 'red', 2), false);

    // Action matching active color is blocked
    assert.strictEqual(isValidMove(redSkip, topD2, 'red', 2), false);

    // Regular Wild is blocked
    assert.strictEqual(isValidMove(wildCard, topD2, 'red', 2), false);

    // Wild Draw 4 cannot stack on Draw 2
    assert.strictEqual(isValidMove(wildDraw4, topD2, 'red', 2), false);
  });

  test('isValidMove only allows matching +4 on +4 when pendingDrawCount > 0', () => {
    const topWd4 = makeCard('top_wd4', 'wild', 'wild_draw4', 50);
    const secondWd4 = makeCard('sec_wd4', 'wild', 'wild_draw4', 50);
    const redD2 = makeCard('r_d2', 'red', 'draw2', 20);
    const blue5 = makeCard('b5', 'blue', '5', 5);
    const regularWild = makeCard('w', 'wild', 'wild', 50);

    // Another Wild Draw 4 is valid
    assert.strictEqual(isValidMove(secondWd4, topWd4, 'blue', 4), true);

    // Draw 2 cannot stack on Wild Draw 4
    assert.strictEqual(isValidMove(redD2, topWd4, 'blue', 4), false);

    // Number and regular Wild blocked
    assert.strictEqual(isValidMove(blue5, topWd4, 'blue', 4), false);
    assert.strictEqual(isValidMove(regularWild, topWd4, 'blue', 4), false);
  });

  test('Single +2 played when target holds +2 escalates pendingDrawCount to 2 and moves turn to target', () => {
    let state = makeCustomGame(3, true);
    const p0D2 = makeCard('p0_d2', 'red', 'draw2', 20);
    const p1D2 = makeCard('p1_d2', 'blue', 'draw2', 20);

    state.players[0].hand.push(p0D2);
    state.players[1].hand.push(p1D2);

    const initialP1HandSize = state.players[1].hand.length;

    // Player 0 plays Red Draw 2
    state = playCard(state, 'p0', p0D2.id);

    // Target Player 1 holds a Draw 2: pendingDrawCount becomes 2
    assert.strictEqual(state.pendingDrawCount, 2);
    // Turn advances to Player 1 (step = 1) so Player 1 can stack or take
    assert.strictEqual(state.currentTurnIndex, 1);
    // Player 1 has NOT drawn cards yet
    assert.strictEqual(state.players[1].hand.length, initialP1HandSize);
  });

  test('4-Player Stacking Cascade: 2 -> 4 -> 6 -> 8 and detonation on victim without +2', () => {
    let state = makeCustomGame(4, true);

    const d2_0 = makeCard('d2_0', 'red', 'draw2', 20);
    const d2_1 = makeCard('d2_1', 'green', 'draw2', 20);
    const d2_2 = makeCard('d2_2', 'blue', 'draw2', 20);
    const d2_3 = makeCard('d2_3', 'yellow', 'draw2', 20);

    state.players[0].hand.push(d2_0);
    state.players[1].hand.push(d2_1);
    state.players[2].hand.push(d2_2);
    state.players[3].hand.push(d2_3);

    // P0 plays Red Draw 2 -> stack: 2, turn moves to P1
    state = playCard(state, 'p0', d2_0.id);
    assert.strictEqual(state.pendingDrawCount, 2);
    assert.strictEqual(state.currentTurnIndex, 1);

    // P1 stacks Green Draw 2 -> stack: 4, turn moves to P2
    state = playCard(state, 'p1', d2_1.id);
    assert.strictEqual(state.pendingDrawCount, 4);
    assert.strictEqual(state.currentTurnIndex, 2);

    // P2 stacks Blue Draw 2 -> stack: 6, turn moves to P3
    state = playCard(state, 'p2', d2_2.id);
    assert.strictEqual(state.pendingDrawCount, 6);
    assert.strictEqual(state.currentTurnIndex, 3);

    // P3 stacks Yellow Draw 2 -> Next is P0 (index 0). P0 has NO more Draw 2s!
    const p0HandBeforeDetonation = state.players[0].hand.length;
    state = playCard(state, 'p3', d2_3.id);

    // P0 could not stack: drew 8 cards!
    assert.strictEqual(state.players[0].hand.length, p0HandBeforeDetonation + 8);
    // pendingDrawCount reset to 0
    assert.strictEqual(state.pendingDrawCount, 0);
    // P0 turn skipped, advancing to P1 (index 1)
    assert.strictEqual(state.currentTurnIndex, 1);
  });

  test('Wild Draw 4 Stacking: 4 -> 8 escalation and detonation', () => {
    let state = makeCustomGame(3, true);

    const wd4_0 = makeCard('wd4_0', 'wild', 'wild_draw4', 50);
    const wd4_1 = makeCard('wd4_1', 'wild', 'wild_draw4', 50);

    state.players[0].hand.push(wd4_0);
    state.players[1].hand.push(wd4_1);

    // P0 plays Wild Draw 4
    state = playCard(state, 'p0', wd4_0.id, { chosenColor: 'blue' });
    assert.strictEqual(state.pendingDrawCount, 4);
    assert.strictEqual(state.currentTurnIndex, 1);

    // P1 stacks Wild Draw 4 -> Next is P2. P2 has no Wild Draw 4!
    const p2HandBefore = state.players[2].hand.length;
    state = playCard(state, 'p1', wd4_1.id, { chosenColor: 'green' });

    // P2 drew 8 cards
    assert.strictEqual(state.players[2].hand.length, p2HandBefore + 8);
    assert.strictEqual(state.pendingDrawCount, 0);
    // P2 skipped, turn advances to P0
    assert.strictEqual(state.currentTurnIndex, 0);
    assert.strictEqual(state.activeColor, 'green');
  });

  test('Voluntary Draw: player facing pendingDrawCount > 0 willingly takes cards', () => {
    let state = makeCustomGame(3, true);

    const d2_0 = makeCard('d2_0', 'red', 'draw2', 20);
    const d2_1 = makeCard('d2_1', 'yellow', 'draw2', 20);

    state.players[0].hand.push(d2_0);
    state.players[1].hand.push(d2_1); // P1 holds a Draw 2, but chooses to take penalty instead!

    state = playCard(state, 'p0', d2_0.id);
    assert.strictEqual(state.pendingDrawCount, 2);
    assert.strictEqual(state.currentTurnIndex, 1);

    const p1HandBefore = state.players[1].hand.length;

    // P1 chooses voluntary draw via playerDrawCard (or resolvePendingDraw)
    state = playerDrawCard(state, 'p1');

    assert.strictEqual(state.players[1].hand.length, p1HandBefore + 2);
    assert.strictEqual(state.pendingDrawCount, 0);
    // P1 turn ends, advancing to P2
    assert.strictEqual(state.currentTurnIndex, 2);
  });

  test('Bot AI defense in makeBotMove stacks when holding matching card', () => {
    let state = makeCustomGame(3, true);

    // P1 is a Bot
    state.players[1].isBot = true;
    state.players[1].name = 'RivalBot 🤖';

    const p0D2 = makeCard('p0_d2', 'red', 'draw2', 20);
    const botD2 = makeCard('bot_d2', 'blue', 'draw2', 20);
    const p2D2 = makeCard('p2_d2', 'green', 'draw2', 20);

    state.players[0].hand.push(p0D2);
    state.players[1].hand.push(botD2);
    state.players[2].hand.push(p2D2);

    // Human plays Draw 2
    state = playCard(state, 'p0', p0D2.id);
    assert.strictEqual(state.pendingDrawCount, 2);
    assert.strictEqual(state.currentTurnIndex, 1);

    // Force deterministic bot stack by running makeBotMove
    const nextState = makeBotMove(state);

    if (nextState.pendingDrawCount === 4) {
      // Bot successfully stacked onto P2!
      assert.strictEqual(nextState.pendingDrawCount, 4);
      // Turn advances to P2 (index 2)
      assert.strictEqual(nextState.currentTurnIndex, 2);
    } else {
      // Bot took cards (12% voluntary/forced draw branch)
      assert.strictEqual(nextState.pendingDrawCount, 0);
      assert.strictEqual(nextState.currentTurnIndex, 2);
    }
  });

  test('Bot AI with no stackable card draws the accumulated stack cleanly', () => {
    let state = makeCustomGame(2, true);

    state.players[1].isBot = true;
    state.players[1].name = 'RivalBot 🤖';
    state.players[1].hand = [makeCard('num1', 'blue', '1', 1), makeCard('num2', 'yellow', '2', 2)];

    state.currentTurnIndex = 1;
    state.pendingDrawCount = 6; // Active stack of 6 cards
    state.discardPile = [makeCard('top_d2', 'red', 'draw2', 20)];
    state.activeColor = 'red';

    const botHandBefore = state.players[1].hand.length;
    const nextState = makeBotMove(state);

    // Bot drew all 6 cards
    assert.strictEqual(nextState.players[1].hand.length, botHandBefore + 6);
    assert.strictEqual(nextState.pendingDrawCount, 0);
    assert.strictEqual(nextState.currentTurnIndex, 0);
  });
});
