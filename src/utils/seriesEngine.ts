// src/utils/seriesEngine.ts - Pure state engine for Private Room 5-Match Series
import { createGame } from '../gameEngine';
import type {
  GameState,
  Player,
  SeriesPlayerStats,
  SeriesRoundResult,
  SeriesState,
} from '../types';

export const PRIVATE_SERIES_TOTAL_MATCHES = 5;
export const SERIES_PLACEMENT_POINTS = [100, 50, 25, 10] as const;

export interface SeriesPlayerInput {
  id: string;
  name: string;
  avatarId?: string;
}

/**
 * Initialize a continuous 5-match series tracker for a private multiplayer room.
 */
export function createInitialSeriesState(
  players: ReadonlyArray<SeriesPlayerInput>,
  hostPlayerId: string,
  totalMatches: number = PRIVATE_SERIES_TOTAL_MATCHES
): SeriesState {
  const playerStats: Record<string, SeriesPlayerStats> = {};
  for (const player of players) {
    playerStats[player.id] = {
      playerId: player.id,
      name: player.name,
      avatarId: player.avatarId,
      wins: 0,
      totalPoints: 0,
      roundPlacements: [],
      isActive: true,
    };
  }

  return {
    isPrivateSeries: true,
    currentMatchNumber: 1,
    totalMatches,
    hostPlayerId,
    playerStats,
    roundResults: [],
    seriesEndedEarly: false,
  };
}

/**
 * Record the completed round's winner and ranked placements into `seriesState`.
 * Idempotent per match number so repeated calls or remote syncs never double-count points.
 */
export function recordSeriesRoundResult(state: GameState): GameState {
  const series = state.seriesState;
  if (!series || !series.isPrivateSeries || !state.isGameOver || !state.winner) {
    return state;
  }

  const alreadyRecorded = series.roundResults.some(
    (r) => r.matchNumber === series.currentMatchNumber
  );
  if (alreadyRecorded) {
    return state;
  }

  const winnerId = state.winner.id;
  const rankedPlayers = [...state.players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    if (a.hand.length !== b.hand.length) {
      return a.hand.length - b.hand.length;
    }
    const scoreA = a.hand.reduce((sum, c) => sum + c.scoreValue, 0);
    const scoreB = b.hand.reduce((sum, c) => sum + c.scoreValue, 0);
    return scoreA - scoreB;
  });

  const nextStats: Record<string, SeriesPlayerStats> = { ...series.playerStats };
  const placements: SeriesRoundResult['placements'] = rankedPlayers.map((player, index) => {
    const rank = index + 1;
    const pointsEarned =
      SERIES_PLACEMENT_POINTS[index] ??
      Math.max(5, 10 - (index - SERIES_PLACEMENT_POINTS.length + 1) * 2);

    const existing = nextStats[player.id] ?? {
      playerId: player.id,
      name: player.name,
      avatarId: player.avatarId,
      wins: 0,
      totalPoints: 0,
      roundPlacements: [],
      isActive: true,
    };

    nextStats[player.id] = {
      ...existing,
      name: player.name,
      avatarId: player.avatarId ?? existing.avatarId,
      wins: existing.wins + (rank === 1 ? 1 : 0),
      totalPoints: existing.totalPoints + pointsEarned,
      roundPlacements: [...existing.roundPlacements, rank],
    };

    return {
      playerId: player.id,
      name: player.name,
      rank,
      cardsLeft: player.hand.length,
      pointsEarned,
    };
  });

  const roundResult: SeriesRoundResult = {
    matchNumber: series.currentMatchNumber,
    winnerId,
    winnerName: state.winner.name,
    placements,
  };

  return {
    ...state,
    seriesState: {
      ...series,
      playerStats: nextStats,
      roundResults: [...series.roundResults, roundResult],
    },
  };
}

/**
 * Rank all series participants for standings and Final Series Scorecard.
 * Orders by totalPoints desc, then wins desc, then active status, then best average rank.
 */
export function getSeriesStandings(seriesState: SeriesState): SeriesPlayerStats[] {
  return Object.values(seriesState.playerStats).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    const avgA =
      a.roundPlacements.length > 0
        ? a.roundPlacements.reduce((s, r) => s + r, 0) / a.roundPlacements.length
        : 99;
    const avgB =
      b.roundPlacements.length > 0
        ? b.roundPlacements.reduce((s, r) => s + r, 0) / b.roundPlacements.length
        : 99;
    if (avgA !== avgB) {
      return avgA - avgB;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Return active players remaining in the private room series.
 */
export function getActiveSeriesPlayers(
  seriesState: SeriesState,
  orderedPlayers?: ReadonlyArray<Player>
): SeriesPlayerStats[] {
  const orderedIds = orderedPlayers?.map((p) => p.id) ?? [];
  const allStats = Object.values(seriesState.playerStats).filter((p) => p.isActive);

  if (orderedIds.length === 0) return allStats;

  return [...allStats].sort((a, b) => {
    const idxA = orderedIds.indexOf(a.playerId);
    const idxB = orderedIds.indexOf(b.playerId);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

/**
 * Build the freshly dealt GameState for the next match in the 5-match series
 * (or restart a fresh 5-match series with reset standings when `resetSeries = true`).
 */
export function createNextSeriesMatchState(
  previousState: GameState,
  resetSeries: boolean = false
): GameState {
  const prevSeries = previousState.seriesState;
  if (!prevSeries) {
    throw new Error('Cannot advance series match without active seriesState.');
  }

  const activePlayers = getActiveSeriesPlayers(prevSeries, previousState.players);
  if (activePlayers.length < 2) {
    return {
      ...previousState,
      isGameOver: true,
      seriesState: {
        ...prevSeries,
        seriesEndedEarly: true,
        endedReason: 'Fewer than 2 players remain in the room.',
      },
    };
  }

  const playerConfigs = activePlayers.map((p) => ({
    id: p.playerId,
    name: p.name,
    isBot: false,
    avatarId: p.avatarId,
  }));

  const freshGame = createGame(playerConfigs, 'multiplayer', { allowStacking: true });

  const nextSeriesState: SeriesState = resetSeries
    ? createInitialSeriesState(
        playerConfigs,
        prevSeries.hostPlayerId,
        prevSeries.totalMatches
      )
    : {
        ...prevSeries,
        currentMatchNumber: Math.min(prevSeries.currentMatchNumber + 1, prevSeries.totalMatches),
        seriesEndedEarly: false,
        endedReason: undefined,
      };

  return {
    ...freshGame,
    seriesState: nextSeriesState,
  };
}

/**
 * Cleanly handle a player leaving a Private Room 5-Match Series.
 * - Marks player inactive in series stats.
 * - Deterministically promotes next active player as host if the host left.
 * - Removes player from active turn rotation if mid-match.
 * - Ends series gracefully if fewer than 2 active players remain.
 */
export function applySeriesPlayerDeparture(
  state: GameState,
  departedPlayerId: string
): GameState {
  const series = state.seriesState;
  if (!series || !series.isPrivateSeries) {
    return state;
  }

  const existingStat = series.playerStats[departedPlayerId];
  const updatedStats: Record<string, SeriesPlayerStats> = {
    ...series.playerStats,
    ...(existingStat
      ? {
          [departedPlayerId]: {
            ...existingStat,
            isActive: false,
          },
        }
      : {}),
  };

  const remainingPlayersInHand = state.players.filter((p) => p.id !== departedPlayerId);
  const remainingActiveStats = Object.values(updatedStats).filter((p) => p.isActive);

  // Determine deterministic host (keep current if active, otherwise first remaining active player)
  const nextHostId =
    updatedStats[series.hostPlayerId]?.isActive
      ? series.hostPlayerId
      : remainingPlayersInHand.find((p) => updatedStats[p.id]?.isActive)?.id ||
        remainingActiveStats[0]?.playerId ||
        series.hostPlayerId;

  const nextSeries: SeriesState = {
    ...series,
    hostPlayerId: nextHostId,
    playerStats: updatedStats,
  };

  // Fewer than 2 active players left: conclude series cleanly into Final Scorecard
  if (remainingActiveStats.length < 2) {
    const soleSurvivor = remainingPlayersInHand[0] ?? state.winner ?? state.players[0] ?? null;
    const endedState: GameState = {
      ...state,
      players: remainingPlayersInHand.length > 0 ? remainingPlayersInHand : state.players,
      currentTurnIndex: 0,
      winner: state.winner ?? soleSurvivor,
      isGameOver: true,
      pendingColorChoice: false,
      pendingWildCard: null,
      seriesState: {
        ...nextSeries,
        seriesEndedEarly: true,
        endedReason: 'Fewer than 2 players remain in the room.',
      },
    };
    return endedState.winner ? recordSeriesRoundResult(endedState) : endedState;
  }

  // 2+ players still active: adjust active round rotation if match is in progress
  if (!state.isGameOver && remainingPlayersInHand.length !== state.players.length) {
    const departedIndex = state.players.findIndex((p) => p.id === departedPlayerId);
    let nextTurnIndex = state.currentTurnIndex;
    if (departedIndex !== -1) {
      if (departedIndex < state.currentTurnIndex) {
        nextTurnIndex = Math.max(0, state.currentTurnIndex - 1);
      } else if (departedIndex === state.currentTurnIndex) {
        nextTurnIndex = state.currentTurnIndex % remainingPlayersInHand.length;
      }
    }
    nextTurnIndex = nextTurnIndex % remainingPlayersInHand.length;

    return {
      ...state,
      players: remainingPlayersInHand,
      currentTurnIndex: nextTurnIndex,
      seriesState: nextSeries,
    };
  }

  return {
    ...state,
    seriesState: nextSeries,
  };
}
