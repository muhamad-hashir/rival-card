// src/utils/matchEndPacing.ts - Timing & hold helpers for final winning card reveal and room scorecard pacing
import type { GameState } from '../types';

/**
 * Duration (ms) to keep the board and winning final card visible on top of the
 * discard pile before opening GameOverModal / PrivateSeriesModal.
 */
export const FINAL_CARD_REVEAL_DELAY_MS = 3000;

/**
 * Minimum duration (ms) to keep the Online Room Scorecard / Standings view visible
 * before auto-advancing to Match Rewards or starting the next match in the series.
 */
export const ROOM_SCORECARD_MIN_DISPLAY_MS = 5500;

export type FinalCardRevealInput = Pick<
  GameState,
  'isGameOver' | 'endedByTimeout' | 'forfeitedByPlayerId' | 'discardPile' | 'seriesState'
>;

/**
 * Returns true when a match ended by a player playing their final winning card
 * (local or remote opponent in Solo, Quick Match, Pass & Play, or Online Rooms),
 * so the board remains visible for `FINAL_CARD_REVEAL_DELAY_MS` before the overlay opens.
 */
export function shouldDelayFinalCardReveal(state: FinalCardRevealInput): boolean {
  if (!state.isGameOver) return false;
  if (state.endedByTimeout) return false;
  if (state.forfeitedByPlayerId) return false;
  if (state.seriesState?.seriesEndedEarly) return false;
  return Array.isArray(state.discardPile) && state.discardPile.length > 0;
}

/**
 * Computes remaining milliseconds in the minimum Online Room scorecard display window.
 */
export function getRemainingScorecardHoldMs(
  scorecardOpenedAtMs: number | null,
  nowMs: number = Date.now(),
  minDisplayMs: number = ROOM_SCORECARD_MIN_DISPLAY_MS
): number {
  if (scorecardOpenedAtMs === null) return 0;
  const elapsed = Math.max(0, nowMs - scorecardOpenedAtMs);
  return Math.max(0, minDisplayMs - elapsed);
}

/**
 * Returns true while the Online Room scorecard minimum hold window is still active.
 */
export function isRoomScorecardHoldActive(
  scorecardOpenedAtMs: number | null,
  nowMs: number = Date.now(),
  minDisplayMs: number = ROOM_SCORECARD_MIN_DISPLAY_MS
): boolean {
  return getRemainingScorecardHoldMs(scorecardOpenedAtMs, nowMs, minDisplayMs) > 0;
}

/**
 * Formats remaining scorecard hold milliseconds into whole ceiling seconds for UI countdowns.
 */
export function formatScorecardHoldSeconds(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

/**
 * Computes 0-100 progress percentage across the minimum scorecard display window.
 */
export function getScorecardHoldProgressPct(
  remainingMs: number,
  minDisplayMs: number = ROOM_SCORECARD_MIN_DISPLAY_MS
): number {
  if (minDisplayMs <= 0) return 100;
  const clampedRemaining = Math.min(minDisplayMs, Math.max(0, remainingMs));
  return Math.min(100, Math.max(0, Math.round(((minDisplayMs - clampedRemaining) / minDisplayMs) * 100)));
}

export interface DeferredTransitionWaitInput {
  isGameOver: boolean;
  isOverlayReady: boolean;
  gameOverDetectedAtMs: number | null;
  scorecardOpenedAtMs: number | null;
  isOnlineRoom: boolean;
  nowMs?: number;
  revealDelayMs?: number;
  minScorecardMs?: number;
}

/**
 * Computes how long a remote room NEXT_ROUND / PLAY_AGAIN transition must wait so it
 * never dismisses the final card reveal or the 5.5-second minimum scorecard window early.
 */
export function getDeferredTransitionWaitMs(input: DeferredTransitionWaitInput): number {
  if (!input.isOnlineRoom || !input.isGameOver) {
    return 0;
  }

  const nowMs = input.nowMs ?? Date.now();
  const revealDelayMs = input.revealDelayMs ?? FINAL_CARD_REVEAL_DELAY_MS;
  const minScorecardMs = input.minScorecardMs ?? ROOM_SCORECARD_MIN_DISPLAY_MS;

  if (!input.isOverlayReady) {
    const remainingReveal =
      input.gameOverDetectedAtMs !== null
        ? Math.max(0, revealDelayMs - Math.max(0, nowMs - input.gameOverDetectedAtMs))
        : revealDelayMs;
    return remainingReveal + minScorecardMs;
  }

  return getRemainingScorecardHoldMs(input.scorecardOpenedAtMs, nowMs, minScorecardMs);
}
