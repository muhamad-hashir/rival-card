// src/__tests__/matchEndPacing.test.ts - Unit tests for 3s final winning card reveal & 5.5s minimum room scorecard display
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, playCard, playPairCards } from '../gameEngine';
import {
  createInitialSeriesState,
  recordSeriesRoundResult,
} from '../utils/seriesEngine';
import {
  FINAL_CARD_REVEAL_DELAY_MS,
  ROOM_SCORECARD_MIN_DISPLAY_MS,
  formatScorecardHoldSeconds,
  getDeferredTransitionWaitMs,
  getRemainingScorecardHoldMs,
  getScorecardHoldProgressPct,
  isRoomScorecardHoldActive,
  shouldDelayFinalCardReveal,
} from '../utils/matchEndPacing';

describe('Post-Match Pacing: 3-Second Final Card Reveal & 5.5-Second Room Scorecard Hold', () => {
  test('FINAL_CARD_REVEAL_DELAY_MS is strictly 3000ms and winning final card stays on top of discardPile', () => {
    assert.strictEqual(FINAL_CARD_REVEAL_DELAY_MS, 3000);

    // Local human or remote opponent plays their final winning card
    let state = createGame(
      [
        { id: 'p1', name: 'Host', isBot: false },
        { id: 'p2', name: 'Opponent', isBot: false },
      ],
      'multiplayer',
      { allowStacking: true }
    );
    state.seriesState = createInitialSeriesState(
      [
        { id: 'p1', name: 'Host' },
        { id: 'p2', name: 'Opponent' },
      ],
      'p1'
    );
    const winningCard = { id: 'win_red_7', color: 'red' as const, value: '7' as const, scoreValue: 7 };
    const matchingTop = { id: 'top_red_3', color: 'red' as const, value: '3' as const, scoreValue: 3 };
    state = {
      ...state,
      currentTurnIndex: 1,
      activeColor: 'red',
      discardPile: [matchingTop],
      players: [
        state.players[0],
        { ...state.players[1], hand: [winningCard] },
      ],
    };

    const wonState = playCard(state, 'p2', winningCard.id);
    assert.strictEqual(wonState.isGameOver, true);
    assert.strictEqual(wonState.winner?.id, 'p2');
    assert.strictEqual(
      wonState.discardPile[wonState.discardPile.length - 1]?.id,
      winningCard.id,
      'Winning final card must sit cleanly on top of the discard pile during the 3s reveal'
    );
    assert.strictEqual(shouldDelayFinalCardReveal(wonState), true);

    // Pair play win also places final card on top of discard pile and triggers 3s reveal
    const pairCard1 = { id: 'pair_1', color: 'blue' as const, value: '5' as const, scoreValue: 5 };
    const pairCard2 = { id: 'pair_2', color: 'blue' as const, value: '5' as const, scoreValue: 5 };
    const pairBase = {
      ...state,
      currentTurnIndex: 0,
      activeColor: 'blue' as const,
      discardPile: [{ id: 'top_blue_9', color: 'blue' as const, value: '9' as const, scoreValue: 9 }],
      players: [
        { ...state.players[0], hand: [pairCard1, pairCard2] },
        state.players[1],
      ],
    };
    const pairWonState = playPairCards(pairBase, 'p1', pairCard1.id, pairCard2.id);
    assert.strictEqual(pairWonState.isGameOver, true);
    assert.strictEqual(pairWonState.discardPile[pairWonState.discardPile.length - 1]?.id, pairCard2.id);
    assert.strictEqual(shouldDelayFinalCardReveal(pairWonState), true);
  });

  test('shouldDelayFinalCardReveal returns false for timeout, forfeit, early room exit, or active match', () => {
    const active = createGame(
      [
        { id: 'p1', name: 'You', isBot: false },
        { id: 'bot1', name: 'NovaBot', isBot: true },
      ],
      'vs_bot'
    );
    assert.strictEqual(shouldDelayFinalCardReveal(active), false);

    assert.strictEqual(
      shouldDelayFinalCardReveal({ ...active, isGameOver: true, endedByTimeout: true }),
      false
    );
    assert.strictEqual(
      shouldDelayFinalCardReveal({ ...active, isGameOver: true, forfeitedByPlayerId: 'p1' }),
      false
    );
    assert.strictEqual(
      shouldDelayFinalCardReveal({
        ...active,
        isGameOver: true,
        seriesState: {
          ...createInitialSeriesState([{ id: 'p1', name: 'You' }], 'p1'),
          seriesEndedEarly: true,
        },
      }),
      false
    );
  });

  test('ROOM_SCORECARD_MIN_DISPLAY_MS is 5500ms and countdown/progress helpers track the full window', () => {
    assert.strictEqual(ROOM_SCORECARD_MIN_DISPLAY_MS, 5500);

    const openedAt = 1_000_000;
    assert.strictEqual(getRemainingScorecardHoldMs(openedAt, openedAt), 5500);
    assert.strictEqual(isRoomScorecardHoldActive(openedAt, openedAt), true);
    assert.strictEqual(formatScorecardHoldSeconds(5500), 6);
    assert.strictEqual(getScorecardHoldProgressPct(5500), 0);

    // 2.5s elapsed -> 3000ms remaining (3s left)
    assert.strictEqual(getRemainingScorecardHoldMs(openedAt, openedAt + 2500), 3000);
    assert.strictEqual(isRoomScorecardHoldActive(openedAt, openedAt + 2500), true);
    assert.strictEqual(formatScorecardHoldSeconds(3000), 3);
    assert.strictEqual(getScorecardHoldProgressPct(3000), 45);

    // 5.499s elapsed -> 1ms remaining (still held!)
    assert.strictEqual(getRemainingScorecardHoldMs(openedAt, openedAt + 5499), 1);
    assert.strictEqual(isRoomScorecardHoldActive(openedAt, openedAt + 5499), true);
    assert.strictEqual(formatScorecardHoldSeconds(1), 1);

    // 5.5s+ elapsed -> hold lifts
    assert.strictEqual(getRemainingScorecardHoldMs(openedAt, openedAt + 5500), 0);
    assert.strictEqual(isRoomScorecardHoldActive(openedAt, openedAt + 5500), false);
    assert.strictEqual(formatScorecardHoldSeconds(0), 0);
    assert.strictEqual(getScorecardHoldProgressPct(0), 100);
  });

  test('Remote NEXT_ROUND / PLAY_AGAIN updates are deferred during 3s reveal and 5.5s room scorecard hold', () => {
    const gameOverAt = 50_000;
    const scorecardOpenedAt = 53_000;

    // Case 1: Remote NEXT_ROUND arrives 1s after winning card (still inside 3s reveal)
    // Must wait remaining 2000ms reveal + 5500ms scorecard = 7500ms
    const waitDuringReveal = getDeferredTransitionWaitMs({
      isGameOver: true,
      isOverlayReady: false,
      gameOverDetectedAtMs: gameOverAt,
      scorecardOpenedAtMs: null,
      isOnlineRoom: true,
      nowMs: gameOverAt + 1000,
    });
    assert.strictEqual(waitDuringReveal, 7500);

    // Case 2: Remote NEXT_ROUND / PLAY_AGAIN arrives 2s after scorecard opened
    // Must wait remaining 3500ms so scorecard stays visible for full 5.5s
    const waitDuringScorecard = getDeferredTransitionWaitMs({
      isGameOver: true,
      isOverlayReady: true,
      gameOverDetectedAtMs: gameOverAt,
      scorecardOpenedAtMs: scorecardOpenedAt,
      isOnlineRoom: true,
      nowMs: scorecardOpenedAt + 2000,
    });
    assert.strictEqual(waitDuringScorecard, 3500);

    // Case 3: Remote transition arrives after 5.5s window completes -> 0ms wait
    const waitAfterHold = getDeferredTransitionWaitMs({
      isGameOver: true,
      isOverlayReady: true,
      gameOverDetectedAtMs: gameOverAt,
      scorecardOpenedAtMs: scorecardOpenedAt,
      isOnlineRoom: true,
      nowMs: scorecardOpenedAt + 5500,
    });
    assert.strictEqual(waitAfterHold, 0);

    // Case 4: Non-room matches do not apply room scorecard hold
    const nonRoomWait = getDeferredTransitionWaitMs({
      isGameOver: true,
      isOverlayReady: true,
      gameOverDetectedAtMs: gameOverAt,
      scorecardOpenedAtMs: scorecardOpenedAt,
      isOnlineRoom: false,
      nowMs: scorecardOpenedAt + 1000,
    });
    assert.strictEqual(nonRoomWait, 0);
  });

  test('Room scorecard round deltas are populated per player and modals enforce hold & cleanup', () => {
    let state = createGame(
      [
        { id: 'p1', name: 'Host', isBot: false },
        { id: 'p2', name: 'Guest1', isBot: false },
        { id: 'p3', name: 'Guest2', isBot: false },
      ],
      'multiplayer'
    );
    state.seriesState = createInitialSeriesState(
      [
        { id: 'p1', name: 'Host' },
        { id: 'p2', name: 'Guest1' },
        { id: 'p3', name: 'Guest2' },
      ],
      'p1'
    );
    state.players[0].hand = [{ id: 'a', color: 'red', value: '1', scoreValue: 1 }];
    state.players[1].hand = [];
    state.players[2].hand = [
      { id: 'b', color: 'blue', value: '2', scoreValue: 2 },
      { id: 'c', color: 'blue', value: '3', scoreValue: 3 },
    ];
    state.winner = state.players[1];
    state.isGameOver = true;

    const recorded = recordSeriesRoundResult(state);
    const latestRound = recorded.seriesState?.roundResults[0];
    assert.ok(latestRound);
    assert.strictEqual(latestRound.placements.find((p) => p.playerId === 'p2')?.pointsEarned, 100);
    assert.strictEqual(latestRound.placements.find((p) => p.playerId === 'p1')?.pointsEarned, 50);
    assert.strictEqual(latestRound.placements.find((p) => p.playerId === 'p3')?.pointsEarned, 25);

    // Verify GameScreen.tsx, GameOverModal.tsx, and PrivateSeriesModal.tsx wire up pacing constants & cleanup
    const gameScreenSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/screens/GameScreen.tsx'),
      'utf8'
    );
    assert.ok(gameScreenSrc.includes('FINAL_CARD_REVEAL_DELAY_MS'));
    assert.ok(gameScreenSrc.includes('isGameOverOverlayReady'));
    assert.ok(gameScreenSrc.includes('clearPostMatchPacingTimers'));
    assert.ok(gameScreenSrc.includes('getDeferredTransitionWaitMs'));
    assert.ok(gameScreenSrc.includes('scorecardHoldRemainingMs'));

    const gameOverModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GameOverModal.tsx'),
      'utf8'
    );
    assert.ok(gameOverModalSrc.includes('ROOM_SCORECARD_MIN_DISPLAY_MS'));
    assert.ok(gameOverModalSrc.includes('isOnlineRoom'));
    assert.ok(gameOverModalSrc.includes('gameover-scorecard-hold-banner'));

    const seriesModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PrivateSeriesModal.tsx'),
      'utf8'
    );
    assert.ok(seriesModalSrc.includes('room-scorecard-hold-banner'));
    assert.ok(seriesModalSrc.includes('roundDeltaByPlayerId'));
    assert.ok(seriesModalSrc.includes('isScorecardHoldLocked'));
  });
});
