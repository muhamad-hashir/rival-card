// src/__tests__/leaveAndPassPlay.test.ts - Unit tests for Pass & Play turn verification and leave modal logic
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, playCard, dismissPrivacyMask } from '../gameEngine';
import type { Card } from '../types';

const DUMMY_EXTRA_CARD: Card = {
  id: 'extra_card',
  color: 'blue',
  value: '9',
  scoreValue: 9,
};

describe('Pass & Play 1v1 Turn Hand-off Optimization', () => {
  test('Skip card in 1v1 Pass & Play keeps turn with active player without triggering privacy mask', () => {
    let game = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );
    game.currentTurnIndex = 0;
    game.discardPile = [{ id: 'base_card', color: 'red', value: '1', scoreValue: 1 }];
    game.activeColor = 'red';
    game = dismissPrivacyMask(game);

    const skipCard: Card = {
      id: 'test_skip',
      color: 'red',
      value: 'skip',
      scoreValue: 20,
    };
    game.players[0].hand = [skipCard, DUMMY_EXTRA_CARD];

    const nextState = playCard(game, 'p1', 'test_skip');

    assert.strictEqual(nextState.currentTurnIndex, 0, 'Turn index should stay 0 in 1v1 after Skip');
    assert.strictEqual(
      nextState.privacyMask.isActive,
      false,
      'Privacy mask must remain inactive when turn stays with same player'
    );
  });

  test('Reverse card in 1v1 Pass & Play acts as Skip and keeps privacy mask inactive', () => {
    let game = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );
    game.currentTurnIndex = 0;
    game.discardPile = [{ id: 'base_card', color: 'blue', value: '1', scoreValue: 1 }];
    game.activeColor = 'blue';
    game = dismissPrivacyMask(game);

    const reverseCard: Card = {
      id: 'test_reverse',
      color: 'blue',
      value: 'reverse',
      scoreValue: 20,
    };
    game.players[0].hand = [reverseCard, DUMMY_EXTRA_CARD];

    const nextState = playCard(game, 'p1', 'test_reverse');

    assert.strictEqual(nextState.currentTurnIndex, 0, 'Turn index should stay 0 in 1v1 after Reverse');
    assert.strictEqual(nextState.privacyMask.isActive, false, 'Privacy mask must remain inactive');
  });

  test('Draw 2 card in 1v1 Pass & Play skips opponent and keeps privacy mask inactive', () => {
    let game = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );
    game.currentTurnIndex = 0;
    game.discardPile = [{ id: 'base_card', color: 'green', value: '1', scoreValue: 1 }];
    game.activeColor = 'green';
    game = dismissPrivacyMask(game);

    const draw2Card: Card = {
      id: 'test_draw2',
      color: 'green',
      value: 'draw2',
      scoreValue: 20,
    };
    game.players[0].hand = [draw2Card, DUMMY_EXTRA_CARD];
    const p2InitialHandCount = game.players[1].hand.length;

    const nextState = playCard(game, 'p1', 'test_draw2');

    assert.strictEqual(nextState.players[1].hand.length, p2InitialHandCount + 2, 'Player 2 should draw 2 cards');
    assert.strictEqual(nextState.currentTurnIndex, 0, 'Turn index should stay 0 in 1v1 after Draw 2');
    assert.strictEqual(nextState.privacyMask.isActive, false, 'Privacy mask must remain inactive');
  });

  test('Normal number card in 1v1 Pass & Play switches turn and activates privacy mask', () => {
    let game = createGame(
      [
        { id: 'p1', name: 'Player 1', isBot: false },
        { id: 'p2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );
    game.currentTurnIndex = 0;
    game.discardPile = [{ id: 'base_card', color: 'yellow', value: '1', scoreValue: 1 }];
    game.activeColor = 'yellow';
    game = dismissPrivacyMask(game);

    const numCard: Card = {
      id: 'test_num',
      color: 'yellow',
      value: '5',
      scoreValue: 5,
    };
    game.players[0].hand = [numCard, DUMMY_EXTRA_CARD];

    const nextState = playCard(game, 'p1', 'test_num');

    assert.strictEqual(nextState.currentTurnIndex, 1, 'Turn index should advance to Player 2');
    assert.strictEqual(nextState.privacyMask.isActive, true, 'Privacy mask must be active for Player 2');
    assert.strictEqual(nextState.privacyMask.targetPlayerId, 'p2');
    assert.strictEqual(nextState.privacyMask.promptText, 'Pass device to Player 2');
  });
});

describe('Leave Confirmation Modal Content Logic', () => {
  test('Modal generates appropriate body text and warning based on mode', () => {
    const getLeaveModalConfig = (isOnlineMode: boolean) => {
      return {
        title: 'Leave Game?',
        bodyText: isOnlineMode
          ? 'Are you sure you want to leave the room? You will forfeit and lose the game.'
          : 'Are you sure you want to return to the home screen? Your current game progress will be lost.',
        hasForfeitWarning: isOnlineMode,
        stayButtonLabel: 'Stay & Play',
        leaveButtonLabel: 'Leave Match',
      };
    };

    const onlineConfig = getLeaveModalConfig(true);
    assert.strictEqual(onlineConfig.title, 'Leave Game?');
    assert.ok(onlineConfig.bodyText.includes('forfeit and lose the game'));
    assert.strictEqual(onlineConfig.hasForfeitWarning, true);
    assert.strictEqual(onlineConfig.stayButtonLabel, 'Stay & Play');
    assert.strictEqual(onlineConfig.leaveButtonLabel, 'Leave Match');

    const localConfig = getLeaveModalConfig(false);
    assert.strictEqual(localConfig.title, 'Leave Game?');
    assert.ok(localConfig.bodyText.includes('progress will be lost'));
    assert.strictEqual(localConfig.hasForfeitWarning, false);
    assert.strictEqual(localConfig.stayButtonLabel, 'Stay & Play');
    assert.strictEqual(localConfig.leaveButtonLabel, 'Leave Match');
  });
});
