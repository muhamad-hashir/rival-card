// src/gameEngine.ts - Core Game Engine & State Machine for Rival Card
import {
  COLOR_HEX,
  STANDARD_COLORS,
} from './types';
import type {
  Card,
  CardColor,
  CardValue,
  GameActionType,
  GameEventLog,
  GameMode,
  GameState,
  Player,
  PrivacyMaskState,
  StandardColor,
  TurnDirection,
} from './types';

// ============================================================================
// 1. DECK GENERATOR (108 CARDS)
// ============================================================================

/**
 * Generates the full 108-card deck for Rival Card:
 * - 4 Suits/Colors: Red (#EF4444), Blue (#3B82F6), Green (#10B981), Yellow (#F59E0B)
 * - 76 Number cards:
 *   - '0': 1 per color (4 cards)
 *   - '1'-'9': 2 per color (72 cards)
 * - 24 Standard Action cards:
 *   - 'skip': 2 per color (8 cards)
 *   - 'reverse': 2 per color (8 cards)
 *   - 'draw2': 2 per color (8 cards)
 * - 8 Wild & Rival Action cards (Black Suit #1E293B):
 *   - 'wild': 2 cards
 *   - 'wild_draw4': 2 cards
 *   - 'mute': 2 cards
 *   - 'rival_swap': 2 cards
 */
export function generateDeck(): Card[] {
  const deck: Card[] = [];
  let cardCounter = 0;

  for (const color of STANDARD_COLORS) {
    // 1x '0' card per color
    deck.push({
      id: `${color}-0-${cardCounter++}`,
      color,
      value: '0',
      scoreValue: 0,
    });

    // 2x '1' through '9' cards per color
    for (let num = 1; num <= 9; num++) {
      const val = String(num) as CardValue;
      deck.push({
        id: `${color}-${val}-a-${cardCounter++}`,
        color,
        value: val,
        scoreValue: num,
      });
      deck.push({
        id: `${color}-${val}-b-${cardCounter++}`,
        color,
        value: val,
        scoreValue: num,
      });
    }

    // 2x Standard action cards per color
    const actionTypes: ('skip' | 'reverse' | 'draw2')[] = ['skip', 'reverse', 'draw2'];
    for (const action of actionTypes) {
      deck.push({
        id: `${color}-${action}-a-${cardCounter++}`,
        color,
        value: action,
        scoreValue: 20,
      });
      deck.push({
        id: `${color}-${action}-b-${cardCounter++}`,
        color,
        value: action,
        scoreValue: 20,
      });
    }
  }

  // 8 Wild & Rival cards (2 of each)
  const wildTypes: ('wild' | 'wild_draw4' | 'mute' | 'rival_swap')[] = [
    'wild',
    'wild_draw4',
    'mute',
    'rival_swap',
  ];

  for (const wildAction of wildTypes) {
    deck.push({
      id: `wild-${wildAction}-a-${cardCounter++}`,
      color: 'wild',
      value: wildAction,
      scoreValue: 50,
    });
    deck.push({
      id: `wild-${wildAction}-b-${cardCounter++}`,
      color: 'wild',
      value: wildAction,
      scoreValue: 50,
    });
  }

  return deck;
}

// ============================================================================
// 2. SHUFFLE ALGORITHM (FISHER-YATES)
// ============================================================================

/**
 * Shuffles an array using the Fisher-Yates (Knuth) algorithm.
 * Pure function: does not mutate original array, returns a new shuffled array.
 */
export function shuffleDeck<T>(items: readonly T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

// ============================================================================
// 3. MOVE VALIDATION
// ============================================================================

/**
 * Checks whether a card is a Wild or Rival action card.
 */
export function isWildCard(card: Card): boolean {
  return (
    card.color === 'wild' ||
    card.value === 'wild' ||
    card.value === 'wild_draw4' ||
    card.value === 'mute' ||
    card.value === 'rival_swap'
  );
}

/**
 * Validates whether a card can be legally played onto the discard pile:
 * - Any Wild or Rival card can be played on any card.
 * - Otherwise, the card's color must match `activeColor`, OR
 * - The card's value must match `topCard.value`.
 */
export function isValidMove(card: Card, topCard: Card, activeColor: StandardColor): boolean {
  if (isWildCard(card)) {
    return true;
  }
  if (card.color === activeColor) {
    return true;
  }
  if (card.value === topCard.value) {
    return true;
  }
  return false;
}

// ============================================================================
// 4. DRAW DECK & RESHUFFLE LOGIC
// ============================================================================

/**
 * Draws `count` cards from the deck.
 * If the deck does not have enough cards, reshuffles all cards from `discardPile`
 * EXCEPT the top card (which remains on the discard pile) using Fisher-Yates.
 */
export function drawFromDeck(
  deck: readonly Card[],
  discardPile: readonly Card[],
  count: number
): { drawnCards: Card[]; remainingDeck: Card[]; remainingDiscard: Card[]; didReshuffle: boolean } {
  let currentDeck = [...deck];
  let currentDiscard = [...discardPile];
  let didReshuffle = false;
  const drawnCards: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length > 1) {
        // Keep top card on discard pile
        const topCard = currentDiscard[currentDiscard.length - 1];
        const cardsToReshuffle = currentDiscard.slice(0, -1);
        currentDeck = shuffleDeck(cardsToReshuffle);
        currentDiscard = [topCard];
        didReshuffle = true;
      } else {
        // No cards left to draw anywhere
        break;
      }
    }

    const card = currentDeck.pop();
    if (card) {
      drawnCards.push(card);
    }
  }

  return {
    drawnCards,
    remainingDeck: currentDeck,
    remainingDiscard: currentDiscard,
    didReshuffle,
  };
}

// ============================================================================
// 5. TURN ROTATION HELPER
// ============================================================================

/**
 * Calculates the next player's index using modulo arithmetic,
 * correctly handling negative directions and skips.
 */
export function calculateNextPlayerIndex(
  currentIndex: number,
  direction: TurnDirection,
  playerCount: number,
  steps: number = 1
): number {
  if (playerCount <= 0) return 0;
  const rawIndex = (currentIndex + direction * steps) % playerCount;
  return (rawIndex + playerCount) % playerCount;
}

// ============================================================================
// 6. EVENT LOGGING HELPER
// ============================================================================

let logCounter = 0;
function createLogEntry(
  actionType: GameActionType,
  message: string,
  extra: Partial<GameEventLog> = {}
): GameEventLog {
  return {
    id: `log-${Date.now()}-${logCounter++}`,
    timestamp: Date.now(),
    actionType,
    message,
    ...extra,
  };
}

// ============================================================================
// 7. INITIAL GAME CREATION
// ============================================================================

export interface PlayerConfig {
  id: string;
  name: string;
  isBot?: boolean;
}

/**
 * Creates and initializes a new Rival Card game:
 * - Deals 7 cards to each player.
 * - Draws initial top card for discard pile (ensures first card is non-wild for fair start).
 * - Sets activeColor and initial turn index.
 * - Sets privacy mask if pass-and-play mode and first player is human.
 */
export function createGame(
  playerConfigs: PlayerConfig[],
  gameMode: GameMode = 'vs_bot'
): GameState {
  if (playerConfigs.length < 2 || playerConfigs.length > 4) {
    throw new Error('Rival Card requires between 2 and 4 players.');
  }

  const rawDeck = generateDeck();
  const shuffledDeck = shuffleDeck(rawDeck);

  // Deal 7 cards per player
  const players: Player[] = playerConfigs.map((config) => {
    const hand = shuffledDeck.splice(0, 7);
    return {
      id: config.id,
      name: config.name,
      isBot: Boolean(config.isBot),
      hand,
      isMuted: false,
      mutedRoundsRemaining: 0,
      hasDeclaredRival: false,
    };
  });

  // Pick top card from deck for discard pile.
  // Standard rule: first card cannot be Wild or Rival action.
  let topCardIndex = -1;
  for (let i = shuffledDeck.length - 1; i >= 0; i--) {
    if (!isWildCard(shuffledDeck[i])) {
      topCardIndex = i;
      break;
    }
  }

  if (topCardIndex === -1) {
    // Fallback if somehow no non-wild found
    topCardIndex = shuffledDeck.length - 1;
  }

  const [initialTopCard] = shuffledDeck.splice(topCardIndex, 1);
  const discardPile: Card[] = [initialTopCard];

  const initialActiveColor: StandardColor =
    initialTopCard.color === 'wild' ? 'red' : (initialTopCard.color as StandardColor);

  let currentTurnIndex = 0;
  let direction: TurnDirection = 1;
  const initialLogs: GameEventLog[] = [
    createLogEntry('PLAY_CARD', `Game started! Top card is ${initialTopCard.color.toUpperCase()} ${initialTopCard.value}.`),
  ];

  // Handle standard action card starting effects
  if (initialTopCard.value === 'skip') {
    const skippedStartMsg =
      players[0].name === 'You'
        ? 'You were skipped by initial Skip card!'
        : `${players[0].name} was skipped by initial Skip card!`;
    initialLogs.push(createLogEntry('PLAY_CARD', skippedStartMsg));
    currentTurnIndex = calculateNextPlayerIndex(0, direction, players.length, 1);
  } else if (initialTopCard.value === 'reverse') {
    if (players.length === 2) {
      initialLogs.push(
        createLogEntry('PLAY_CARD', `Initial Reverse card skips ${players[0].name} in 2-player game!`)
      );
      currentTurnIndex = 1;
    } else {
      direction = -1;
      initialLogs.push(
        createLogEntry('PLAY_CARD', `Initial Reverse card set rotation counter-clockwise!`)
      );
    }
  } else if (initialTopCard.value === 'draw2') {
    // First player draws 2 and turn skips to next
    const drawn = shuffledDeck.splice(0, 2);
    players[0].hand.push(...drawn);
    const drawSkipMsg =
      players[0].name === 'You'
        ? 'You drew 2 cards from initial Draw2 and were skipped!'
        : `${players[0].name} drew 2 cards from initial Draw2 and was skipped!`;
    initialLogs.push(
      createLogEntry('DRAW_CARD', drawSkipMsg, {
        playerId: players[0].id,
        playerName: players[0].name,
      })
    );
    currentTurnIndex = calculateNextPlayerIndex(0, direction, players.length, 1);
  }

  const startingPlayer = players[currentTurnIndex];
  const isPrivacyMaskActive = gameMode === 'pass_and_play' && !startingPlayer.isBot;

  const privacyMask: PrivacyMaskState = {
    isActive: isPrivacyMaskActive,
    targetPlayerId: startingPlayer.id,
    targetPlayerName: startingPlayer.name,
    promptText: `Pass device to ${startingPlayer.name}`,
  };

  return {
    deck: shuffledDeck,
    discardPile,
    players,
    currentTurnIndex,
    direction,
    activeColor: initialActiveColor,
    winner: null,
    isGameOver: false,
    gameMode,
    hasDrawnThisTurn: false,
    drawnCard: null,
    pendingColorChoice: false,
    pendingWildCard: null,
    privacyMask,
    logs: initialLogs,
    turnCount: 1,
    lastActionTimestamp: Date.now(),
  };
}

// ============================================================================
// 8. PASS-AND-PLAY SCREEN MASKING
// ============================================================================

/**
 * Dismisses the privacy mask so the active player can interact with their hand.
 */
export function dismissPrivacyMask(state: GameState): GameState {
  if (!state.privacyMask.isActive) {
    return state;
  }
  return {
    ...state,
    privacyMask: {
      ...state.privacyMask,
      isActive: false,
    },
    logs: [
      ...state.logs,
      createLogEntry('DISMISS_PRIVACY_MASK', `${state.privacyMask.targetPlayerName} is ready.`),
    ],
  };
}

// ============================================================================
// 9. DRAW CARD ACTION
// ============================================================================

/**
 * Executes a player drawing a card from the deck.
 * If the deck is empty, reshuffles the discard pile (except top card).
 * Sets hasDrawnThisTurn = true so player can either play the drawn card or pass.
 */
export function playerDrawCard(state: GameState, playerId: string): GameState {
  if (state.isGameOver) return state;

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`It is not ${playerId}'s turn.`);
  }

  if (state.hasDrawnThisTurn) {
    throw new Error('Player has already drawn a card this turn. Must play or pass.');
  }

  const { drawnCards, remainingDeck, remainingDiscard, didReshuffle } = drawFromDeck(
    state.deck,
    state.discardPile,
    1
  );

  if (drawnCards.length === 0) {
    // No cards available even after reshuffle
    return state;
  }

  const drawnCard = drawnCards[0];
  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hand: [...p.hand, drawnCard] } : p
  );

  const newLogs = [...state.logs];
  if (didReshuffle) {
    newLogs.push(createLogEntry('RESHUFFLE_DECK', 'Draw deck was empty. Discard pile reshuffled!'));
  }
  newLogs.push(
    createLogEntry('DRAW_CARD', `${currentPlayer.name} drew a card.`, {
      playerId,
      playerName: currentPlayer.name,
      card: drawnCard,
    })
  );

  return {
    ...state,
    deck: remainingDeck,
    discardPile: remainingDiscard,
    players: updatedPlayers,
    hasDrawnThisTurn: true,
    drawnCard,
    logs: newLogs,
    lastActionTimestamp: Date.now(),
  };
}

// ============================================================================
// 10. PASS TURN ACTION
// ============================================================================

/**
 * Passes turn to the next player. Only allowed if the player has already drawn a card.
 */
export function playerPassTurn(state: GameState, playerId: string): GameState {
  if (state.isGameOver) return state;

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`It is not ${playerId}'s turn.`);
  }

  if (!state.hasDrawnThisTurn) {
    throw new Error('Must draw a card before passing turn.');
  }

  return advanceToNextTurn(
    {
      ...state,
      hasDrawnThisTurn: false,
      drawnCard: null,
      logs: [
        ...state.logs,
        createLogEntry('PASS_TURN', `${currentPlayer.name} passed their turn.`, {
          playerId,
          playerName: currentPlayer.name,
        }),
      ],
    },
    1
  );
}

// ============================================================================
// 11. PLAY CARD ACTION
// ============================================================================

export interface PlayCardOptions {
  chosenColor?: StandardColor; // Required for wild cards played by human
  targetPlayerId?: string; // Optional target for Mute
}

/**
 * Plays a card from the current player's hand onto the discard pile.
 * Enforces all game rules:
 * - Move validity
 * - Win condition check
 * - Action card effects: Skip, Reverse, Draw2, Wild, WildDraw4, Mute, RivalSwap
 * - RIVAL! callout tracking
 * - Privacy mask generation for pass-and-play
 */
export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  options?: PlayCardOptions
): GameState {
  if (state.isGameOver) return state;

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`It is not ${playerId}'s turn.`);
  }

  const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} is not in ${currentPlayer.name}'s hand.`);
  }

  const cardToPlay = currentPlayer.hand[cardIndex];
  const topCard = state.discardPile[state.discardPile.length - 1];

  if (!isValidMove(cardToPlay, topCard, state.activeColor)) {
    throw new Error(`Card ${cardToPlay.color} ${cardToPlay.value} cannot be played on ${topCard.color} ${topCard.value} (active color: ${state.activeColor}).`);
  }

  // Remove card from hand
  const newHand = currentPlayer.hand.filter((c) => c.id !== cardId);

  // Check RIVAL! declaration status:
  // If player is now at 1 card and has not declared RIVAL, flag that they are vulnerable
  let hasDeclaredRival = currentPlayer.hasDeclaredRival;
  if (newHand.length !== 1) {
    hasDeclaredRival = false; // Reset if hand count is not 1
  }

  const updatedCurrentPlayer: Player = {
    ...currentPlayer,
    hand: newHand,
    hasDeclaredRival,
  };

  let updatedPlayers = state.players.map((p) =>
    p.id === playerId ? updatedCurrentPlayer : p
  );

  const updatedDiscardPile = [...state.discardPile, cardToPlay];
  const newLogs = [
    ...state.logs,
    createLogEntry(
      'PLAY_CARD',
      `${currentPlayer.name} played ${cardToPlay.color === 'wild' ? 'WILD' : cardToPlay.color.toUpperCase()} ${cardToPlay.value.toUpperCase()}.`,
      {
        playerId,
        playerName: currentPlayer.name,
        card: cardToPlay,
      }
    ),
  ];

  // 1. Check Win Condition
  if (newHand.length === 0) {
    newLogs.push(
      createLogEntry('PLAY_CARD', `🎉 ${currentPlayer.name} has played all their cards and WON the game!`, {
        playerId,
        playerName: currentPlayer.name,
      })
    );
    return {
      ...state,
      players: updatedPlayers,
      discardPile: updatedDiscardPile,
      winner: updatedCurrentPlayer,
      isGameOver: true,
      hasDrawnThisTurn: false,
      drawnCard: null,
      logs: newLogs,
    };
  }

  // 2. Handle Wild Cards with pending color choice
  const isWild = isWildCard(cardToPlay);
  if (isWild && !options?.chosenColor && !currentPlayer.isBot) {
    // Wait for player to choose color via UI modal
    return {
      ...state,
      players: updatedPlayers,
      discardPile: updatedDiscardPile,
      pendingColorChoice: true,
      pendingWildCard: cardToPlay,
      hasDrawnThisTurn: false,
      drawnCard: null,
      logs: newLogs,
    };
  }

  // If wild with chosenColor provided or bot playing:
  let newActiveColor: StandardColor = state.activeColor;
  if (isWild) {
    newActiveColor = options?.chosenColor || 'red';
    newLogs.push(
      createLogEntry('CHOOSE_COLOR', `${currentPlayer.name} selected ${newActiveColor.toUpperCase()} as the active color.`, {
        playerId,
        playerName: currentPlayer.name,
        chosenColor: newActiveColor,
      })
    );
  } else {
    newActiveColor = cardToPlay.color as StandardColor;
  }

  // 3. Process Card Action Effects
  let nextSteps = 1;
  let newDirection = state.direction;
  let currentDeck = state.deck;
  let currentDiscard = updatedDiscardPile;

  switch (cardToPlay.value) {
    case 'skip': {
      nextSteps = 2; // Skip next player
      const skippedIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
      const skippedPlayer = updatedPlayers[skippedIndex];
      const skippedMsg =
        skippedPlayer.name === 'You' ? 'You were skipped!' : `${skippedPlayer.name} was skipped!`;
      newLogs.push(
        createLogEntry('PLAY_CARD', skippedMsg, {
          targetPlayerId: skippedPlayer.id,
          targetPlayerName: skippedPlayer.name,
        })
      );
      break;
    }

    case 'reverse': {
      if (updatedPlayers.length === 2) {
        // Standard 2-player UNO rule: Reverse acts as a Skip
        nextSteps = 2;
        const skippedIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
        const skippedPlayer = updatedPlayers[skippedIndex];
        const reverseSkipMsg =
          skippedPlayer.name === 'You'
            ? 'Reverse card skipped you!'
            : `Reverse card skipped ${skippedPlayer.name}!`;
        newLogs.push(
          createLogEntry('PLAY_CARD', reverseSkipMsg, {
            targetPlayerId: skippedPlayer.id,
            targetPlayerName: skippedPlayer.name,
          })
        );
      } else {
        newDirection = (state.direction * -1) as TurnDirection;
        nextSteps = 1;
        newLogs.push(
          createLogEntry('PLAY_CARD', `Turn order reversed! Now moving ${newDirection === 1 ? 'clockwise' : 'counter-clockwise'}.`)
        );
      }
      break;
    }

    case 'draw2': {
      nextSteps = 2;
      const targetIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
      const targetPlayer = updatedPlayers[targetIndex];

      const drawResult = drawFromDeck(currentDeck, currentDiscard, 2);
      currentDeck = drawResult.remainingDeck;
      currentDiscard = drawResult.remainingDiscard;

      if (drawResult.didReshuffle) {
        newLogs.push(createLogEntry('RESHUFFLE_DECK', 'Deck was reshuffled during Draw 2.'));
      }

      updatedPlayers = updatedPlayers.map((p, idx) =>
        idx === targetIndex ? { ...p, hand: [...p.hand, ...drawResult.drawnCards], hasDeclaredRival: false } : p
      );

      newLogs.push(
        createLogEntry('DRAW_CARD', `${targetPlayer.name} drew 2 cards and lost their turn!`, {
          targetPlayerId: targetPlayer.id,
          targetPlayerName: targetPlayer.name,
        })
      );
      break;
    }

    case 'wild_draw4': {
      nextSteps = 2;
      const targetIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
      const targetPlayer = updatedPlayers[targetIndex];

      const drawResult = drawFromDeck(currentDeck, currentDiscard, 4);
      currentDeck = drawResult.remainingDeck;
      currentDiscard = drawResult.remainingDiscard;

      if (drawResult.didReshuffle) {
        newLogs.push(createLogEntry('RESHUFFLE_DECK', 'Deck was reshuffled during Wild Draw 4.'));
      }

      updatedPlayers = updatedPlayers.map((p, idx) =>
        idx === targetIndex ? { ...p, hand: [...p.hand, ...drawResult.drawnCards], hasDeclaredRival: false } : p
      );

      newLogs.push(
        createLogEntry('DRAW_CARD', `${targetPlayer.name} drew 4 cards and lost their turn!`, {
          targetPlayerId: targetPlayer.id,
          targetPlayerName: targetPlayer.name,
        })
      );
      break;
    }

    case 'mute': {
      // AGENT.md: "Forces targeted player to skip turn and disables their chat/reactions for 1 round."
      let targetIndex: number;
      if (options?.targetPlayerId) {
        targetIndex = updatedPlayers.findIndex((p) => p.id === options.targetPlayerId);
        if (targetIndex === -1) targetIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
      } else {
        targetIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
      }

      const targetPlayer = updatedPlayers[targetIndex];
      updatedPlayers = updatedPlayers.map((p, idx) =>
        idx === targetIndex ? { ...p, isMuted: true, mutedRoundsRemaining: 1 } : p
      );

      // If targeted player is next player, skip their turn
      if (targetIndex === calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1)) {
        nextSteps = 2;
      } else {
        nextSteps = 1;
      }

      const muteMsg =
        targetPlayer.name === 'You'
          ? '🔇 You were MUTED for 1 round! Turn skipped.'
          : `🔇 ${targetPlayer.name} was MUTED for 1 round! Turn skipped.`;
      newLogs.push(
        createLogEntry('MUTE_PLAYER', muteMsg, {
          targetPlayerId: targetPlayer.id,
          targetPlayerName: targetPlayer.name,
        })
      );
      break;
    }

    case 'rival_swap': {
      // AGENT.md: "Swaps hand with the player who currently has the fewest cards in hand."
      let minHandCount = Infinity;
      let targetPlayerIndex = -1;

      // Search among opponents only
      for (let i = 0; i < updatedPlayers.length; i++) {
        if (i !== state.currentTurnIndex) {
          const count = updatedPlayers[i].hand.length;
          if (count < minHandCount) {
            minHandCount = count;
            targetPlayerIndex = i;
          }
        }
      }

      if (targetPlayerIndex !== -1) {
        const targetPlayer = updatedPlayers[targetPlayerIndex];
        const playerHandBeforeSwap = [...updatedCurrentPlayer.hand];
        const targetHandBeforeSwap = [...targetPlayer.hand];

        updatedPlayers = updatedPlayers.map((p, idx) => {
          if (idx === state.currentTurnIndex) {
            return {
              ...p,
              hand: targetHandBeforeSwap,
              hasDeclaredRival: targetHandBeforeSwap.length === 1 ? p.hasDeclaredRival : false,
            };
          }
          if (idx === targetPlayerIndex) {
            return {
              ...p,
              hand: playerHandBeforeSwap,
              hasDeclaredRival: playerHandBeforeSwap.length === 1 ? p.hasDeclaredRival : false,
            };
          }
          return p;
        });

        newLogs.push(
          createLogEntry(
            'SWAP_HANDS',
            `🔄 RIVAL SWAP! ${currentPlayer.name} (${playerHandBeforeSwap.length} cards) swapped hands with ${targetPlayer.name} (${targetHandBeforeSwap.length} cards)!`,
            {
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              targetPlayerId: targetPlayer.id,
              targetPlayerName: targetPlayer.name,
            }
          )
        );
      }
      nextSteps = 1;
      break;
    }

    default:
      // Standard number card or regular Wild
      nextSteps = 1;
      break;
  }

  const intermediateState: GameState = {
    ...state,
    deck: currentDeck,
    discardPile: currentDiscard,
    players: updatedPlayers,
    direction: newDirection,
    activeColor: newActiveColor,
    hasDrawnThisTurn: false,
    drawnCard: null,
    pendingColorChoice: false,
    pendingWildCard: null,
    logs: newLogs,
  };

  return advanceToNextTurn(intermediateState, nextSteps);
}

// ============================================================================
// 12. CHOOSE WILD COLOR (When pendingColorChoice is true)
// ============================================================================

/**
 * Completes a pending wild card play when the player selects their desired color.
 */
export function chooseWildColor(
  state: GameState,
  playerId: string,
  chosenColor: StandardColor
): GameState {
  if (!state.pendingColorChoice || !state.pendingWildCard) {
    throw new Error('No pending wild card awaiting color selection.');
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`It is not ${playerId}'s turn.`);
  }

  const wildCard = state.pendingWildCard;
  let nextSteps = 1;
  let currentDeck = state.deck;
  let currentDiscard = state.discardPile;
  let updatedPlayers = state.players;
  const newLogs = [
    ...state.logs,
    createLogEntry('CHOOSE_COLOR', `${currentPlayer.name} selected ${chosenColor.toUpperCase()} as active color.`, {
      playerId,
      playerName: currentPlayer.name,
      chosenColor,
    }),
  ];

  if (wildCard.value === 'wild_draw4') {
    nextSteps = 2;
    const targetIndex = calculateNextPlayerIndex(state.currentTurnIndex, state.direction, updatedPlayers.length, 1);
    const targetPlayer = updatedPlayers[targetIndex];

    const drawResult = drawFromDeck(currentDeck, currentDiscard, 4);
    currentDeck = drawResult.remainingDeck;
    currentDiscard = drawResult.remainingDiscard;

    if (drawResult.didReshuffle) {
      newLogs.push(createLogEntry('RESHUFFLE_DECK', 'Deck reshuffled during Wild Draw 4.'));
    }

    updatedPlayers = updatedPlayers.map((p, idx) =>
      idx === targetIndex ? { ...p, hand: [...p.hand, ...drawResult.drawnCards], hasDeclaredRival: false } : p
    );

    newLogs.push(
      createLogEntry('DRAW_CARD', `${targetPlayer.name} drew 4 cards and lost their turn!`, {
        targetPlayerId: targetPlayer.id,
        targetPlayerName: targetPlayer.name,
      })
    );
  }

  const intermediateState: GameState = {
    ...state,
    deck: currentDeck,
    discardPile: currentDiscard,
    players: updatedPlayers,
    activeColor: chosenColor,
    pendingColorChoice: false,
    pendingWildCard: null,
    logs: newLogs,
  };

  return advanceToNextTurn(intermediateState, nextSteps);
}

// ============================================================================
// 13. ADVANCE TO NEXT TURN & PRIVACY MASKING
// ============================================================================

/**
 * Advances the turn pointer by `steps`, decrements mute timers,
 * and activates the privacy mask if the next player is human in pass-and-play mode.
 */
export function advanceToNextTurn(state: GameState, steps: number = 1): GameState {
  if (state.isGameOver) return state;

  const nextIndex = calculateNextPlayerIndex(
    state.currentTurnIndex,
    state.direction,
    state.players.length,
    steps
  );

  // Update muted states
  const updatedPlayers = state.players.map((p, idx) => {
    if (idx === nextIndex && p.isMuted) {
      const remaining = p.mutedRoundsRemaining - 1;
      return {
        ...p,
        mutedRoundsRemaining: Math.max(0, remaining),
        isMuted: remaining > 0,
      };
    }
    return p;
  });

  const nextPlayer = updatedPlayers[nextIndex];
  const shouldMask = state.gameMode === 'pass_and_play' && !nextPlayer.isBot;

  const privacyMask: PrivacyMaskState = {
    isActive: shouldMask,
    targetPlayerId: nextPlayer.id,
    targetPlayerName: nextPlayer.name,
    promptText: `Pass device to ${nextPlayer.name}`,
  };

  return {
    ...state,
    players: updatedPlayers,
    currentTurnIndex: nextIndex,
    hasDrawnThisTurn: false,
    drawnCard: null,
    privacyMask,
    turnCount: state.turnCount + 1,
    lastActionTimestamp: Date.now(),
  };
}

// ============================================================================
// 14. RIVAL! CALLOUT & CATCH MECHANIC
// ============================================================================

/**
 * Player declares "RIVAL!" when down to 1 card.
 */
export function declareRival(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hasDeclaredRival: true } : p
  );

  return {
    ...state,
    players: updatedPlayers,
    logs: [
      ...state.logs,
      createLogEntry('DECLARE_RIVAL', `⚡ ${player.name} shouted RIVAL!`, {
        playerId,
        playerName: player.name,
      }),
    ],
    lastActionTimestamp: Date.now(),
  };
}

/**
 * An opponent catches a player who has 1 card but forgot to declare RIVAL!
 * Penalty: Caught player must draw 2 cards.
 */
export function catchRival(
  state: GameState,
  accuserPlayerId: string,
  accusedPlayerId: string
): GameState {
  const accuser = state.players.find((p) => p.id === accuserPlayerId);
  const accused = state.players.find((p) => p.id === accusedPlayerId);

  if (!accused || !accuser) return state;

  if (accused.hand.length === 1 && !accused.hasDeclaredRival) {
    const { drawnCards, remainingDeck, remainingDiscard, didReshuffle } = drawFromDeck(
      state.deck,
      state.discardPile,
      2
    );

    const updatedPlayers = state.players.map((p) =>
      p.id === accusedPlayerId
        ? { ...p, hand: [...p.hand, ...drawnCards], hasDeclaredRival: false }
        : p
    );

    const newLogs = [...state.logs];
    if (didReshuffle) {
      newLogs.push(createLogEntry('RESHUFFLE_DECK', 'Deck reshuffled during Rival penalty draw.'));
    }
    newLogs.push(
      createLogEntry(
        'CATCH_RIVAL',
        `🚨 ${accuser.name} CAUGHT ${accused.name} for not declaring RIVAL! ${accused.name} drew 2 penalty cards.`,
        {
          playerId: accuser.id,
          playerName: accuser.name,
          targetPlayerId: accused.id,
          targetPlayerName: accused.name,
        }
      )
    );

    return {
      ...state,
      deck: remainingDeck,
      discardPile: remainingDiscard,
      players: updatedPlayers,
      logs: newLogs,
      lastActionTimestamp: Date.now(),
    };
  }

  return state;
}

// ============================================================================
// 15. BOT AI ENGINE (`makeBotMove`)
// ============================================================================

/**
 * Heuristic to find the dominant color in a bot's hand.
 */
export function getDominantColor(hand: readonly Card[]): StandardColor {
  const counts: Record<StandardColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
  };

  for (const card of hand) {
    if (card.color !== 'wild' && card.color in counts) {
      counts[card.color as StandardColor]++;
    }
  }

  let bestColor: StandardColor = 'red';
  let maxCount = -1;
  for (const color of STANDARD_COLORS) {
    if (counts[color] > maxCount) {
      maxCount = counts[color];
      bestColor = color;
    }
  }
  return bestColor;
}

/**
 * Evaluates bot moves and executes the best action:
 * 1. Checks if any opponent forgot to call RIVAL! and catches them.
 * 2. If bot has 2 cards and is about to play 1, bot automatically calls RIVAL!
 * 3. Finds all playable cards from hand.
 * 4. Selects optimal card based on game state:
 *    - Offense against opponents with 1-2 cards (Draw4, Draw2, Mute, Skip).
 *    - RivalSwap if opponent has significantly fewer cards.
 *    - Action cards.
 *    - High-value number cards matching active color or matching value.
 *    - Standard Wild.
 * 5. If no playable cards: draws 1 card from deck.
 *    - If drawn card is playable, bot immediately plays it.
 *    - Otherwise, bot passes turn.
 */
export function makeBotMove(state: GameState): GameState {
  if (state.isGameOver) return state;

  const botPlayer = state.players[state.currentTurnIndex];
  if (!botPlayer.isBot) {
    throw new Error(`Current player ${botPlayer.name} is not a bot.`);
  }

  let currentState = state;

  // 1. Opportunistic Catch: Catch any opponent who has 1 card without declaring RIVAL!
  for (const opponent of currentState.players) {
    if (opponent.id !== botPlayer.id && opponent.hand.length === 1 && !opponent.hasDeclaredRival) {
      currentState = catchRival(currentState, botPlayer.id, opponent.id);
      break;
    }
  }

  const topCard = currentState.discardPile[currentState.discardPile.length - 1];
  const activeColor = currentState.activeColor;
  const playableCards = botPlayer.hand.filter((c) => isValidMove(c, topCard, activeColor));

  // If bot has 2 cards and will play 1, declare RIVAL! ahead of time
  if (botPlayer.hand.length === 2 && playableCards.length > 0) {
    currentState = declareRival(currentState, botPlayer.id);
  }

  if (playableCards.length > 0) {
    const chosenCard = pickBestBotCard(playableCards, currentState, botPlayer);
    const chosenColor = isWildCard(chosenCard)
      ? getDominantColor(botPlayer.hand.filter((c) => c.id !== chosenCard.id))
      : undefined;

    return playCard(currentState, botPlayer.id, chosenCard.id, { chosenColor });
  }

  // No playable cards in hand: Draw from deck
  const drawnState = playerDrawCard(currentState, botPlayer.id);
  const drawnCard = drawnState.drawnCard;

  if (drawnCard && isValidMove(drawnCard, topCard, drawnState.activeColor)) {
    // If the freshly drawn card is playable, play it immediately!
    const chosenColor = isWildCard(drawnCard)
      ? getDominantColor(drawnState.players[drawnState.currentTurnIndex].hand.filter((c) => c.id !== drawnCard.id))
      : undefined;

    return playCard(drawnState, botPlayer.id, drawnCard.id, { chosenColor });
  }

  // Drawn card not playable: pass turn
  return playerPassTurn(drawnState, botPlayer.id);
}

/**
 * Heuristic to score and pick the best playable card for the bot.
 */
export function pickBestBotCard(
  playableCards: readonly Card[],
  state: GameState,
  botPlayer: Player
): Card {
  // Check if any opponent is close to winning (1 or 2 cards)
  const dangerOpponents = state.players.filter(
    (p) => p.id !== botPlayer.id && p.hand.length <= 2
  );
  const isOpponentNearWin = dangerOpponents.length > 0;

  // Find opponent with lowest hand count
  let minOpponentCards = Infinity;
  for (const p of state.players) {
    if (p.id !== botPlayer.id && p.hand.length < minOpponentCards) {
      minOpponentCards = p.hand.length;
    }
  }

  // 1. If opponent is close to winning, play aggressive attack cards
  if (isOpponentNearWin) {
    const attackCards = playableCards.filter((c) =>
      ['wild_draw4', 'draw2', 'mute', 'skip'].includes(c.value)
    );
    if (attackCards.length > 0) {
      return attackCards[0];
    }
  }

  // 2. If bot has 4+ cards and an opponent has <= 2 cards, use RivalSwap!
  if (botPlayer.hand.length >= 4 && minOpponentCards <= 2) {
    const rivalSwapCard = playableCards.find((c) => c.value === 'rival_swap');
    if (rivalSwapCard) {
      return rivalSwapCard;
    }
  }

  // 3. Play action cards matching color (Draw2, Skip, Reverse)
  const matchingActions = playableCards.filter(
    (c) => c.color === state.activeColor && ['draw2', 'skip', 'reverse'].includes(c.value)
  );
  if (matchingActions.length > 0) {
    return matchingActions[0];
  }

  // 4. Play number cards matching active color (prefer highest number to reduce points)
  const matchingColorNumbers = playableCards
    .filter((c) => c.color === state.activeColor && !isNaN(Number(c.value)))
    .sort((a, b) => Number(b.value) - Number(a.value));
  if (matchingColorNumbers.length > 0) {
    return matchingColorNumbers[0];
  }

  // 5. Play number cards matching value with a different color
  const matchingValueNumbers = playableCards.filter(
    (c) => c.color !== 'wild' && c.value === state.discardPile[state.discardPile.length - 1].value
  );
  if (matchingValueNumbers.length > 0) {
    return matchingValueNumbers[0];
  }

  // 6. Play regular Wild card
  const regularWild = playableCards.find((c) => c.value === 'wild');
  if (regularWild) {
    return regularWild;
  }

  // 7. Fallback: return first available playable card
  return playableCards[0];
}
