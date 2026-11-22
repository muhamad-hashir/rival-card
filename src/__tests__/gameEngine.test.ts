// src/__tests__/gameEngine.test.ts - Unit tests for Rival Card game engine
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDeck,
  shuffleDeck,
  isValidMove,
  isWildCard,
  isNumberCard,
  createGame,
  drawFromDeck,
  playCard,
  playPairCards,
  chooseWildColor,
  playerDrawCard,
  playerPassTurn,
  canPlayerCallRival,
  declareRival,
  catchRival,
  dismissPrivacyMask,
  makeBotMove,
  calculateNextPlayerIndex,
  getDominantColor,
  getCardSwapStrength,
  selectSwapTargetIndex,
  resolveDefenseWithShield,
  resolveDefenseWithMirror,
  resolveDefenseTakeHit,
  resolveBotPendingDefense,
} from '../gameEngine';
import type { Card, GameState, Player } from '../types';

describe('Deck Architecture & 112 Cards Distribution', () => {
  test('Deck contains exactly 112 cards', () => {
    const deck = generateDeck();
    assert.equal(deck.length, 112, `Expected 112 cards, got ${deck.length}`);
  });

  test('Deck has 76 number cards (4 zeros, 72 1-9 cards)', () => {
    const deck = generateDeck();
    const numberCards = deck.filter((c) => !isNaN(Number(c.value)));
    assert.equal(numberCards.length, 76, `Expected 76 number cards, got ${numberCards.length}`);

    const zeros = deck.filter((c) => c.value === '0');
    assert.equal(zeros.length, 4, 'Expected exactly 4 zero cards (1 per color)');

    for (let i = 1; i <= 9; i++) {
      const cardsOfVal = deck.filter((c) => c.value === String(i));
      assert.equal(cardsOfVal.length, 8, `Expected 8 of card value ${i} (2 per color)`);
    }
  });

  test('Deck has 24 standard action cards (8 Skips, 8 Reverses, 8 Draw2s)', () => {
    const deck = generateDeck();
    const skips = deck.filter((c) => c.value === 'skip');
    const reverses = deck.filter((c) => c.value === 'reverse');
    const draw2s = deck.filter((c) => c.value === 'draw2');

    assert.equal(skips.length, 8, 'Expected 8 Skip cards (2 per color)');
    assert.equal(reverses.length, 8, 'Expected 8 Reverse cards (2 per color)');
    assert.equal(draw2s.length, 8, 'Expected 8 Draw2 cards (2 per color)');
  });

  test('Deck has 12 Wild & Rival cards (2 Wild, 2 WildDraw4, 2 Mute, 2 RivalSwap, 2 Shield, 2 Mirror)', () => {
    const deck = generateDeck();
    const wilds = deck.filter((c) => c.value === 'wild');
    const wildDraw4s = deck.filter((c) => c.value === 'wild_draw4');
    const mutes = deck.filter((c) => c.value === 'mute');
    const rivalSwaps = deck.filter((c) => c.value === 'rival_swap');
    const shields = deck.filter((c) => c.value === 'shield');
    const mirrors = deck.filter((c) => c.value === 'mirror');

    assert.equal(wilds.length, 2, 'Expected 2 Wild cards');
    assert.equal(wildDraw4s.length, 2, 'Expected 2 WildDraw4 cards');
    assert.equal(mutes.length, 2, 'Expected 2 Mute cards');
    assert.equal(rivalSwaps.length, 2, 'Expected 2 RivalSwap cards');
    assert.equal(shields.length, 2, 'Expected 2 Shield cards');
    assert.equal(mirrors.length, 2, 'Expected 2 Mirror cards');

    // All wild suit cards must have color: 'wild'
    const wildSuit = deck.filter((c) => c.color === 'wild');
    assert.equal(wildSuit.length, 12, 'Expected 12 total cards with color wild');
  });

  test('Color breakdown: 25 Red, 25 Blue, 25 Green, 25 Yellow, 12 Wild', () => {
    const deck = generateDeck();
    const red = deck.filter((c) => c.color === 'red');
    const blue = deck.filter((c) => c.color === 'blue');
    const green = deck.filter((c) => c.color === 'green');
    const yellow = deck.filter((c) => c.color === 'yellow');
    const wild = deck.filter((c) => c.color === 'wild');

    assert.equal(red.length, 25);
    assert.equal(blue.length, 25);
    assert.equal(green.length, 25);
    assert.equal(yellow.length, 25);
    assert.equal(wild.length, 12);
    assert.equal(red.length + blue.length + green.length + yellow.length + wild.length, 112);
  });
});

describe('Fisher-Yates Shuffle Algorithm', () => {
  test('Shuffle maintains card count and uniqueness without mutating original', () => {
    const original = generateDeck();
    const shuffled = shuffleDeck(original);

    assert.equal(shuffled.length, original.length);
    assert.notStrictEqual(shuffled, original);

    const originalIds = new Set(original.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    assert.equal(originalIds.size, 112);
    assert.equal(shuffledIds.size, 112);

    // With 108 cards, probability of identical ordering is virtually zero
    const sameOrder = shuffled.every((c, i) => c.id === original[i].id);
    assert.equal(sameOrder, false, 'Shuffled deck should differ in ordering from original');
  });
});

describe('Top Card Validation (isValidMove)', () => {
  const red5: Card = { id: 'r5', color: 'red', value: '5', scoreValue: 5 };
  const redSkip: Card = { id: 'rsk', color: 'red', value: 'skip', scoreValue: 20 };
  const blue5: Card = { id: 'b5', color: 'blue', value: '5', scoreValue: 5 };
  const green9: Card = { id: 'g9', color: 'green', value: '9', scoreValue: 9 };
  const wildCard: Card = { id: 'w1', color: 'wild', value: 'wild', scoreValue: 50 };
  const wildDraw4: Card = { id: 'wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 };
  const muteCard: Card = { id: 'mu', color: 'wild', value: 'mute', scoreValue: 50 };
  const rivalSwap: Card = { id: 'rs', color: 'wild', value: 'rival_swap', scoreValue: 50 };

  test('Allows match by color', () => {
    assert.equal(isValidMove(redSkip, red5, 'red'), true);
  });

  test('Allows match by value', () => {
    assert.equal(isValidMove(blue5, red5, 'red'), true);
  });

  test('Allows any Wild/Rival card on any top card', () => {
    assert.equal(isValidMove(wildCard, green9, 'green'), true);
    assert.equal(isValidMove(wildDraw4, green9, 'green'), true);
    assert.equal(isValidMove(muteCard, green9, 'green'), true);
    assert.equal(isValidMove(rivalSwap, green9, 'green'), true);
  });

  test('Rejects non-matching color and non-matching value', () => {
    assert.equal(isValidMove(green9, red5, 'red'), false);
  });

  test('Respects activeColor when wild was previously played', () => {
    // Discard top card was a wild card, but active color was declared as yellow
    assert.equal(isValidMove({ id: 'y3', color: 'yellow', value: '3', scoreValue: 3 }, wildCard, 'yellow'), true);
    assert.equal(isValidMove({ id: 'b3', color: 'blue', value: '3', scoreValue: 3 }, wildCard, 'yellow'), false);
  });
});

describe('Turn Rotation State Management', () => {
  test('Calculates forward and backward rotations correctly', () => {
    assert.equal(calculateNextPlayerIndex(0, 1, 4, 1), 1);
    assert.equal(calculateNextPlayerIndex(3, 1, 4, 1), 0);
    assert.equal(calculateNextPlayerIndex(0, -1, 4, 1), 3);
    assert.equal(calculateNextPlayerIndex(1, -1, 4, 1), 0);
  });

  test('Calculates skips (step = 2) correctly', () => {
    assert.equal(calculateNextPlayerIndex(0, 1, 4, 2), 2);
    assert.equal(calculateNextPlayerIndex(3, 1, 4, 2), 1);
    assert.equal(calculateNextPlayerIndex(0, -1, 4, 2), 2);
    assert.equal(calculateNextPlayerIndex(1, -1, 4, 2), 3);
  });
});

describe('Game Initialization & Hand Dealing', () => {
  test('Deals 7 cards to each player and sets non-wild top card', () => {
    const game = createGame([
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
    ]);

    assert.equal(game.players.length, 3);

    // Each player starts with at least 7 cards.
    // If the initial top card is a Draw2, the first player gets 7+2=9 cards.
    // Validate minimum hand size and total card conservation.
    for (const player of game.players) {
      assert.ok(player.hand.length >= 7, `${player.name} should have at least 7 cards (got ${player.hand.length})`);
    }

    assert.equal(game.discardPile.length, 1);
    assert.equal(isWildCard(game.discardPile[0]), false, 'Top card must be non-wild at start');
    assert.equal(game.activeColor, game.discardPile[0].color);
    assert.equal(game.isGameOver, false);
    assert.equal(game.winner, null);

    // Total cards accounted for: sum of all player hands + discard pile + deck = 112
    const totalPlayerCards = game.players.reduce((sum, p) => sum + p.hand.length, 0);
    assert.equal(totalPlayerCards + game.discardPile.length + game.deck.length, 112,
      `Total card conservation: ${totalPlayerCards} in hands + ${game.discardPile.length} discard + ${game.deck.length} deck = ${totalPlayerCards + game.discardPile.length + game.deck.length}`
    );
  });
});

describe('Action Cards Mechanics', () => {
  function makeMockGame(playersCount = 3): GameState {
    const players: Player[] = [];
    for (let i = 0; i < playersCount; i++) {
      players.push({
        id: `p${i}`,
        name: `Player ${i}`,
        isBot: false,
        hand: [
          { id: `c_p${i}_1`, color: 'red', value: '1', scoreValue: 1 },
          { id: `c_p${i}_2`, color: 'blue', value: '2', scoreValue: 2 },
        ],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      });
    }

    return {
      deck: [
        { id: 'deck1', color: 'green', value: '3', scoreValue: 3 },
        { id: 'deck2', color: 'green', value: '4', scoreValue: 4 },
        { id: 'deck3', color: 'yellow', value: '5', scoreValue: 5 },
        { id: 'deck4', color: 'yellow', value: '6', scoreValue: 6 },
      ],
      discardPile: [{ id: 'top0', color: 'red', value: '9', scoreValue: 9 }],
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
    };
  }

  test('Skip card skips the next player', () => {
    let state = makeMockGame(3);
    const skipCard: Card = { id: 'skip1', color: 'red', value: 'skip', scoreValue: 20 };
    state.players[0].hand.push(skipCard);

    state = playCard(state, 'p0', 'skip1');
    assert.equal(state.currentTurnIndex, 2, 'Player 1 should be skipped, so turn goes to Player 2');
  });

  test('Reverse in 3-player game flips direction', () => {
    let state = makeMockGame(3);
    const revCard: Card = { id: 'rev1', color: 'red', value: 'reverse', scoreValue: 20 };
    state.players[0].hand.push(revCard);

    state = playCard(state, 'p0', 'rev1');
    assert.equal(state.direction, -1, 'Direction should become -1');
    assert.equal(state.currentTurnIndex, 2, 'In reverse from 0, turn goes to 2');
  });

  test('Reverse in 2-player game acts as Skip and flips direction', () => {
    let state = makeMockGame(2);
    const revCard: Card = { id: 'rev1', color: 'red', value: 'reverse', scoreValue: 20 };
    state.players[0].hand.push(revCard);

    state = playCard(state, 'p0', 'rev1');
    assert.equal(state.currentTurnIndex, 0, 'Player 1 skipped, so Player 0 goes again');
    assert.equal(state.direction, -1, 'Direction flips visually/logically even in 2-player games');

    const revCard2: Card = { id: 'rev2', color: 'red', value: 'reverse', scoreValue: 20 };
    state.players[0].hand.push(revCard2);
    state = playCard(state, 'p0', 'rev2');
    assert.equal(state.direction, 1, 'Second Reverse flips direction back to clockwise (1)');
  });

  test('Draw2 forces next player to draw 2 cards and skips them', () => {
    let state = makeMockGame(3);
    const draw2Card: Card = { id: 'd2', color: 'red', value: 'draw2', scoreValue: 20 };
    state.players[0].hand.push(draw2Card);
    const initialP1HandSize = state.players[1].hand.length;

    state = playCard(state, 'p0', 'd2');
    assert.equal(state.players[1].hand.length, initialP1HandSize + 2, 'Player 1 should have 2 extra cards');
    assert.equal(state.currentTurnIndex, 2, 'Player 1 turn should be skipped, advancing to Player 2');
  });

  test('WildDraw4 forces next player to draw 4 cards, changes color, and skips them', () => {
    let state = makeMockGame(3);
    const wd4Card: Card = { id: 'wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 };
    state.players[0].hand.push(wd4Card);
    const initialP1HandSize = state.players[1].hand.length;

    state = playCard(state, 'p0', 'wd4', { chosenColor: 'blue' });
    assert.equal(state.activeColor, 'blue');
    assert.equal(state.players[1].hand.length, initialP1HandSize + 4);
    assert.equal(state.currentTurnIndex, 2);
  });

  test('Mute card mutes targeted player and skips their turn', () => {
    let state = makeMockGame(3);
    const muteCard: Card = { id: 'mute1', color: 'wild', value: 'mute', scoreValue: 50 };
    state.players[0].hand.push(muteCard);

    state = playCard(state, 'p0', 'mute1', { chosenColor: 'yellow', targetPlayerId: 'p1' });
    assert.equal(state.activeColor, 'yellow');
    assert.equal(state.players[1].isMuted, true, 'Player 1 should be muted');
    assert.equal(state.currentTurnIndex, 2, 'Player 1 turn was skipped, so turn goes to Player 2');
  });

  test('RivalSwap card swaps hand with opponent with fewest cards', () => {
    let state = makeMockGame(3);
    // Player 0 has 5 cards
    state.players[0].hand = [
      { id: 'rs1', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'c2', color: 'red', value: '2', scoreValue: 2 },
      { id: 'c3', color: 'red', value: '3', scoreValue: 3 },
      { id: 'c4', color: 'red', value: '4', scoreValue: 4 },
      { id: 'c5', color: 'red', value: '5', scoreValue: 5 },
    ];
    // Player 1 has 4 cards
    state.players[1].hand = [
      { id: 'p1_1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'p1_2', color: 'blue', value: '2', scoreValue: 2 },
      { id: 'p1_3', color: 'blue', value: '3', scoreValue: 3 },
      { id: 'p1_4', color: 'blue', value: '4', scoreValue: 4 },
    ];
    // Player 2 has 1 card (FEWEST!)
    state.players[2].hand = [{ id: 'p2_solo', color: 'green', value: '7', scoreValue: 7 }];

    state = playCard(state, 'p0', 'rs1', { chosenColor: 'green' });

    // After playing rs1, Player 0's hand had 4 cards remaining, which got swapped with Player 2's 1 card!
    assert.equal(state.players[0].hand.length, 1, 'Player 0 should now have Player 2 single card');
    assert.equal(state.players[0].hand[0].id, 'p2_solo');
    assert.equal(state.players[2].hand.length, 4, 'Player 2 should now have Player 0 previous cards');
  });
});

describe('Deck Reshuffle When Empty', () => {
  test('Reshuffles discard pile cards (excluding top card) into draw deck', () => {
    const topCard: Card = { id: 'top', color: 'red', value: '5', scoreValue: 5 };
    const oldDiscard1: Card = { id: 'd1', color: 'blue', value: '1', scoreValue: 1 };
    const oldDiscard2: Card = { id: 'd2', color: 'green', value: '2', scoreValue: 2 };
    const oldDiscard3: Card = { id: 'd3', color: 'yellow', value: '3', scoreValue: 3 };

    const emptyDeck: Card[] = [];
    const discardPile = [oldDiscard1, oldDiscard2, oldDiscard3, topCard];

    const result = drawFromDeck(emptyDeck, discardPile, 2);
    assert.equal(result.drawnCards.length, 2);
    assert.equal(result.didReshuffle, true);
    assert.equal(result.remainingDiscard.length, 1);
    assert.equal(result.remainingDiscard[0].id, 'top', 'Top card must remain on discard pile');
    assert.equal(result.remainingDeck.length, 1);
  });
});

describe('Pass-and-Play Screen Masking', () => {
  test('Activates privacy mask for next human player in pass_and_play mode', () => {
    const game = createGame(
      [
        { id: 'h1', name: 'Player 1', isBot: false },
        { id: 'h2', name: 'Player 2', isBot: false },
      ],
      'pass_and_play'
    );

    // Privacy mask should be active for Player 1 initially
    assert.equal(game.privacyMask.isActive, true);
    assert.equal(game.privacyMask.targetPlayerId, game.players[game.currentTurnIndex].id);

    // Dismiss privacy mask
    const unmasked = dismissPrivacyMask(game);
    assert.equal(unmasked.privacyMask.isActive, false);
  });
});

describe('RIVAL! Declaration and Catch Mechanics', () => {
  test('Player declares RIVAL! successfully', () => {
    let game = createGame([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ]);
    game = declareRival(game, 'p1');
    assert.equal(game.players.find((p) => p.id === 'p1')?.hasDeclaredRival, true);
  });

  test('Catching player with 1 card who forgot to declare RIVAL! gives 2 penalty cards', () => {
    let game = createGame([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ]);
    // Force P1 to have 1 card without declaring RIVAL
    game.players[0].hand = [{ id: 'solo', color: 'red', value: '1', scoreValue: 1 }];
    game.players[0].hasDeclaredRival = false;

    game = catchRival(game, 'p2', 'p1');
    assert.equal(game.players[0].hand.length, 3, 'P1 should receive 2 penalty cards');
  });

  test('Cannot catch player who already declared RIVAL!', () => {
    let game = createGame([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ]);
    game.players[0].hand = [{ id: 'solo', color: 'red', value: '1', scoreValue: 1 }];
    game.players[0].hasDeclaredRival = true;

    game = catchRival(game, 'p2', 'p1');
    assert.equal(game.players[0].hand.length, 1, 'P1 hand should remain 1 because RIVAL was declared');
  });

  test('canPlayerCallRival is strictly enabled only when player has 2 cards on their turn', () => {
    assert.equal(canPlayerCallRival(2, false, true, false, false), true);
    assert.equal(canPlayerCallRival(7, false, true, false, false), false);
    assert.equal(canPlayerCallRival(3, false, true, false, false), false);
    assert.equal(canPlayerCallRival(1, false, true, false, false), false);
    assert.equal(canPlayerCallRival(2, true, true, false, false), false);
    assert.equal(canPlayerCallRival(2, false, false, false, false), false);
    assert.equal(canPlayerCallRival(2, false, true, true, false), false);
    assert.equal(canPlayerCallRival(2, false, true, false, true), false);
  });

  test('Drawing a card resets hasDeclaredRival so RIVAL! must be pressed again every time player reaches 2 cards', () => {
    let game = createGame([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ]);
    game.discardPile = [{ id: 'top_r5', color: 'red', value: '5', scoreValue: 5 }];
    game.activeColor = 'red';
    game.deck = [{ id: 'draw_b9', color: 'blue', value: '9', scoreValue: 9 }];
    game.players[0].hand = [
      { id: 'p1_r5', color: 'red', value: '8', scoreValue: 8 },
      { id: 'p1_g2', color: 'green', value: '2', scoreValue: 2 },
    ];
    game.players[0].hasDeclaredRival = false;

    // 1. At 2 cards, player presses RIVAL! and plays down to 1 card
    game = declareRival(game, 'p1');
    assert.equal(game.players[0].hasDeclaredRival, true);
    game = playCard(game, 'p1', 'p1_r5');
    assert.equal(game.players[0].hand.length, 1);
    assert.equal(game.players[0].hasDeclaredRival, true);

    // 2. Opponent plays, returning turn to P1
    game.players[1].hand = [
      { id: 'p2_r7', color: 'red', value: '7', scoreValue: 7 },
      { id: 'p2_b7', color: 'blue', value: '7', scoreValue: 7 },
    ];
    game = playCard(game, 'p2', 'p2_r7');

    // 3. P1 cannot play green 2 on red 7, so P1 draws back up to 2 cards
    game = playerDrawCard(game, 'p1');
    assert.equal(game.players[0].hand.length, 2);
    assert.equal(game.players[0].hasDeclaredRival, false, 'Drawing up to 2 cards must reset hasDeclaredRival');
    assert.equal(
      canPlayerCallRival(game.players[0].hand.length, game.players[0].hasDeclaredRival, true, false, false),
      true,
      'RIVAL! button must be clickable again whenever player holds 2 cards'
    );
  });
});

describe('Shield & Mirror Wild + Reactive Defense Mechanics', () => {
  function makeDefenseTestGame(playersCount = 3): GameState {
    const players: Player[] = [];
    for (let i = 0; i < playersCount; i++) {
      players.push({
        id: `p${i}`,
        name: `Player ${i}`,
        isBot: false,
        hand: [],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      });
    }

    return {
      deck: [
        { id: 'dk1', color: 'red', value: '1', scoreValue: 1 },
        { id: 'dk2', color: 'blue', value: '2', scoreValue: 2 },
        { id: 'dk3', color: 'green', value: '3', scoreValue: 3 },
        { id: 'dk4', color: 'yellow', value: '4', scoreValue: 4 },
        { id: 'dk5', color: 'red', value: '5', scoreValue: 5 },
        { id: 'dk6', color: 'blue', value: '6', scoreValue: 6 },
        { id: 'dk7', color: 'green', value: '7', scoreValue: 7 },
        { id: 'dk8', color: 'yellow', value: '8', scoreValue: 8 },
      ],
      discardPile: [{ id: 'top0', color: 'red', value: '9', scoreValue: 9 }],
      players,
      currentTurnIndex: 0,
      direction: 1,
      activeColor: 'red',
      winner: null,
      isGameOver: false,
      gameMode: 'multiplayer',
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
      lastActionTimestamp: Date.now(),
      pendingDrawCount: 0,
      allowStacking: true,
      pendingDefense: null,
      lastDefenseBanner: null,
      turnCount: 1,
    };
  }

  test('1. Active Play: Shield and Mirror work as Wild color-changers on your own turn (including winning)', () => {
    const shieldCard: Card = { id: 'sh1', color: 'wild', value: 'shield', scoreValue: 50 };
    const mirrorCard: Card = { id: 'mi1', color: 'wild', value: 'mirror', scoreValue: 50 };

    assert.equal(isWildCard(shieldCard), true);
    assert.equal(isWildCard(mirrorCard), true);
    assert.equal(getCardSwapStrength(shieldCard), 45);
    assert.equal(getCardSwapStrength(mirrorCard), 45);

    let state = makeDefenseTestGame(2);
    state.players[0].hand = [
      shieldCard,
      { id: 'p0_r2', color: 'red', value: '2', scoreValue: 2 },
    ];
    state.players[1].hand = [
      mirrorCard,
      { id: 'p1_y3', color: 'yellow', value: '3', scoreValue: 3 },
    ];

    // P0 plays Shield as Wild and picks Blue
    state = playCard(state, 'p0', 'sh1', { chosenColor: 'blue' });
    assert.equal(state.activeColor, 'blue');
    assert.equal(state.currentTurnIndex, 1);
    assert.equal(state.pendingDefense, null);

    // P1 plays Mirror as Wild and picks Green
    state = playCard(state, 'p1', 'mi1', { chosenColor: 'green' });
    assert.equal(state.activeColor, 'green');
    assert.equal(state.currentTurnIndex, 0);

    // P0 plays final Shield card to win immediately
    let winState = makeDefenseTestGame(2);
    winState.players[0].hand = [{ id: 'sh_last', color: 'wild', value: 'shield', scoreValue: 50 }];
    winState.players[1].hand = [{ id: 'p1_r1', color: 'red', value: '1', scoreValue: 1 }];
    winState = playCard(winState, 'p0', 'sh_last');
    assert.equal(winState.isGameOver, true);
    assert.equal(winState.winner?.id, 'p0');
  });

  test('2. Reactive Shield blocks +2 and stacked +4 penalties completely while preserving activeColor', () => {
    // Subcase A: Shield blocks +2
    let state = makeDefenseTestGame(3);
    state.players[0].hand = [
      { id: 'p0_d2', color: 'red', value: 'draw2', scoreValue: 20 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    state.players[1].hand = [
      { id: 'p1_sh', color: 'wild', value: 'shield', scoreValue: 50 },
      { id: 'p1_b5', color: 'blue', value: '5', scoreValue: 5 },
    ];
    state.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    state = playCard(state, 'p0', 'p0_d2');
    assert.ok(state.pendingDefense, 'pendingDefense must open for P1 holding Shield');
    assert.equal(state.pendingDefense?.attackType, 'draw2');
    assert.equal(state.pendingDefense?.drawPenalty, 2);

    state = resolveDefenseWithShield(state, 'p1');
    assert.equal(state.pendingDefense, null);
    assert.equal(state.pendingDrawCount, 0);
    assert.equal(state.activeColor, 'red', 'Active color must stay intact after Shield block');
    assert.equal(state.players[1].hand.length, 1, 'Shield consumed, 0 penalty cards drawn');
    assert.equal(state.currentTurnIndex, 1, 'Turn advances cleanly to P1');
    assert.ok(state.lastDefenseBanner?.message.includes('blocked +2 with Shield'));

    // Subcase B: Shield blocks stacked +6 (or +4) completely
    let stackState = makeDefenseTestGame(3);
    stackState.pendingDrawCount = 4;
    stackState.discardPile = [{ id: 'top_d2', color: 'red', value: 'draw2', scoreValue: 20 }];
    stackState.activeColor = 'yellow';
    stackState.players[0].hand = [
      { id: 'p0_d2_stack', color: 'yellow', value: 'draw2', scoreValue: 20 },
      { id: 'p0_y2', color: 'yellow', value: '2', scoreValue: 2 },
    ];
    stackState.players[1].hand = [
      { id: 'p1_sh', color: 'wild', value: 'shield', scoreValue: 50 },
      { id: 'p1_g3', color: 'green', value: '3', scoreValue: 3 },
    ];
    stackState.players[2].hand = [{ id: 'p2_b1', color: 'blue', value: '1', scoreValue: 1 }];

    stackState = playCard(stackState, 'p0', 'p0_d2_stack');
    assert.equal(stackState.pendingDefense?.drawPenalty, 6);

    stackState = resolveDefenseWithShield(stackState, 'p1');
    assert.equal(stackState.pendingDefense, null);
    assert.equal(stackState.pendingDrawCount, 0);
    assert.equal(stackState.activeColor, 'yellow');
    assert.equal(stackState.players[1].hand.length, 1);
    assert.ok(stackState.lastDefenseBanner?.message.includes('blocked +6 with Shield'));
  });

  test('3. Reactive Mirror reflects +4, Skip, Mute, and Rival Swap back onto the attacker', () => {
    // A: Mirror reflects +4
    let wd4State = makeDefenseTestGame(3);
    wd4State.players[0].hand = [
      { id: 'p0_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    wd4State.players[1].hand = [
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p1_b2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    wd4State.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    wd4State = playCard(wd4State, 'p0', 'p0_wd4', { chosenColor: 'green' });
    assert.equal(wd4State.pendingDefense?.attackType, 'wild_draw4');
    wd4State = resolveDefenseWithMirror(wd4State, 'p1');
    assert.equal(wd4State.pendingDefense, null);
    assert.equal(wd4State.activeColor, 'green', 'Active color stays Green without new color picker');
    assert.equal(wd4State.players[0].hand.length, 5, 'Attacker P0 drew 4 reflected cards (1 + 4)');
    assert.equal(wd4State.players[1].hand.length, 1, 'Defender P1 spent Mirror and drew 0 cards');

    // B: Mirror reflects Skip back onto attacker (so Defender P1 gets to play instead of being skipped)
    let skipState = makeDefenseTestGame(3);
    skipState.players[0].hand = [
      { id: 'p0_sk', color: 'red', value: 'skip', scoreValue: 20 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    skipState.players[1].hand = [
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p1_b2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    skipState.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    skipState = playCard(skipState, 'p0', 'p0_sk');
    skipState = resolveDefenseWithMirror(skipState, 'p1');
    assert.equal(skipState.currentTurnIndex, 1, 'P0 skip reflected, so turn moves to P1');

    // C: Mirror reflects Mute back onto attacker
    let muteState = makeDefenseTestGame(3);
    muteState.players[0].hand = [
      { id: 'p0_mu', color: 'wild', value: 'mute', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    muteState.players[1].hand = [
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p1_b2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    muteState.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    muteState = playCard(muteState, 'p0', 'p0_mu', { chosenColor: 'blue' });
    muteState = resolveDefenseWithMirror(muteState, 'p1');
    assert.equal(muteState.players[0].isMuted, true, 'Attacker P0 is muted by Mirror reflection');
    assert.equal(muteState.players[1].isMuted, false, 'Defender P1 is not muted');

    // D: Mirror reflects Rival Swap back onto attacker (blocks swap so Defender keeps their small hand)
    let swapState = makeDefenseTestGame(3);
    swapState.players[0].hand = [
      { id: 'p0_rs', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
      { id: 'p0_r2', color: 'red', value: '2', scoreValue: 2 },
      { id: 'p0_r3', color: 'red', value: '3', scoreValue: 3 },
    ];
    swapState.players[1].hand = [
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p1_g7', color: 'green', value: '7', scoreValue: 7 },
    ];
    swapState.players[2].hand = [
      { id: 'p2_1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'p2_2', color: 'blue', value: '2', scoreValue: 2 },
      { id: 'p2_3', color: 'blue', value: '3', scoreValue: 3 },
    ];

    swapState = playCard(swapState, 'p0', 'p0_rs', { chosenColor: 'yellow' });
    assert.equal(swapState.pendingDefense?.attackType, 'rival_swap');
    assert.equal(swapState.pendingDefense?.targetIndex, 1);
    swapState = resolveDefenseWithMirror(swapState, 'p1');
    assert.deepEqual(swapState.players[1].hand.map((c) => c.id), ['p1_g7']);
    assert.deepEqual(swapState.players[0].hand.map((c) => c.id), ['p0_r1', 'p0_r2', 'p0_r3']);
  });

  test('4. Counter-Mirror bounce: +4 -> Mirror -> Counter-Mirror resolves +4 onto defender and spends both Mirrors', () => {
    let state = makeDefenseTestGame(3);
    state.players[0].hand = [
      { id: 'p0_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'p0_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    state.players[1].hand = [
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
      { id: 'p1_b2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    state.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    // Attacker P0 plays +4 -> Defense window opens for P1
    state = playCard(state, 'p0', 'p0_wd4', { chosenColor: 'blue' });
    assert.equal(state.pendingDefense?.targetIndex, 1);
    assert.equal(state.pendingDefense?.mirrorBounceCount, 0);

    // Defender P1 uses Mirror -> Counter-Mirror window (mirrorBounceCount: 1) opens for P0
    state = resolveDefenseWithMirror(state, 'p1');
    assert.ok(state.pendingDefense, 'Counter-Mirror window must open for Attacker P0 holding Mirror');
    assert.equal(state.pendingDefense?.targetIndex, 0);
    assert.equal(state.pendingDefense?.mirrorBounceCount, 1);
    assert.equal(state.players[1].hand.some((c) => c.value === 'mirror'), false, 'P1 Mirror consumed');

    // Attacker P0 uses Counter-Mirror -> no further bounce allowed, P1 draws 4 cards
    state = resolveDefenseWithMirror(state, 'p0');
    assert.equal(state.pendingDefense, null, 'No further bounce allowed after Counter-Mirror');
    assert.equal(state.players[0].hand.some((c) => c.value === 'mirror'), false, 'P0 Mirror consumed');
    assert.equal(state.players[0].hand.length, 1, 'P0 keeps only p0_r1');
    assert.equal(state.players[1].hand.length, 5, 'Original defender P1 draws 4 cards (1 + 4)');
    assert.equal(state.currentTurnIndex, 2, 'P1 skipped by +4, turn moves to P2');
    assert.ok(state.lastDefenseBanner?.message.includes('Counter-Mirrored'));
  });

  test('5. Letting 3s defense timer expire (Take Hit) applies penalty normally while keeping Shield/Mirror in hand', () => {
    let state = makeDefenseTestGame(3);
    state.players[0].hand = [
      { id: 'p0_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    state.players[1].hand = [
      { id: 'p1_sh', color: 'wild', value: 'shield', scoreValue: 50 },
      { id: 'p1_mi', color: 'wild', value: 'mirror', scoreValue: 50 },
    ];
    state.players[2].hand = [{ id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 }];

    state = playCard(state, 'p0', 'p0_wd4', { chosenColor: 'red' });
    assert.ok(state.pendingDefense);

    // Timeout / Take Hit
    state = resolveDefenseTakeHit(state, 'p1');
    assert.equal(state.pendingDefense, null);
    assert.equal(state.players[1].hand.length, 6, 'P1 takes +4 cards on Take Hit / expiry (2 + 4)');
    assert.equal(state.players[1].hand.some((c) => c.value === 'shield'), true, 'Shield remains in hand');
    assert.equal(state.players[1].hand.some((c) => c.value === 'mirror'), true, 'Mirror remains in hand');
    assert.equal(state.currentTurnIndex, 2, 'P1 skipped, turn advances to P2');

    // Bot AI auto-defense test: bot blocks +2 with Shield cleanly
    let botState = makeDefenseTestGame(2);
    botState.players[1].isBot = true;
    botState.players[0].hand = [
      { id: 'p0_d2', color: 'red', value: 'draw2', scoreValue: 20 },
      { id: 'p0_r5', color: 'red', value: '5', scoreValue: 5 },
    ];
    botState.players[1].hand = [
      { id: 'bot_sh', color: 'wild', value: 'shield', scoreValue: 50 },
      { id: 'bot_b1', color: 'blue', value: '1', scoreValue: 1 },
    ];
    botState = playCard(botState, 'p0', 'p0_d2');
    assert.ok(botState.pendingDefense);
    botState = resolveBotPendingDefense(botState);
    assert.equal(botState.pendingDefense, null);
    assert.equal(botState.players[1].hand.length, 1, 'Bot spent Shield and took 0 cards');
  });
});

describe('Bot AI Engine (makeBotMove)', () => {
  test('Bot plays a valid card from hand', () => {
    const botHand: Card[] = [
      { id: 'b_red7', color: 'red', value: '7', scoreValue: 7 },
      { id: 'b_blue2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    let state = createGame([
      { id: 'human', name: 'Human', isBot: false },
      { id: 'bot', name: 'Bot', isBot: true },
    ]);

    state.players[1].hand = botHand;
    state.discardPile = [{ id: 'top', color: 'red', value: '3', scoreValue: 3 }];
    state.activeColor = 'red';
    state.currentTurnIndex = 1; // Bot turn

    const nextState = makeBotMove(state);
    assert.equal(nextState.players[1].hand.length, 1);
    assert.equal(nextState.discardPile[nextState.discardPile.length - 1].value, '7');
  });

  test('Bot draws from deck and plays if drawn card is playable', () => {
    const unplayableHand: Card[] = [
      { id: 'b_yellow2', color: 'yellow', value: '2', scoreValue: 2 },
    ];
    let state = createGame([
      { id: 'human', name: 'Human', isBot: false },
      { id: 'bot', name: 'Bot', isBot: true },
    ]);

    state.players[1].hand = unplayableHand;
    state.discardPile = [{ id: 'top', color: 'red', value: '3', scoreValue: 3 }];
    state.activeColor = 'red';
    state.currentTurnIndex = 1;
    // Set top of deck to be a playable red 9
    state.deck = [{ id: 'draw_red9', color: 'red', value: '9', scoreValue: 9 }];

    const nextState = makeBotMove(state);
    // Bot should draw and immediately play the red 9
    assert.equal(nextState.discardPile[nextState.discardPile.length - 1].id, 'draw_red9');
  });

  test('Bot picks dominant color when playing wild card', () => {
    const handWithWild: Card[] = [
      { id: 'wild_c', color: 'wild', value: 'wild', scoreValue: 50 },
      { id: 'b1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'b2', color: 'blue', value: '2', scoreValue: 2 },
      { id: 'b3', color: 'blue', value: '3', scoreValue: 3 },
      { id: 'g1', color: 'green', value: '4', scoreValue: 4 },
    ];

    assert.equal(getDominantColor(handWithWild.slice(1)), 'blue');
  });
});

describe('Win Condition Detection', () => {
  test('Game ends and winner is declared when player plays their last card', () => {
    let state = createGame([
      { id: 'p1', name: 'Player 1' },
      { id: 'p2', name: 'Player 2' },
    ]);

    const lastCard: Card = { id: 'win_card', color: 'red', value: '5', scoreValue: 5 };
    state.players[0].hand = [lastCard];
    state.discardPile = [{ id: 'top', color: 'red', value: '1', scoreValue: 1 }];
    state.activeColor = 'red';
    state.currentTurnIndex = 0;

    const endState = playCard(state, 'p1', 'win_card');
    assert.equal(endState.isGameOver, true);
    assert.equal(endState.winner?.id, 'p1');
    assert.equal(endState.players[0].hand.length, 0);
  });
});

describe('1v1 Action Cards & Consecutive Turn Transitions', () => {
  test('Skip card in 1v1 mode retains turn index, increments turnCount, and updates timestamp', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'You', isBot: false },
        { id: 'bot1', name: 'RivalBot', isBot: true },
      ],
      'vs_bot'
    );

    // Set turn to bot
    state.currentTurnIndex = 1;
    state.players[0].hand = [
      { id: 'h1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'h2', color: 'green', value: '4', scoreValue: 4 },
    ];
    const initialTurnCount = state.turnCount;
    const initialTimestamp = state.lastActionTimestamp || 0;

    const skipCard: Card = { id: 'bot_skip', color: 'red', value: 'skip', scoreValue: 20 };
    state.players[1].hand = [skipCard, { id: 'bot_c2', color: 'red', value: '5', scoreValue: 5 }];
    state.discardPile = [{ id: 'top_card', color: 'red', value: '2', scoreValue: 2 }];
    state.activeColor = 'red';

    const nextState = playCard(state, 'bot1', 'bot_skip');

    // Turn index returns to bot because in 1v1 (2 players), skip advances by 2: (1 + 2) % 2 = 1
    assert.equal(nextState.currentTurnIndex, 1, 'Turn should remain with bot in 1v1 after Skip');
    assert.equal(nextState.turnCount, initialTurnCount + 1, 'turnCount must increment');
    assert.ok(
      (nextState.lastActionTimestamp || 0) >= initialTimestamp,
      'lastActionTimestamp must update'
    );

    // Verify grammatical log message
    const latestLog = nextState.logs[nextState.logs.length - 1];
    assert.equal(latestLog.message, 'You were skipped!');
  });

  test('Reverse card in 1v1 mode acts as Skip and updates turn counter and timestamp', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'You', isBot: false },
        { id: 'bot1', name: 'RivalBot', isBot: true },
      ],
      'vs_bot'
    );

    state.currentTurnIndex = 1;
    const initialTurnCount = state.turnCount;

    const revCard: Card = { id: 'bot_rev', color: 'green', value: 'reverse', scoreValue: 20 };
    state.players[1].hand = [revCard, { id: 'bot_c2', color: 'green', value: '7', scoreValue: 7 }];
    state.discardPile = [{ id: 'top_card', color: 'green', value: '1', scoreValue: 1 }];
    state.activeColor = 'green';

    const nextState = playCard(state, 'bot1', 'bot_rev');

    assert.equal(nextState.currentTurnIndex, 1, 'Turn should remain with bot in 1v1 after Reverse');
    assert.equal(nextState.turnCount, initialTurnCount + 1);
    assert.ok(nextState.lastActionTimestamp);

    const latestLog = nextState.logs[nextState.logs.length - 1];
    assert.equal(latestLog.message, 'Reverse card skipped you!');
  });

  test('Draw2 in 1v1 forces opponent to draw and returns turn to player', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'You', isBot: false },
        { id: 'bot1', name: 'RivalBot', isBot: true },
      ],
      'vs_bot'
    );

    state.currentTurnIndex = 1;
    state.players[0].hand = [
      { id: 'h1', color: 'red', value: '1', scoreValue: 1 },
      { id: 'h2', color: 'green', value: '4', scoreValue: 4 },
    ];
    const initialHumanCards = state.players[0].hand.length;
    const initialTurnCount = state.turnCount;

    const d2Card: Card = { id: 'bot_d2', color: 'blue', value: 'draw2', scoreValue: 20 };
    state.players[1].hand = [d2Card, { id: 'bot_c2', color: 'blue', value: '3', scoreValue: 3 }];
    state.discardPile = [{ id: 'top_card', color: 'blue', value: '8', scoreValue: 8 }];
    state.activeColor = 'blue';

    const nextState = playCard(state, 'bot1', 'bot_d2');

    assert.equal(nextState.currentTurnIndex, 1, 'Turn returns to bot in 1v1 after Draw2');
    assert.equal(nextState.players[0].hand.length, initialHumanCards + 2);
    assert.equal(nextState.turnCount, initialTurnCount + 1);
    assert.ok(nextState.lastActionTimestamp);
  });

  test('Bot automatically executes consecutive move after playing Skip in 1v1', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'You', isBot: false },
        { id: 'bot1', name: 'RivalBot', isBot: true },
      ],
      'vs_bot'
    );

    state.currentTurnIndex = 1;
    state.players[0].hand = [
      { id: 'h1', color: 'blue', value: '2', scoreValue: 2 },
      { id: 'h2', color: 'red', value: '7', scoreValue: 7 },
    ];
    const skipCard: Card = { id: 'bot_skip', color: 'yellow', value: 'skip', scoreValue: 20 };
    const numCard: Card = { id: 'bot_num', color: 'yellow', value: '4', scoreValue: 4 };
    state.players[1].hand = [skipCard, numCard];
    state.discardPile = [{ id: 'top_card', color: 'yellow', value: '1', scoreValue: 1 }];
    state.activeColor = 'yellow';

    // Step 1: Bot plays Skip card
    const stateAfterSkip = makeBotMove(state);
    assert.equal(stateAfterSkip.currentTurnIndex, 1, 'Bot retains turn after 1v1 Skip');
    assert.equal(stateAfterSkip.discardPile[stateAfterSkip.discardPile.length - 1].value, 'skip');

    // Step 2: Consecutive bot move executes cleanly without error
    const stateAfterSecondMove = makeBotMove(stateAfterSkip);
    assert.equal(
      stateAfterSecondMove.discardPile[stateAfterSecondMove.discardPile.length - 1].value,
      '4'
    );
    // Since bot played its last card, game should be won by bot
    assert.equal(stateAfterSecondMove.isGameOver, true);
    assert.equal(stateAfterSecondMove.winner?.id, 'bot1');
  });

  test('Starting discard card is strictly a standard numbered card (0-9) across repeated deals', () => {
    for (let i = 0; i < 40; i++) {
      const game = createGame(
        [
          { id: 'p1', name: 'Player 1', isBot: false },
          { id: 'p2', name: 'Player 2', isBot: false },
        ],
        'multiplayer'
      );
      const topCard = game.discardPile[game.discardPile.length - 1];
      assert.equal(game.discardPile.length, 1);
      assert.equal(
        isNumberCard(topCard),
        true,
        `Expected starting discard card to be 0-9 number card, got ${topCard.color} ${topCard.value}`
      );
      assert.equal(game.direction, 1);
      assert.equal(game.currentTurnIndex, 0);
    }
  });

  test('Drawing the last deck card automatically reshuffles buried discard pile except top card', () => {
    const lastDeckCard: Card = { id: 'deck_last', color: 'red', value: '3', scoreValue: 3 };
    const buriedDiscard1: Card = { id: 'disc_1', color: 'blue', value: '7', scoreValue: 7 };
    const buriedDiscard2: Card = { id: 'disc_2', color: 'green', value: '9', scoreValue: 9 };
    const activeTopCard: Card = { id: 'disc_top', color: 'yellow', value: '5', scoreValue: 5 };

    const result = drawFromDeck([lastDeckCard], [buriedDiscard1, buriedDiscard2, activeTopCard], 1);
    assert.equal(result.drawnCards.length, 1);
    assert.equal(result.drawnCards[0].id, 'deck_last');
    assert.equal(result.didReshuffle, true);
    assert.equal(result.remainingDeck.length, 2, 'Buried discard cards should replenish deck immediately');
    assert.equal(result.remainingDiscard.length, 1);
    assert.equal(result.remainingDiscard[0].id, 'disc_top');
  });

  test('Drawing when both deck and discard pile are exhausted allows safe turn pass without deadlocking', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'P1', isBot: false },
        { id: 'p2', name: 'P2', isBot: false },
      ],
      'multiplayer'
    );
    state.deck = [];
    state.discardPile = [{ id: 'only_top', color: 'red', value: '2', scoreValue: 2 }];
    state.activeColor = 'red';

    const drawnState = playerDrawCard(state, 'p1');
    assert.equal(drawnState.hasDrawnThisTurn, true);
    assert.equal(drawnState.drawnCard, null);

    const passedState = playerPassTurn(drawnState, 'p1');
    assert.equal(passedState.currentTurnIndex, 1, 'Turn must advance cleanly without throwing');
  });
});

describe('RivalSwap 3-Tier Opponent Selection', () => {
  function makeSwapTestGame(playersCount = 4, direction: 1 | -1 = 1, currentTurnIndex = 0): GameState {
    const players: Player[] = [];
    for (let i = 0; i < playersCount; i++) {
      players.push({
        id: `p${i}`,
        name: `Player ${i}`,
        isBot: false,
        hand: [],
        isMuted: false,
        mutedRoundsRemaining: 0,
        hasDeclaredRival: false,
      });
    }

    return {
      deck: [{ id: 'deck1', color: 'red', value: '1', scoreValue: 1 }],
      discardPile: [{ id: 'top0', color: 'red', value: '9', scoreValue: 9 }],
      players,
      currentTurnIndex,
      direction,
      activeColor: 'red',
      winner: null,
      isGameOver: false,
      gameMode: 'multiplayer',
      hasDrawnThisTurn: false,
      drawnCard: null,
      pendingColorChoice: false,
      pendingWildCard: null,
      privacyMask: {
        isActive: false,
        targetPlayerId: players[currentTurnIndex].id,
        targetPlayerName: players[currentTurnIndex].name,
        promptText: '',
      },
      logs: [],
      lastActionTimestamp: Date.now(),
      pendingDrawCount: 0,
      turnCount: 0,
    };
  }

  test('Tier 1: selects the sole opponent with the fewest cards regardless of card strength', () => {
    let state = makeSwapTestGame(4, 1, 0);
    state.players[0].hand = [
      { id: 'rs_p0', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'p0_r2', color: 'red', value: '2', scoreValue: 2 },
    ];
    // Player 1: 3 cards including Wild Draw 4 (strong, but more cards)
    state.players[1].hand = [
      { id: 'p1_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'p1_w', color: 'wild', value: 'wild', scoreValue: 50 },
      { id: 'p1_r9', color: 'red', value: '9', scoreValue: 9 },
    ];
    // Player 2: 2 cards (FEWEST!)
    state.players[2].hand = [
      { id: 'p2_b1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'p2_g2', color: 'green', value: '2', scoreValue: 2 },
    ];
    // Player 3: 4 cards
    state.players[3].hand = [
      { id: 'p3_y1', color: 'yellow', value: '1', scoreValue: 1 },
      { id: 'p3_y2', color: 'yellow', value: '2', scoreValue: 2 },
      { id: 'p3_y3', color: 'yellow', value: '3', scoreValue: 3 },
      { id: 'p3_y4', color: 'yellow', value: '4', scoreValue: 4 },
    ];

    state = playCard(state, 'p0', 'rs_p0', { chosenColor: 'blue' });
    assert.deepEqual(
      state.players[0].hand.map((c) => c.id),
      ['p2_b1', 'p2_g2'],
      'Player 0 must steal Player 2 hand (sole fewest-card opponent)'
    );
    assert.deepEqual(state.players[2].hand.map((c) => c.id), ['p0_r2']);
  });

  test('Tier 2: breaks card-count tie (3 vs 3) by picking opponent holding +4 / Wild over number cards', () => {
    assert.equal(getCardSwapStrength({ id: 'wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 }), 50);
    assert.equal(getCardSwapStrength({ id: 'w', color: 'wild', value: 'wild', scoreValue: 50 }), 40);
    assert.equal(getCardSwapStrength({ id: 'rs', color: 'wild', value: 'rival_swap', scoreValue: 50 }), 40);
    assert.equal(getCardSwapStrength({ id: 'd2', color: 'red', value: 'draw2', scoreValue: 20 }), 20);
    assert.equal(getCardSwapStrength({ id: 'n8', color: 'blue', value: '8', scoreValue: 8 }), 8);

    // Subcase A: Opponent 2 has +4 (3 cards) vs Opponent 1 has numbers (3 cards)
    let state = makeSwapTestGame(4, 1, 0);
    state.players[0].hand = [
      { id: 'rs_p0', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'p0_r1', color: 'red', value: '1', scoreValue: 1 },
    ];
    // Player 1: 3 number cards (score = 9 + 8 + 7 = 24)
    state.players[1].hand = [
      { id: 'p1_r9', color: 'red', value: '9', scoreValue: 9 },
      { id: 'p1_b8', color: 'blue', value: '8', scoreValue: 8 },
      { id: 'p1_g7', color: 'green', value: '7', scoreValue: 7 },
    ];
    // Player 2: 3 cards including Wild Draw 4 (score = 50 + 1 + 2 = 53)
    state.players[2].hand = [
      { id: 'p2_wd4', color: 'wild', value: 'wild_draw4', scoreValue: 50 },
      { id: 'p2_b1', color: 'blue', value: '1', scoreValue: 1 },
      { id: 'p2_g2', color: 'green', value: '2', scoreValue: 2 },
    ];
    // Player 3: 5 cards (excluded by Tier 1)
    state.players[3].hand = [
      { id: 'p3_1', color: 'yellow', value: '1', scoreValue: 1 },
      { id: 'p3_2', color: 'yellow', value: '2', scoreValue: 2 },
      { id: 'p3_3', color: 'yellow', value: '3', scoreValue: 3 },
      { id: 'p3_4', color: 'yellow', value: '4', scoreValue: 4 },
      { id: 'p3_5', color: 'yellow', value: '5', scoreValue: 5 },
    ];

    state = playCard(state, 'p0', 'rs_p0', { chosenColor: 'green' });
    assert.deepEqual(
      state.players[0].hand.map((c) => c.id),
      ['p2_wd4', 'p2_b1', 'p2_g2'],
      'Player 0 must swap with Player 2 (+4 hand) over Player 1 (number cards)'
    );
    assert.deepEqual(state.players[2].hand.map((c) => c.id), ['p0_r1']);

    // Subcase B: Pair play of Rival Swap with Wild (40) vs Action +2 (20) tie-breaker
    let pairState = makeSwapTestGame(3, 1, 0);
    pairState.players[0].hand = [
      { id: 'rs_a', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'rs_b', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'p0_y4', color: 'yellow', value: '4', scoreValue: 4 },
    ];
    // Player 1: 3 cards with Draw 2 (20 + 5 + 5 = 30)
    pairState.players[1].hand = [
      { id: 'p1_d2', color: 'red', value: 'draw2', scoreValue: 20 },
      { id: 'p1_r5', color: 'red', value: '5', scoreValue: 5 },
      { id: 'p1_b5', color: 'blue', value: '5', scoreValue: 5 },
    ];
    // Player 2: 3 cards with Wild (40 + 0 + 1 = 41)
    pairState.players[2].hand = [
      { id: 'p2_w', color: 'wild', value: 'wild', scoreValue: 50 },
      { id: 'p2_r0', color: 'red', value: '0', scoreValue: 0 },
      { id: 'p2_g1', color: 'green', value: '1', scoreValue: 1 },
    ];

    pairState = playPairCards(pairState, 'p0', 'rs_a', 'rs_b', { chosenColor: 'red' });
    assert.deepEqual(
      pairState.players[0].hand.map((c) => c.id),
      ['p2_w', 'p2_r0', 'p2_g1'],
      'Pair Swap must break tie toward Player 2 holding Wild (41 pts) over Player 1 (30 pts)'
    );
    assert.deepEqual(pairState.players[2].hand.map((c) => c.id), ['p0_y4']);
  });

  test('Tier 3: breaks identical count and strength tie by active turn order (clockwise and reversed)', () => {
    // 4 players: P2 plays Swap; P0 and P1 tie on 3 cards & score (5 + 4 + 2 = 11), P3 has 5 cards.
    // Clockwise from P2 (index 2, direction +1): turn order is P3 -> P0 -> P1, so P0 comes first!
    const clockwiseState = makeSwapTestGame(4, 1, 2);
    clockwiseState.players[2].hand = [
      { id: 'rs_p2', color: 'wild', value: 'rival_swap', scoreValue: 50 },
      { id: 'p2_r9', color: 'red', value: '9', scoreValue: 9 },
    ];
    clockwiseState.players[0].hand = [
      { id: 'p0_r5', color: 'red', value: '5', scoreValue: 5 },
      { id: 'p0_b4', color: 'blue', value: '4', scoreValue: 4 },
      { id: 'p0_g2', color: 'green', value: '2', scoreValue: 2 },
    ];
    clockwiseState.players[1].hand = [
      { id: 'p1_y5', color: 'yellow', value: '5', scoreValue: 5 },
      { id: 'p1_r4', color: 'red', value: '4', scoreValue: 4 },
      { id: 'p1_b2', color: 'blue', value: '2', scoreValue: 2 },
    ];
    clockwiseState.players[3].hand = [
      { id: 'p3_1', color: 'red', value: '1', scoreValue: 1 },
      { id: 'p3_2', color: 'red', value: '2', scoreValue: 2 },
      { id: 'p3_3', color: 'red', value: '3', scoreValue: 3 },
      { id: 'p3_4', color: 'red', value: '4', scoreValue: 4 },
      { id: 'p3_5', color: 'red', value: '5', scoreValue: 5 },
    ];

    assert.equal(selectSwapTargetIndex(clockwiseState.players, 2, 1), 0);
    const afterClockwise = playCard(clockwiseState, 'p2', 'rs_p2', { chosenColor: 'yellow' });
    assert.deepEqual(
      afterClockwise.players[2].hand.map((c) => c.id),
      ['p0_r5', 'p0_b4', 'p0_g2'],
      'Clockwise from P2: P0 precedes P1 in turn order (2 -> 3 -> 0 -> 1)'
    );

    // Reversed from P2 (index 2, direction -1): turn order is P1 -> P0 -> P3, so P1 comes first!
    const reversedState = makeSwapTestGame(4, -1, 2);
    reversedState.players[2].hand = [...clockwiseState.players[2].hand];
    reversedState.players[0].hand = [...clockwiseState.players[0].hand];
    reversedState.players[1].hand = [...clockwiseState.players[1].hand];
    reversedState.players[3].hand = [...clockwiseState.players[3].hand];

    assert.equal(selectSwapTargetIndex(reversedState.players, 2, -1), 1);
    const afterReversed = playCard(reversedState, 'p2', 'rs_p2', { chosenColor: 'yellow' });
    assert.deepEqual(
      afterReversed.players[2].hand.map((c) => c.id),
      ['p1_y5', 'p1_r4', 'p1_b2'],
      'Reversed from P2: P1 precedes P0 in turn order (2 -> 1 -> 0 -> 3)'
    );
  });
});

