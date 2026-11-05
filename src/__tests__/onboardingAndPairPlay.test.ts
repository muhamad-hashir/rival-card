// src/__tests__/onboardingAndPairPlay.test.ts - Unit Tests for Onboarding, Pair Play, and Error Toast
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  hasIdenticalPair,
  playPairCards,
  catchRival,
} from '../gameEngine';
import { authService } from '../services/authService';
import { playerProfileService } from '../services/playerProfileService';
import { errorToastService, ToastPayload } from '../services/errorToastService';
import type { Card } from '../types';

function makeCard(id: string, color: Card['color'], value: Card['value'], scoreValue = 0): Card {
  return { id, color, value, scoreValue };
}

describe('Identical Card Combo Play (Pair Stacking)', () => {
  test('hasIdenticalPair finds identical duplicate card by color and value', () => {
    const card1 = makeCard('c1', 'red', '7', 7);
    const card2 = makeCard('c2', 'red', '7', 7);
    const card3 = makeCard('c3', 'blue', '7', 7);
    const card4 = makeCard('c4', 'red', '5', 5);

    const hand: Card[] = [card1, card2, card3, card4];

    const match = hasIdenticalPair(hand, card1);
    assert.ok(match);
    assert.strictEqual(match.id, 'c2');
    assert.strictEqual(match.color, 'red');
    assert.strictEqual(match.value, '7');
  });

  test('hasIdenticalPair returns null when no matching card exists', () => {
    const card1 = makeCard('c1', 'red', '7', 7);
    const card3 = makeCard('c3', 'blue', '7', 7);
    const card4 = makeCard('c4', 'red', '5', 5);

    const hand: Card[] = [card1, card3, card4];

    assert.strictEqual(hasIdenticalPair(hand, card1), null);
    assert.strictEqual(hasIdenticalPair(hand, card3), null);
    assert.strictEqual(hasIdenticalPair(hand, card4), null);
  });

  test('hasIdenticalPair does not match the same card against itself', () => {
    const card1 = makeCard('c1', 'green', '3', 3);
    const hand: Card[] = [card1];

    assert.strictEqual(hasIdenticalPair(hand, card1), null);
  });

  test('playPairCards removes both cards and places them in discard pile', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );

    const c1 = makeCard('pair_1', 'blue', '4', 4);
    const c2 = makeCard('pair_2', 'blue', '4', 4);
    const topCard = makeCard('top_1', 'blue', '9', 9);

    state = {
      ...state,
      currentTurnIndex: 0,
      activeColor: 'blue',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('extra', 'yellow', '1', 1)] },
        state.players[1],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id);

    // Hand should decrease by 2
    assert.strictEqual(nextState.players[0].hand.length, 1);
    assert.strictEqual(nextState.players[0].hand[0].id, 'extra');

    // Discard pile should have c1 and c2 appended
    const topDiscard = nextState.discardPile[nextState.discardPile.length - 1];
    assert.strictEqual(topDiscard.id, c2.id);
    assert.strictEqual(nextState.discardPile[nextState.discardPile.length - 2].id, c1.id);
  });

  test('playPairCards double Skip skips two players', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
        { id: 'p3', name: 'P3', isBot: false },
        { id: 'p4', name: 'P4', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('skip_1', 'green', 'skip', 20);
    const c2 = makeCard('skip_2', 'green', 'skip', 20);
    const topCard = makeCard('top_g', 'green', '2', 2);

    state = {
      ...state,
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'green',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('other', 'green', '1', 1)] },
        state.players[1],
        state.players[2],
        state.players[3],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id);
    // Skips 2 players (p2 and p3), so turn goes to p4 (index 3)
    assert.strictEqual(nextState.currentTurnIndex, 3);
  });

  test('playPairCards double Draw 2 forces victim to draw 4 cards and skip turn', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
        { id: 'p3', name: 'P3', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('d2_1', 'yellow', 'draw2', 20);
    const c2 = makeCard('d2_2', 'yellow', 'draw2', 20);
    const topCard = makeCard('top_y', 'yellow', '5', 5);

    const initialP2HandCount = state.players[1].hand.length;

    state = {
      ...state,
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'yellow',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('leftover', 'red', '1', 1)] },
        state.players[1],
        state.players[2],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id);

    // Victim (P2) draws 4 cards
    assert.strictEqual(nextState.players[1].hand.length, initialP2HandCount + 4);
    // P2 is skipped, turn goes to P3 (index 2)
    assert.strictEqual(nextState.currentTurnIndex, 2);
  });

  test('playPairCards double Wild Draw 4 forces victim to draw 8 cards and updates activeColor', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('wd4_1', 'wild', 'wild_draw4', 50);
    const c2 = makeCard('wd4_2', 'wild', 'wild_draw4', 50);
    const topCard = makeCard('top_card', 'blue', '3', 3);

    const initialP2Count = state.players[1].hand.length;

    state = {
      ...state,
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'blue',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('remain', 'blue', '1', 1)] },
        state.players[1],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id, { chosenColor: 'yellow' });

    // P2 draws 8 cards
    assert.strictEqual(nextState.players[1].hand.length, initialP2Count + 8);
    // Active color is yellow
    assert.strictEqual(nextState.activeColor, 'yellow');
  });

  test('playPairCards double Mute mutes next player for 2 rounds and skips them', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
        { id: 'p3', name: 'P3', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('mute_1', 'wild', 'mute', 50);
    const c2 = makeCard('mute_2', 'wild', 'mute', 50);
    const topCard = makeCard('top_c', 'red', '4', 4);

    state = {
      ...state,
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'red',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('x', 'red', '1', 1)] },
        state.players[1],
        state.players[2],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id, { chosenColor: 'red' });

    // P2 is muted with 2 rounds remaining and skipped
    assert.strictEqual(nextState.players[1].isMuted, true);
    assert.strictEqual(nextState.players[1].mutedRoundsRemaining, 2);
    assert.strictEqual(nextState.currentTurnIndex, 2);
  });

  test('playPairCards wins game immediately when holding exactly 2 cards', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('win_1', 'red', '8', 8);
    const c2 = makeCard('win_2', 'red', '8', 8);
    const topCard = makeCard('top_r', 'red', '2', 2);

    state = {
      ...state,
      currentTurnIndex: 0,
      activeColor: 'red',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2] },
        state.players[1],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id);
    assert.strictEqual(nextState.isGameOver, true);
    assert.strictEqual(nextState.winner?.id, 'p1');
    assert.strictEqual(nextState.players[0].hand.length, 0);
  });

  test('playPairCards leaves player vulnerable to CATCH RIVAL when transitioning to 1 card without declaration', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
      ],
      'vs_bot'
    );

    const c1 = makeCard('p_1', 'blue', '6', 6);
    const c2 = makeCard('p_2', 'blue', '6', 6);
    const topCard = makeCard('top_b', 'blue', '1', 1);

    state = {
      ...state,
      currentTurnIndex: 0,
      activeColor: 'blue',
      discardPile: [topCard],
      players: [
        { ...state.players[0], hand: [c1, c2, makeCard('left', 'green', '2', 2)], hasDeclaredRival: false },
        state.players[1],
      ],
    };

    const nextState = playPairCards(state, 'p1', c1.id, c2.id);
    assert.strictEqual(nextState.players[0].hand.length, 1);
    assert.strictEqual(nextState.players[0].hasDeclaredRival, false);

    // Opponent can catch P1
    const caughtState = catchRival(nextState, 'p2', 'p1');
    assert.strictEqual(caughtState.players[0].hand.length, 3);
  });
});

describe('First-Launch Onboarding & Auth State', () => {
  beforeEach(async () => {
    await authService.resetOnboarding();
    await playerProfileService.resetProfile();
  });

  test('isOnboardingCompleted returns false initially', async () => {
    const completed = await authService.isOnboardingCompleted();
    assert.strictEqual(completed, false);
  });

  test('completeOnboarding marks onboarding completed', async () => {
    await authService.completeOnboarding();
    const completed = await authService.isOnboardingCompleted();
    assert.strictEqual(completed, true);
  });

  test('initGuestProfile creates profile and flags onboarding as completed', async () => {
    const profile = await authService.initGuestProfile();
    assert.ok(profile);
    assert.ok(profile.id);
    assert.strictEqual(profile.isGuest, true);
    assert.strictEqual(profile.level, 1);
    assert.strictEqual(profile.coins, 250);
    assert.strictEqual(profile.gems, 10);

    const completed = await authService.isOnboardingCompleted();
    assert.strictEqual(completed, true);
  });
});

describe('Global Error & Network Toast Notification Service', () => {
  beforeEach(() => {
    errorToastService.hide();
  });

  test('show updates current toast and notifies subscribers', () => {
    let receivedToast: ToastPayload | null = null;
    const unsub = errorToastService.subscribe((t) => {
      receivedToast = t;
    });

    errorToastService.show({
      message: 'Connection lost! Attempting to reconnect... (15s)',
      type: 'warning',
    });

    assert.ok(receivedToast);
    assert.strictEqual((receivedToast as ToastPayload).message, 'Connection lost! Attempting to reconnect... (15s)');
    assert.strictEqual((receivedToast as ToastPayload).type, 'warning');

    errorToastService.hide();
    assert.strictEqual(receivedToast, null);
    assert.strictEqual(errorToastService.getCurrentToast(), null);

    unsub();
  });

  test('showError and showWarning set appropriate toast types', () => {
    errorToastService.showWarning('Minor warning', 3000);
    assert.strictEqual(errorToastService.getCurrentToast()?.type, 'warning');
    assert.strictEqual(errorToastService.getCurrentToast()?.message, 'Minor warning');

    errorToastService.showError('Critical failure', 5000);
    assert.strictEqual(errorToastService.getCurrentToast()?.type, 'error');
    assert.strictEqual(errorToastService.getCurrentToast()?.message, 'Critical failure');
  });

  test('action callback is preserved and executable', () => {
    let actionTriggered = false;
    errorToastService.show({
      message: 'Match disconnected. Return to Main Menu',
      type: 'error',
      action: {
        label: 'Return to Menu',
        onPress: () => {
          actionTriggered = true;
        },
      },
    });

    const current = errorToastService.getCurrentToast();
    assert.ok(current?.action);
    assert.strictEqual(current.action.label, 'Return to Menu');
    current.action.onPress();
    assert.strictEqual(actionTriggered, true);
  });
});
