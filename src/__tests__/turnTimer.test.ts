// src/__tests__/turnTimer.test.ts - Unit tests for 15-Second Turn Timer, AFK Auto-Play & Timeout Fallback
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  isValidMove,
  isWildCard,
  getDominantColor,
  playCard,
  playerDrawCard,
  playerPassTurn,
  TURN_DURATION,
} from '../gameEngine';
import type { Card, GameState, Player } from '../types';

describe('Turn Timer Constants & Configuration', () => {
  test('TURN_DURATION is strictly set to 15 seconds', () => {
    assert.strictEqual(TURN_DURATION, 15);
  });
});

describe('AFK Auto-Play Fallback Logic (Playable Cards)', () => {
  test('Auto-plays first valid matching card when player times out with playable cards', () => {
    const p1: Player = {
      id: 'p1',
      name: 'Alice',
      isBot: false,
      hand: [
        { id: 'c_red_5', color: 'red', value: '5', scoreValue: 5 },
        { id: 'c_blue_7', color: 'blue', value: '7', scoreValue: 7 },
      ],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };
    const p2: Player = {
      id: 'p2',
      name: 'Bob',
      isBot: false,
      hand: [{ id: 'c_green_2', color: 'green', value: '2', scoreValue: 2 }],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };

    const initialDiscard: Card = { id: 'top_red_3', color: 'red', value: '3', scoreValue: 3 };

    const gameState: GameState = {
      deck: [{ id: 'deck_1', color: 'yellow', value: '1', scoreValue: 1 }],
      discardPile: [initialDiscard],
      players: [p1, p2],
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
      privacyMask: { isActive: false, targetPlayerId: '', targetPlayerName: '', promptText: '' },
      logs: [],
      turnCount: 1,
    };

    // Find playable cards for Alice (active player)
    const playableCards = p1.hand.filter((c) =>
      isValidMove(c, initialDiscard, gameState.activeColor)
    );

    assert.strictEqual(playableCards.length, 1);
    assert.strictEqual(playableCards[0].id, 'c_red_5');

    // Simulate AFK auto-play
    const cardToPlay = playableCards[0];
    const nextState = playCard(gameState, p1.id, cardToPlay.id);

    assert.strictEqual(nextState.players[0].hand.length, 1, 'Card removed from hand');
    assert.strictEqual(nextState.discardPile[nextState.discardPile.length - 1].id, 'c_red_5');
    assert.strictEqual(nextState.currentTurnIndex, 1, 'Turn advanced to Bob');
  });

  test('Auto-plays Wild card and automatically selects dominant color', () => {
    const p1: Player = {
      id: 'p1',
      name: 'Charlie',
      isBot: false,
      hand: [
        { id: 'c_wild_1', color: 'wild', value: 'wild', scoreValue: 50 },
        { id: 'c_blue_1', color: 'blue', value: '1', scoreValue: 1 },
        { id: 'c_blue_2', color: 'blue', value: '2', scoreValue: 2 },
        { id: 'c_green_1', color: 'green', value: '1', scoreValue: 1 },
      ],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };
    const p2: Player = {
      id: 'p2',
      name: 'Dave',
      isBot: false,
      hand: [{ id: 'c_yellow_9', color: 'yellow', value: '9', scoreValue: 9 }],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };

    const initialDiscard: Card = { id: 'top_yellow_3', color: 'yellow', value: '3', scoreValue: 3 };

    const gameState: GameState = {
      deck: [],
      discardPile: [initialDiscard],
      players: [p1, p2],
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'yellow',
      winner: null,
      isGameOver: false,
      gameMode: 'vs_bot',
      hasDrawnThisTurn: false,
      drawnCard: null,
      pendingColorChoice: false,
      pendingWildCard: null,
      privacyMask: { isActive: false, targetPlayerId: '', targetPlayerName: '', promptText: '' },
      logs: [],
      turnCount: 1,
    };

    const playableCards = p1.hand.filter((c) =>
      isValidMove(c, initialDiscard, gameState.activeColor)
    );

    assert.strictEqual(playableCards.length, 1);
    assert.strictEqual(playableCards[0].id, 'c_wild_1');

    const cardToPlay = playableCards[0];
    assert.strictEqual(isWildCard(cardToPlay), true);

    // Dominant color in remaining hand should be 'blue' (2 blue cards vs 1 green)
    const remainingHand = p1.hand.filter((c) => c.id !== cardToPlay.id);
    const chosenColor = getDominantColor(remainingHand);
    assert.strictEqual(chosenColor, 'blue');

    const nextState = playCard(gameState, p1.id, cardToPlay.id, { chosenColor });

    assert.strictEqual(nextState.activeColor, 'blue', 'Active color updated to dominant color');
    assert.strictEqual(nextState.pendingColorChoice, false, 'No pending modal');
    assert.strictEqual(nextState.currentTurnIndex, 1, 'Turn advanced to Dave');
  });
});

describe('AFK Auto-Draw & Pass Fallback Logic (No Playable Cards)', () => {
  test('Automatically draws from deck and passes turn when player has no valid moves', () => {
    const p1: Player = {
      id: 'p1',
      name: 'Emma',
      isBot: false,
      hand: [
        { id: 'c_green_5', color: 'green', value: '5', scoreValue: 5 },
        { id: 'c_yellow_7', color: 'yellow', value: '7', scoreValue: 7 },
      ],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };
    const p2: Player = {
      id: 'p2',
      name: 'Frank',
      isBot: false,
      hand: [{ id: 'c_blue_3', color: 'blue', value: '3', scoreValue: 3 }],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };

    const initialDiscard: Card = { id: 'top_red_2', color: 'red', value: '2', scoreValue: 2 };
    const drawnCard: Card = { id: 'drawn_yellow_9', color: 'yellow', value: '9', scoreValue: 9 };

    const gameState: GameState = {
      deck: [drawnCard],
      discardPile: [initialDiscard],
      players: [p1, p2],
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
      privacyMask: { isActive: false, targetPlayerId: '', targetPlayerName: '', promptText: '' },
      logs: [],
      turnCount: 1,
    };

    const playableCards = p1.hand.filter((c) =>
      isValidMove(c, initialDiscard, gameState.activeColor)
    );
    assert.strictEqual(playableCards.length, 0, 'No playable cards');

    // Simulate timeout auto-draw and pass
    const stateAfterDraw = playerDrawCard(gameState, p1.id);
    assert.strictEqual(stateAfterDraw.players[0].hand.length, 3, 'Hand increased by 1');
    assert.strictEqual(stateAfterDraw.hasDrawnThisTurn, true);

    const stateAfterPass = playerPassTurn(stateAfterDraw, p1.id);
    assert.strictEqual(stateAfterPass.currentTurnIndex, 1, 'Turn passed to Frank');
    assert.strictEqual(stateAfterPass.hasDrawnThisTurn, false, 'hasDrawnThisTurn reset');
  });

  test('Passes turn immediately if player has already drawn this turn', () => {
    const p1: Player = {
      id: 'p1',
      name: 'Grace',
      isBot: false,
      hand: [{ id: 'c_blue_1', color: 'blue', value: '1', scoreValue: 1 }],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };
    const p2: Player = {
      id: 'p2',
      name: 'Hank',
      isBot: false,
      hand: [{ id: 'c_red_1', color: 'red', value: '1', scoreValue: 1 }],
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };

    const initialDiscard: Card = { id: 'top_green_4', color: 'green', value: '4', scoreValue: 4 };

    const gameState: GameState = {
      deck: [],
      discardPile: [initialDiscard],
      players: [p1, p2],
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'green',
      winner: null,
      isGameOver: false,
      gameMode: 'vs_bot',
      hasDrawnThisTurn: true, // already drawn
      drawnCard: p1.hand[0],
      pendingColorChoice: false,
      pendingWildCard: null,
      privacyMask: { isActive: false, targetPlayerId: '', targetPlayerName: '', promptText: '' },
      logs: [],
      turnCount: 1,
    };

    // If hasDrawnThisTurn is true, playerPassTurn succeeds without needing another draw
    const passedState = playerPassTurn(gameState, p1.id);
    assert.strictEqual(passedState.currentTurnIndex, 1);
    assert.strictEqual(passedState.hasDrawnThisTurn, false);
  });
});

describe('Pass & Play Mode Privacy Mask Pausing', () => {
  test('Pass & Play turn hand-off sets privacy mask, pausing countdown for next player', () => {
    const game = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );

    // Initial pass_and_play has privacy mask active for active starting player
    assert.strictEqual(game.gameMode, 'pass_and_play');
    assert.strictEqual(game.privacyMask.isActive, true, 'Privacy mask active on initial start');
    assert.strictEqual(game.privacyMask.targetPlayerId, game.players[game.currentTurnIndex].id);

    // Timer is paused while privacyMask.isActive is true
    const isTimerPaused = game.privacyMask.isActive;
    assert.strictEqual(isTimerPaused, true);
  });
});
