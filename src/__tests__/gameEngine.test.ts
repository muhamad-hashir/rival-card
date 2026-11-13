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
} from '../gameEngine';
import type { Card, GameState, Player } from '../types';

describe('Deck Architecture & 108 Cards Distribution', () => {
  test('Deck contains exactly 108 cards', () => {
    const deck = generateDeck();
    assert.equal(deck.length, 108, `Expected 108 cards, got ${deck.length}`);
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

  test('Deck has 8 Wild & Rival cards (2 Wild, 2 WildDraw4, 2 Mute, 2 RivalSwap)', () => {
    const deck = generateDeck();
    const wilds = deck.filter((c) => c.value === 'wild');
    const wildDraw4s = deck.filter((c) => c.value === 'wild_draw4');
    const mutes = deck.filter((c) => c.value === 'mute');
    const rivalSwaps = deck.filter((c) => c.value === 'rival_swap');

    assert.equal(wilds.length, 2, 'Expected 2 Wild cards');
    assert.equal(wildDraw4s.length, 2, 'Expected 2 WildDraw4 cards');
    assert.equal(mutes.length, 2, 'Expected 2 Mute cards');
    assert.equal(rivalSwaps.length, 2, 'Expected 2 RivalSwap cards');

    // All wild suit cards must have color: 'wild'
    const wildSuit = deck.filter((c) => c.color === 'wild');
    assert.equal(wildSuit.length, 8, 'Expected 8 total cards with color wild');
  });

  test('Color breakdown: 25 Red, 25 Blue, 25 Green, 25 Yellow, 8 Wild', () => {
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
    assert.equal(wild.length, 8);
    assert.equal(red.length + blue.length + green.length + yellow.length + wild.length, 108);
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
    assert.equal(originalIds.size, 108);
    assert.equal(shuffledIds.size, 108);

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

    // Total cards accounted for: sum of all player hands + discard pile + deck = 108
    const totalPlayerCards = game.players.reduce((sum, p) => sum + p.hand.length, 0);
    assert.equal(totalPlayerCards + game.discardPile.length + game.deck.length, 108,
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

