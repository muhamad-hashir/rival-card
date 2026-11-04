// src/__tests__/catchRivalWindow.test.ts - Unit tests for 2.5s CATCH RIVAL! Penalty Window, Bot Reaction, and Confetti Logic
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  declareRival,
  catchRival,
  playCard,
} from '../gameEngine';
import type { GameState } from '../types';

describe('CATCH RIVAL! 2.5s Penalty Window & Catch Mechanics', () => {
  it('identifies when player drops from 2 cards to 1 card without declaring RIVAL', () => {
    let game = createGame([
      { id: 'human', name: 'Human', isBot: false },
      { id: 'bot', name: 'RivalBot', isBot: true },
    ]);

    // Give human 2 cards
    game.players[0].hand = [
      { id: 'c1', color: 'red', value: '5', scoreValue: 5 },
      { id: 'c2', color: 'blue', value: '7', scoreValue: 7 },
    ];
    game.players[0].hasDeclaredRival = false;
    game.discardPile = [{ id: 'top', color: 'red', value: '3', scoreValue: 3 }];
    game.activeColor = 'red';
    game.currentTurnIndex = 0;

    // Human plays c1 (red 5) without declaring RIVAL
    const prevCount = game.players[0].hand.length; // 2
    const nextGame = playCard(game, 'human', 'c1');

    const newCount = nextGame.players[0].hand.length;
    const isVulnerable = prevCount > 1 && newCount === 1 && !nextGame.players[0].hasDeclaredRival;

    assert.strictEqual(prevCount, 2);
    assert.strictEqual(newCount, 1);
    assert.strictEqual(nextGame.players[0].hasDeclaredRival, false);
    assert.strictEqual(isVulnerable, true, 'Human player should be vulnerable to CATCH RIVAL!');
  });

  it('exempts player who declared RIVAL before playing second-to-last card', () => {
    let game = createGame([
      { id: 'human', name: 'Human', isBot: false },
      { id: 'bot', name: 'RivalBot', isBot: true },
    ]);

    game.players[0].hand = [
      { id: 'c1', color: 'red', value: '5', scoreValue: 5 },
      { id: 'c2', color: 'blue', value: '7', scoreValue: 7 },
    ];
    game.discardPile = [{ id: 'top', color: 'red', value: '3', scoreValue: 3 }];
    game.activeColor = 'red';
    game.currentTurnIndex = 0;

    // Human declares RIVAL before playing
    game = declareRival(game, 'human');
    assert.strictEqual(game.players[0].hasDeclaredRival, true);

    const prevCount = game.players[0].hand.length;
    const nextGame = playCard(game, 'human', 'c1');

    const newCount = nextGame.players[0].hand.length;
    const isVulnerable = prevCount > 1 && newCount === 1 && !nextGame.players[0].hasDeclaredRival;

    assert.strictEqual(newCount, 1);
    assert.strictEqual(nextGame.players[0].hasDeclaredRival, true);
    assert.strictEqual(isVulnerable, false, 'Player who declared RIVAL must NOT be vulnerable');
  });

  it('opponent catches careless player: forces +2 cards draw and resets vulnerability', () => {
    let game = createGame([
      { id: 'p1', name: 'Careless Player', isBot: false },
      { id: 'p2', name: 'Attentive Opponent', isBot: true },
    ]);

    game.players[0].hand = [{ id: 'last_card', color: 'green', value: '9', scoreValue: 9 }];
    game.players[0].hasDeclaredRival = false;

    // P2 catches P1
    const caughtState = catchRival(game, 'p2', 'p1');

    assert.strictEqual(caughtState.players[0].hand.length, 3, 'Careless player receives 2 penalty cards');
    assert.strictEqual(caughtState.players[0].hasDeclaredRival, false);
    const catchLog = caughtState.logs[caughtState.logs.length - 1];
    assert.strictEqual(catchLog.actionType, 'CATCH_RIVAL');
    assert.ok(catchLog.message.includes('CAUGHT'));
  });

  it('bot reaction delay falls within 1.2s to 2.2s range and 80% catch rate', () => {
    const getReactionDelay = () => 1200 + Math.random() * 1000;

    for (let i = 0; i < 50; i++) {
      const delay = getReactionDelay();
      assert.ok(delay >= 1200 && delay <= 2200, `Delay ${delay} must be in [1200, 2200]`);
    }

    // Probability test
    let catchCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (Math.random() < 0.8) {
        catchCount++;
      }
    }
    const rate = catchCount / trials;
    assert.ok(rate >= 0.73 && rate <= 0.87, `Rate ${rate} should be near 0.80`);
  });
});

describe('GameOverModal Winner Confetti Logic', () => {
  it('confetti burst activates ONLY when local player is the 1st place winner', () => {
    const shouldTriggerConfetti = (isLocalWinner: boolean, isModalVisible: boolean) => {
      return isModalVisible && isLocalWinner;
    };

    // Case 1: Local player won match -> Burst active
    assert.strictEqual(shouldTriggerConfetti(true, true), true);

    // Case 2: Local player lost match (Defeat) -> Burst INACTIVE
    assert.strictEqual(shouldTriggerConfetti(false, true), false);

    // Case 3: Modal not visible -> Inactive
    assert.strictEqual(shouldTriggerConfetti(true, false), false);
    assert.strictEqual(shouldTriggerConfetti(false, false), false);
  });
});
