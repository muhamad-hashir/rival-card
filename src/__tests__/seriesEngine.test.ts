// src/__tests__/seriesEngine.test.ts - Unit tests for Rival Callout Cue Metadata & Private Room 5-Match Series
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, declareRival } from '../gameEngine';
import {
  applySeriesPlayerDeparture,
  createInitialSeriesState,
  createNextSeriesMatchState,
  getActiveSeriesPlayers,
  getSeriesStandings,
  PRIVATE_SERIES_TOTAL_MATCHES,
  recordSeriesRoundResult,
} from '../utils/seriesEngine';

describe('Audible RIVAL! Callout Cue Metadata', () => {
  test('declareRival stamps caller ID, name, and timestamp on GameState for opponent SFX detection', () => {
    let game = createGame([
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ], 'multiplayer');

    game = declareRival(game, 'u2');

    assert.equal(game.lastRivalCalledBy, 'u2');
    assert.equal(game.lastRivalCalledName, 'Bob');
    assert.equal(typeof game.lastRivalCallTimestamp, 'number');
    assert.ok((game.lastRivalCallTimestamp ?? 0) > 0);
    assert.equal(game.players.find((p) => p.id === 'u2')?.hasDeclaredRival, true);
  });
});

describe('Private Room 5-Match Series Engine', () => {
  const samplePlayers = [
    { id: 'p1', name: 'Host', isBot: false, avatarId: 'avatar_1' },
    { id: 'p2', name: 'RivalTwo', isBot: false, avatarId: 'avatar_2' },
    { id: 'p3', name: 'RivalThree', isBot: false, avatarId: 'avatar_3' },
  ];

  test('initializes Match 1 of 5 with active stats for all participants', () => {
    const state = createGame(samplePlayers, 'multiplayer', { allowStacking: true });
    state.seriesState = createInitialSeriesState(samplePlayers, 'p1');

    assert.equal(state.seriesState.isPrivateSeries, true);
    assert.equal(state.seriesState.currentMatchNumber, 1);
    assert.equal(state.seriesState.totalMatches, PRIVATE_SERIES_TOTAL_MATCHES);
    assert.equal(state.seriesState.hostPlayerId, 'p1');
    assert.equal(getActiveSeriesPlayers(state.seriesState).length, 3);
  });

  test('records round results idempotently and ranks cumulative standings across matches', () => {
    let state = createGame(samplePlayers, 'multiplayer', { allowStacking: true });
    state.seriesState = createInitialSeriesState(samplePlayers, 'p1');

    // Finish Match 1: p2 wins (0 cards), p1 has 2 cards, p3 has 5 cards
    state.players[0].hand = state.players[0].hand.slice(0, 2);
    state.players[1].hand = [];
    state.players[2].hand = state.players[2].hand.slice(0, 5);
    state.winner = state.players[1];
    state.isGameOver = true;

    state = recordSeriesRoundResult(state);
    // Calling recordSeriesRoundResult again on same match does not double-count
    state = recordSeriesRoundResult(state);

    assert.equal(state.seriesState?.roundResults.length, 1);
    assert.equal(state.seriesState?.playerStats['p2'].wins, 1);
    assert.equal(state.seriesState?.playerStats['p2'].totalPoints, 100);
    assert.equal(state.seriesState?.playerStats['p1'].totalPoints, 50);
    assert.equal(state.seriesState?.playerStats['p3'].totalPoints, 25);

    const standings = getSeriesStandings(state.seriesState!);
    assert.deepEqual(
      standings.map((s) => s.playerId),
      ['p2', 'p1', 'p3']
    );

    // Advance to Match 2 of 5 with fresh dealt hands
    const match2 = createNextSeriesMatchState(state);
    assert.equal(match2.isGameOver, false);
    assert.equal(match2.winner, null);
    assert.equal(match2.seriesState?.currentMatchNumber, 2);
    assert.equal(match2.players.length, 3);
    for (const p of match2.players) {
      assert.equal(p.hand.length, 7);
      assert.equal(p.hasDeclaredRival, false);
    }
    // Preserved stats from Match 1
    assert.equal(match2.seriesState?.playerStats['p2'].totalPoints, 100);
  });

  test('handles host departure cleanly when >= 2 players remain by promoting next active host', () => {
    let state = createGame(samplePlayers, 'multiplayer', { allowStacking: true });
    state.seriesState = createInitialSeriesState(samplePlayers, 'p1');
    state.winner = state.players[0];
    state.isGameOver = true;
    state = recordSeriesRoundResult(state);

    // Host (p1) leaves between Match 1 and Match 2
    const afterLeave = applySeriesPlayerDeparture(state, 'p1');

    assert.equal(afterLeave.seriesState?.playerStats['p1'].isActive, false);
    assert.equal(afterLeave.seriesState?.hostPlayerId, 'p2');
    assert.equal(afterLeave.seriesState?.seriesEndedEarly, false);

    // Remaining 2 players (p2, p3) advance smoothly into Match 2
    const match2 = createNextSeriesMatchState(afterLeave);
    assert.equal(match2.seriesState?.currentMatchNumber, 2);
    assert.deepEqual(
      match2.players.map((p) => p.id),
      ['p2', 'p3']
    );
  });

  test('ends series cleanly when fewer than 2 active players remain', () => {
    const twoPlayers = samplePlayers.slice(0, 2);
    let state = createGame(twoPlayers, 'multiplayer', { allowStacking: true });
    state.seriesState = createInitialSeriesState(twoPlayers, 'p1');

    const afterLeave = applySeriesPlayerDeparture(state, 'p2');
    assert.equal(afterLeave.isGameOver, true);
    assert.equal(afterLeave.seriesState?.seriesEndedEarly, true);
    assert.equal(getActiveSeriesPlayers(afterLeave.seriesState!).length, 1);
  });

  test('resetSeries=true resets scores and restarts at Match 1 of 5', () => {
    let state = createGame(samplePlayers, 'multiplayer', { allowStacking: true });
    state.seriesState = createInitialSeriesState(samplePlayers, 'p1');
    state.winner = state.players[0];
    state.isGameOver = true;
    state = recordSeriesRoundResult(state);

    const newSeries = createNextSeriesMatchState(state, true);
    assert.equal(newSeries.seriesState?.currentMatchNumber, 1);
    assert.equal(newSeries.seriesState?.roundResults.length, 0);
    assert.equal(newSeries.seriesState?.playerStats['p1'].totalPoints, 0);
    assert.equal(newSeries.seriesState?.playerStats['p1'].wins, 0);
  });
});
