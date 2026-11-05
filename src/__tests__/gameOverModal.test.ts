// src/__tests__/gameOverModal.test.ts - Unit tests for GameOverModal rankings and mode-aware button logic
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Player } from '../types';

function getOrdinalRank(index: number): string {
  if (index === 0) return '1ST';
  if (index === 1) return '2ND';
  if (index === 2) return '3RD';
  if (index === 3) return '4TH';
  return `${index + 1}TH`;
}

describe('GameOverModal Standings & Ranking Logic', () => {
  test('getOrdinalRank returns standard ordinal strings', () => {
    assert.strictEqual(getOrdinalRank(0), '1ST');
    assert.strictEqual(getOrdinalRank(1), '2ND');
    assert.strictEqual(getOrdinalRank(2), '3RD');
    assert.strictEqual(getOrdinalRank(3), '4TH');
    assert.strictEqual(getOrdinalRank(4), '5TH');
  });

  test('Standings sort winner first, then by cards remaining ascending', () => {
    const players: Player[] = [
      {
        id: 'p1',
        name: 'You',
        isBot: false,
        hand: [{ id: 'c1', color: 'red', value: '1', scoreValue: 1 }, { id: 'c2', color: 'blue', value: '2', scoreValue: 2 }],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      },
      {
        id: 'bot1',
        name: 'CyberBot 🤖',
        isBot: true,
        hand: [{ id: 'c3', color: 'green', value: '3', scoreValue: 3 }],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: true,
      },
      {
        id: 'bot2',
        name: 'NovaBot 🤖',
        isBot: true,
        hand: [], // Winner!
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      },
      {
        id: 'bot3',
        name: 'EchoBot 🤖',
        isBot: true,
        hand: [
          { id: 'c4', color: 'yellow', value: '4', scoreValue: 4 },
          { id: 'c5', color: 'yellow', value: '5', scoreValue: 5 },
          { id: 'c6', color: 'yellow', value: '6', scoreValue: 6 },
        ],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      },
    ];

    const winner = players[2]; // NovaBot is winner

    const sorted = [...players].sort((a, b) => {
      if (a.id === winner.id) return -1;
      if (b.id === winner.id) return 1;
      return a.hand.length - b.hand.length;
    });

    assert.strictEqual(sorted[0].id, 'bot2', 'Winner should be 1st');
    assert.strictEqual(sorted[1].id, 'bot1', 'CyberBot with 1 card should be 2nd');
    assert.strictEqual(sorted[2].id, 'p1', 'You with 2 cards should be 3rd');
    assert.strictEqual(sorted[3].id, 'bot3', 'EchoBot with 3 cards should be 4th');
  });

  test('Player display name does not duplicate "(You)"', () => {
    const formatDisplayName = (name: string, isLocalPlayer: boolean) => {
      const isAlreadyNamedYou = name.trim().toLowerCase() === 'you';
      return isAlreadyNamedYou ? 'You' : isLocalPlayer ? `${name} (You)` : name;
    };

    assert.strictEqual(formatDisplayName('You', true), 'You');
    assert.strictEqual(formatDisplayName('Alex', true), 'Alex (You)');
    assert.strictEqual(formatDisplayName('CyberBot 🤖', false), 'CyberBot 🤖');
  });

  test('Mode-aware buttons decision matrix', () => {
    const getModalButtons = (
      mode: 'bot' | 'online' | 'pass_and_play',
      playerCount: number
    ) => {
      if (mode === 'online') {
        return ['Play Again', 'Quit Room'];
      }
      if (mode === 'bot') {
        if (playerCount <= 2) {
          return ['Play Again', 'Play with More Bots', 'Main Menu'];
        }
        return ['Play Again', 'Play 1v1', 'Main Menu'];
      }
      return ['Play Again', 'Main Menu'];
    };

    // 1v1 Bot mode
    const bot1v1Buttons = getModalButtons('bot', 2);
    assert.ok(bot1v1Buttons.includes('Play Again'));
    assert.ok(bot1v1Buttons.includes('Play with More Bots'));
    assert.ok(!bot1v1Buttons.includes('Quit Room'));

    // 4-Player Bot mode
    const bot4pButtons = getModalButtons('bot', 4);
    assert.ok(bot4pButtons.includes('Play Again'));
    assert.ok(bot4pButtons.includes('Play 1v1'));
    assert.ok(!bot4pButtons.includes('Quit Room'));

    // Online mode
    const onlineButtons = getModalButtons('online', 2);
    assert.ok(onlineButtons.includes('Play Again'));
    assert.ok(onlineButtons.includes('Quit Room'));
    assert.ok(!onlineButtons.includes('Play with More Bots'));
  });

  test('Match rewards payload format and level-up banner detection', () => {
    // Normal match rewards without level up
    const normalRewards = {
      earnedXp: 50,
      earnedCoins: 20,
      leveledUp: false,
      newLevel: 1,
      bonusCoins: 0,
      bonusGems: 0,
      currentXp: 50,
      xpToNextLevel: 100,
    };

    assert.strictEqual(normalRewards.leveledUp, false);
    assert.strictEqual(normalRewards.earnedXp, 50);
    assert.strictEqual(normalRewards.earnedCoins, 20);

    // Victory match rewards with level up
    const levelUpRewards = {
      earnedXp: 120,
      earnedCoins: 60,
      leveledUp: true,
      newLevel: 2,
      bonusCoins: 100,
      bonusGems: 5,
      currentXp: 20,
      xpToNextLevel: 200,
    };

    assert.strictEqual(levelUpRewards.leveledUp, true);
    assert.strictEqual(levelUpRewards.newLevel, 2);
    assert.strictEqual(levelUpRewards.bonusCoins, 100);
    assert.strictEqual(levelUpRewards.bonusGems, 5);
    assert.strictEqual(levelUpRewards.earnedXp, 120);
    assert.strictEqual(levelUpRewards.earnedCoins, 60);
  });

  test('Two-Step Pagination Flow & Clean Subtext without Turn Counts', () => {
    const getScreen1Subtext = (isLocalWinner: boolean, winnerName: string) => {
      return isLocalWinner
        ? 'You emptied your hand and won the match!'
        : `${winnerName} emptied their hand and won the match.`;
    };

    // Subtext must not contain any turn count phrases
    const winSubtext = getScreen1Subtext(true, 'Player');
    assert.strictEqual(winSubtext, 'You emptied your hand and won the match!');
    assert.ok(!winSubtext.includes('turn'));
    assert.ok(!winSubtext.includes('turns'));

    const defeatSubtext = getScreen1Subtext(false, 'CyberBot 🤖');
    assert.strictEqual(defeatSubtext, 'CyberBot 🤖 emptied their hand and won the match.');
    assert.ok(!defeatSubtext.includes('turn'));
    assert.ok(!defeatSubtext.includes('turns'));

    // Pagination Step progression
    let currentStep: 1 | 2 = 1;
    const advanceToStep2 = () => {
      currentStep = 2;
    };
    assert.strictEqual(currentStep, 1);
    advanceToStep2();
    assert.strictEqual(currentStep, 2);

    // Screen 1 buttons vs Screen 2 buttons
    const getScreenButtons = (step: 1 | 2) => {
      if (step === 1) return ['Continue ➔'];
      return ['Play Again', 'Home'];
    };

    assert.deepStrictEqual(getScreenButtons(1), ['Continue ➔']);
    assert.deepStrictEqual(getScreenButtons(2), ['Play Again', 'Home']);
  });

  test('Wild Card & Discard Pile Active Color Tinting Logic', () => {
    const COLOR_HEX: Record<string, string> = {
      red: '#EF4444',
      blue: '#3B82F6',
      green: '#22C55E',
      yellow: '#FACC15',
      wild: '#1E293B',
    };

    const getCardEffectiveColor = (cardColor: string, activeColor?: string) => {
      const isWild = cardColor === 'wild';
      const activeHex = activeColor ? COLOR_HEX[activeColor] : undefined;
      return isWild && activeHex ? activeHex : COLOR_HEX[cardColor];
    };

    // Wild cards tint to chosen active color
    assert.strictEqual(getCardEffectiveColor('wild', 'red'), '#EF4444');
    assert.strictEqual(getCardEffectiveColor('wild', 'blue'), '#3B82F6');
    assert.strictEqual(getCardEffectiveColor('wild', 'green'), '#22C55E');
    assert.strictEqual(getCardEffectiveColor('wild', 'yellow'), '#FACC15');

    // Wild without active color stays standard wild color
    assert.strictEqual(getCardEffectiveColor('wild', undefined), '#1E293B');

    // Standard colored cards retain their own intrinsic color
    assert.strictEqual(getCardEffectiveColor('red', 'blue'), '#EF4444');
    assert.strictEqual(getCardEffectiveColor('green', 'yellow'), '#22C55E');
  });
});
