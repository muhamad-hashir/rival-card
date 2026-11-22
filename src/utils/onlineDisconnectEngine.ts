// src/utils/onlineDisconnectEngine.ts - Pure UNO! Mobile-style disconnect, forfeit & AI takeover engine
import {
  declareRival,
  getDominantColor,
  hasIdenticalPair,
  isValidMove,
  isWildCard,
  playCard,
  playPairCards,
  playerDrawCard,
  playerPassTurn,
  resolvePendingDraw,
} from '../gameEngine';
import type { Card, GameState, Player } from '../types';

export const MAX_1V1_MISSED_TURNS = 2;
export const ONLINE_BOT_TAKEOVER_DELAY_MS = 1200;

export interface OnlineTimeoutResult {
  nextState: GameState;
  outcome: 'forfeit_win' | 'missed_turn_1' | 'bot_takeover_turn' | 'noop';
  forfeitedPlayerId?: string;
  winnerId?: string;
  actionDescription: string;
}

/**
 * Returns true when an online match uses strict 1v1 2-missed-turn forfeit rules.
 * Multi-player rooms (> 2 players) and 2v2 matches use seamless AI Bot Takeover instead.
 */
export function isTwoPlayerOnlineMatch(state: Pick<GameState, 'players' | 'is2v2'>): boolean {
  return state.players.length === 2 && !state.is2v2;
}

/**
 * Resets missed-turn counters and clears AI Bot Takeover flags when a human plays manually.
 */
export function resetMissedTurnsOnManualMove(state: GameState, playerId: string): GameState {
  if (!playerId) return state;
  let changed = false;
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    if ((p.consecutiveMissedTurns ?? 0) === 0 && !p.isBotControlled && !p.isDisconnected) {
      return p;
    }
    changed = true;
    return {
      ...p,
      consecutiveMissedTurns: 0,
      isBotControlled: false,
      isDisconnected: false,
    };
  });
  return changed ? { ...state, players } : state;
}

/**
 * Activates seamless AI Bot Takeover (`isBotControlled = true`) for a disconnected/AFK seat
 * in 3-4 player / 2v2 / multi-player Room matches without kicking or forfeiting them.
 */
export function activateBotTakeover(state: GameState, playerId: string): GameState {
  if (state.isGameOver || isTwoPlayerOnlineMatch(state)) return state;
  let changed = false;
  const players = state.players.map((p) => {
    if (p.id !== playerId || p.isBot) return p;
    if (p.isBotControlled && p.isDisconnected) return p;
    changed = true;
    return {
      ...p,
      isBotControlled: true,
      isDisconnected: true,
    };
  });
  return changed ? { ...state, players, lastActionTimestamp: Date.now() } : state;
}

/**
 * Restores manual human control (`isBotControlled = false`) when a disconnected player reconnects.
 */
export function reclaimHumanControl(state: GameState, playerId: string): GameState {
  if (!playerId) return state;
  let changed = false;
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    if (!p.isBotControlled && !p.isDisconnected && (p.consecutiveMissedTurns ?? 0) === 0) {
      return p;
    }
    changed = true;
    return {
      ...p,
      isBotControlled: false,
      isDisconnected: false,
      consecutiveMissedTurns: 0,
    };
  });
  return changed ? { ...state, players, lastActionTimestamp: Date.now() } : state;
}

/**
 * Elects a single authoritative connected client to execute AI Bot Takeover moves
 * in multi-player / 2v2 rooms, preventing duplicate simultaneous move broadcasts.
 */
export function shouldClientDriveBotTakeoverTurn(
  state: Pick<GameState, 'players' | 'currentTurnIndex' | 'isGameOver' | 'is2v2'>,
  localPlayerId: string | null | undefined,
  isHost: boolean
): boolean {
  if (state.isGameOver || !localPlayerId || isTwoPlayerOnlineMatch(state)) {
    return false;
  }
  const activePlayer = state.players[state.currentTurnIndex];
  if (!activePlayer || !activePlayer.isBotControlled) {
    return false;
  }

  const localPlayer = state.players.find((p) => p.id === localPlayerId);
  if (!localPlayer || localPlayer.isBotControlled || localPlayer.isDisconnected) {
    return false;
  }

  if (isHost) {
    return true;
  }

  const fallbackDriver =
    state.players.find((p) => !p.isBot && !p.isBotControlled && !p.isDisconnected) ??
    state.players.find((p) => !p.isBot && !p.isBotControlled);
  return fallbackDriver?.id === localPlayerId;
}

/**
 * Executes a single safe valid AI turn for a timed-out or bot-controlled online seat.
 */
export function executeSafeBotFallbackTurn(
  state: GameState,
  playerId: string
): { nextState: GameState; actionDescription: string; cardPlayed?: Card } {
  const actor = state.players.find((p) => p.id === playerId);
  if (!actor || state.isGameOver) {
    return { nextState: state, actionDescription: 'No move taken' };
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!topCard) {
    return { nextState: state, actionDescription: 'No top card available' };
  }

  // 1. Resolve active draw stack (+2 / +4)
  if ((state.pendingDrawCount || 0) > 0) {
    const stackable = actor.hand.filter((c) =>
      isValidMove(c, topCard, state.activeColor, state.pendingDrawCount)
    );
    if (stackable.length > 0) {
      const cardToPlay = stackable[0];
      const pair = hasIdenticalPair(actor.hand, cardToPlay);
      let prepState = state;
      const leftAfter = actor.hand.length - (pair ? 2 : 1);
      if (leftAfter === 1) {
        prepState = declareRival(prepState, actor.id);
      }
      const nextState = pair
        ? playPairCards(prepState, actor.id, cardToPlay.id, pair.id)
        : playCard(prepState, actor.id, cardToPlay.id);
      return {
        nextState,
        actionDescription: `${actor.name} (Bot) stacked ${cardToPlay.value}`,
        cardPlayed: cardToPlay,
      };
    }

    const nextState = resolvePendingDraw(state, actor.id);
    return {
      nextState,
      actionDescription: `${actor.name} (Bot) drew +${state.pendingDrawCount} cards`,
    };
  }

  // 2. If already drawn this turn, play drawn card if valid or pass
  if (state.hasDrawnThisTurn) {
    const drawnCard = state.drawnCard;
    if (drawnCard && isValidMove(drawnCard, topCard, state.activeColor, 0)) {
      const chosenColor = isWildCard(drawnCard)
        ? getDominantColor(actor.hand.filter((c) => c.id !== drawnCard.id))
        : undefined;
      let prepState = state;
      if (actor.hand.length - 1 === 1) {
        prepState = declareRival(prepState, actor.id);
      }
      const nextState = playCard(prepState, actor.id, drawnCard.id, { chosenColor });
      return {
        nextState,
        actionDescription: `${actor.name} played ${drawnCard.color} ${drawnCard.value}`,
        cardPlayed: drawnCard,
      };
    }
    const nextState = playerPassTurn(state, actor.id);
    return {
      nextState,
      actionDescription: `${actor.name} passed turn`,
    };
  }

  // 3. Find valid playable card(s)
  const playableCards = actor.hand.filter((c) =>
    isValidMove(c, topCard, state.activeColor, 0)
  );

  if (playableCards.length > 0) {
    const chosenCard = playableCards[0];
    const pair = hasIdenticalPair(actor.hand, chosenCard);
    const chosenColor = isWildCard(chosenCard)
      ? getDominantColor(
          actor.hand.filter((c) => c.id !== chosenCard.id && (!pair || c.id !== pair.id))
        )
      : undefined;

    let prepState = state;
    const leftAfter = actor.hand.length - (pair ? 2 : 1);
    if (leftAfter === 1) {
      prepState = declareRival(prepState, actor.id);
    }
    const nextState = pair
      ? playPairCards(prepState, actor.id, chosenCard.id, pair.id, { chosenColor })
      : playCard(prepState, actor.id, chosenCard.id, { chosenColor });

    return {
      nextState,
      actionDescription: `${actor.name} played ${chosenCard.color} ${chosenCard.value}`,
      cardPlayed: chosenCard,
    };
  }

  // 4. No valid cards: draw 1 card and pass (or play if drawn card isn't forced; pass safely)
  const drawnState = playerDrawCard(state, actor.id);
  const passedState = playerPassTurn(drawnState, actor.id);
  return {
    nextState: passedState,
    actionDescription: `${actor.name} auto-drew & passed`,
  };
}

/**
 * Applies UNO! Mobile-style turn-timeout resolution for online matches:
 * - 1v1 (`players.length === 2 && !is2v2`):
 *   - Turn 1 missed: increments `consecutiveMissedTurns` to 1 and runs a safe fallback move.
 *   - Turn 2 missed in a row (`consecutiveMissedTurns >= 2`): forfeits immediately and awards win to opponent.
 * - 3-4 Player / 2v2 / Multi-player Room:
 *   - Never forfeits on 2 missed turns; enables `isBotControlled = true` and plays a safe AI turn.
 */
export function handleOnlineTurnTimeout(
  state: GameState,
  timedOutPlayerId?: string
): OnlineTimeoutResult {
  if (state.isGameOver || state.gameMode !== 'multiplayer' || state.players.length < 2) {
    return { nextState: state, outcome: 'noop', actionDescription: 'Match inactive' };
  }

  const targetIndex = timedOutPlayerId
    ? state.players.findIndex((p) => p.id === timedOutPlayerId)
    : state.currentTurnIndex;
  if (targetIndex === -1) {
    return { nextState: state, outcome: 'noop', actionDescription: 'Target player missing' };
  }

  const targetPlayer = state.players[targetIndex];
  const nextMissedCount = (targetPlayer.consecutiveMissedTurns ?? 0) + 1;

  if (isTwoPlayerOnlineMatch(state)) {
    // 1v1 Rule: 2 consecutive missed turns = immediate forfeit win for opponent
    if (nextMissedCount >= MAX_1V1_MISSED_TURNS) {
      const winnerPlayer: Player =
        state.players.find((p) => p.id !== targetPlayer.id) || state.players[0];

      const updatedPlayers = state.players.map((p) =>
        p.id === targetPlayer.id
          ? {
              ...p,
              consecutiveMissedTurns: nextMissedCount,
              hasForfeited: true,
              isDisconnected: true,
              isBotControlled: false,
            }
          : p
      );

      const resolvedWinner =
        updatedPlayers.find((p) => p.id === winnerPlayer.id) || winnerPlayer;

      const forfeitState: GameState = {
        ...state,
        players: updatedPlayers,
        winner: resolvedWinner,
        isGameOver: true,
        forfeitedByPlayerId: targetPlayer.id,
        disconnectOutcomeReason: '1v1_two_missed_turns',
        pendingColorChoice: false,
        pendingWildCard: null,
        pendingDefense: null,
        privacyMask: {
          ...state.privacyMask,
          isActive: false,
        },
        lastActionTimestamp: Date.now(),
        logs: [
          ...state.logs,
          {
            id: `log-forfeit-${Date.now()}`,
            timestamp: Date.now(),
            actionType: 'PASS_TURN',
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            message: `${targetPlayer.name} missed 2 turns in a row — ${resolvedWinner.name} wins by forfeit!`,
          },
        ],
      };

      return {
        nextState: forfeitState,
        outcome: 'forfeit_win',
        forfeitedPlayerId: targetPlayer.id,
        winnerId: resolvedWinner.id,
        actionDescription: `${targetPlayer.name} forfeited after 2 missed turns`,
      };
    }

    // 1v1 Missed Turn #1: advance cleanly via fallback while preserving consecutiveMissedTurns = 1
    const { nextState: advancedState, actionDescription } = executeSafeBotFallbackTurn(
      state,
      targetPlayer.id
    );
    const updatedPlayers = advancedState.players.map((p) =>
      p.id === targetPlayer.id
        ? {
            ...p,
            consecutiveMissedTurns: nextMissedCount,
            isBotControlled: false,
          }
        : p
    );

    return {
      nextState: {
        ...advancedState,
        players: updatedPlayers,
      },
      outcome: 'missed_turn_1',
      actionDescription: `${actionDescription} (Missed turn 1/2)`,
    };
  }

  // 3-4 Player / 2v2 / Multi-Player Room: Activate seamless AI Bot Takeover instead of forfeit
  const takenOverState = activateBotTakeover(state, targetPlayer.id);
  const { nextState: botAdvancedState, actionDescription } = executeSafeBotFallbackTurn(
    takenOverState,
    targetPlayer.id
  );
  const updatedPlayers = botAdvancedState.players.map((p) =>
    p.id === targetPlayer.id
      ? {
          ...p,
          consecutiveMissedTurns: nextMissedCount,
          isBotControlled: true,
          isDisconnected: true,
          hasForfeited: false,
        }
      : p
  );

  return {
    nextState: {
      ...botAdvancedState,
      players: updatedPlayers,
    },
    outcome: 'bot_takeover_turn',
    actionDescription: `${actionDescription} (AI Takeover)`,
  };
}
