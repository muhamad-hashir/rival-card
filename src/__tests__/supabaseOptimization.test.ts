// src/__tests__/supabaseOptimization.test.ts - Unit tests for Supabase egress trimming, TTL caching, room cleanup & offline isolation
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  compactGameStateForBroadcast,
  cleanupStaleRooms,
  deleteRoomRecord,
  markRoomFinished,
  resetStaleRoomCleanupCooldown,
  STALE_ROOM_MAX_AGE_MS,
} from '../services/multiplayerService';
import {
  playerProfileService,
  PROFILE_STATS_SELECT_COLUMNS,
  PROFILE_LINK_SELECT_COLUMNS,
  LEADERBOARD_SELECT_COLUMNS,
} from '../services/playerProfileService';
import { supabase } from '../services/supabase';
import { createGame, playCard } from '../gameEngine';

describe('Supabase Egress, Indexes & Free-Tier Optimization', () => {
  const originalFrom = supabase.from;
  const originalGetSession = supabase.auth.getSession;

  beforeEach(() => {
    resetStaleRoomCleanupCooldown();
  });

  afterEach(() => {
    (supabase as any).from = originalFrom;
    (supabase.auth as any).getSession = originalGetSession;
  });

  test('No wasteful select("*") queries remain in src/services/', () => {
    const servicesDir = path.resolve(__dirname, '../services');
    const files = fs.readdirSync(servicesDir).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
      assert.strictEqual(
        /\.select\(\s*['"]\*['"]\s*\)/.test(content),
        false,
        `Found forbidden select("*") in src/services/${file}`
      );
    }

    assert.ok(!PROFILE_STATS_SELECT_COLUMNS.includes('*'));
    assert.ok(!PROFILE_LINK_SELECT_COLUMNS.includes('*'));
    assert.ok(!LEADERBOARD_SELECT_COLUMNS.includes('*'));
  });

  test('SQL migration defines rooms/profiles indexes and 2-hour stale room cleanup', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261120_optimize_storage_indexes_and_cleanup.sql'
    );
    assert.ok(fs.existsSync(migrationPath), 'Supabase migration SQL file must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.match(sql, /idx_rooms_status_created_at/);
    assert.match(sql, /idx_profiles_coins_desc/);
    assert.match(sql, /idx_profiles_wins_desc/);
    assert.match(sql, /cleanup_stale_rooms/);
    assert.match(sql, /INTERVAL '2 hours'/);
  });

  test('compactGameStateForBroadcast caps logs to 3 without nested cards and trims stale transient fields', () => {
    const state = createGame(
      [
        { id: 'u1', name: 'Alice', isBot: false },
        { id: 'u2', name: 'Bob', isBot: false },
      ],
      'multiplayer'
    );

    state.logs = Array.from({ length: 20 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: 1000 + i,
      actionType: 'PLAY_CARD',
      playerId: 'u1',
      playerName: 'Alice',
      card: { id: `c_${i}`, color: 'red', value: '5', scoreValue: 5 },
      message: `Alice played Red 5 (#${i})`,
    }));
    state.hasDrawnThisTurn = false;
    state.drawnCard = { id: 'stale_drawn', color: 'blue', value: '2', scoreValue: 2 };
    state.pendingColorChoice = false;
    state.pendingWildCard = { id: 'stale_wild', color: 'wild', value: 'wild', scoreValue: 50 };
    state.isGameOver = false;
    state.timeoutStandings = [{ playerId: 'u1', cardCount: 2, priorityScore: 10, tier1Count: 1, tier2Count: 0, tier3Count: 0, highestTier: 3 }];
    state.lastDefenseBanner = {
      id: 'old_banner',
      type: 'shield',
      message: 'Blocked!',
      timestamp: Date.now() - 25_000,
    };

    const compacted = compactGameStateForBroadcast(state, Date.now());

    assert.strictEqual(compacted.logs.length, 3);
    assert.strictEqual(compacted.logs[0].id, 'log_17');
    assert.strictEqual(compacted.logs[2].id, 'log_19');
    assert.strictEqual((compacted.logs[0] as any).card, undefined);
    assert.strictEqual(compacted.drawnCard, null);
    assert.strictEqual(compacted.pendingWildCard, null);
    assert.strictEqual(compacted.timeoutStandings, undefined);
    assert.strictEqual(compacted.lastDefenseBanner, undefined);
    assert.strictEqual(compacted.deck.length, state.deck.length);
    assert.strictEqual(compacted.players.length, 2);
  });

  test('refreshFromCloudIfAuthenticated uses explicit column list and 45s TTL cache', async () => {
    await playerProfileService.resetProfile();
    await playerProfileService.migrateAndLinkGuestAccount(
      { id: 'ttl_user_1', email: 'ttl@example.com' },
      null
    );

    let selectCalls = 0;
    let selectedCols = '';

    (supabase.auth as any).getSession = async () => ({
      data: { session: { user: { id: 'ttl_user_1' } } },
    });
    (supabase as any).from = (table: string) => {
      assert.strictEqual(table, 'profiles');
      return {
        select: (cols: string) => {
          selectCalls += 1;
          selectedCols = cols;
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'ttl_user_1', games_played: 4, wins: 2, win_streak: 1 },
                error: null,
              }),
            }),
          };
        },
      };
    };

    // First call hits Supabase with explicit lean columns
    const first = await playerProfileService.refreshFromCloudIfAuthenticated();
    assert.strictEqual(selectCalls, 1);
    assert.strictEqual(selectedCols, PROFILE_STATS_SELECT_COLUMNS);
    assert.strictEqual(first.stats.gamesPlayed, 4);

    // Second call inside 45s TTL window is served from cache (0 extra Supabase hits)
    await playerProfileService.refreshFromCloudIfAuthenticated();
    assert.strictEqual(selectCalls, 1);

    // Forced refresh bypasses TTL cleanly
    await playerProfileService.refreshFromCloudIfAuthenticated(true);
    assert.strictEqual(selectCalls, 2);
  });

  test('fetchLeaderboardTopPlayers queries indexed leaderboard columns and caches for 45s', async () => {
    await playerProfileService.resetProfile();
    let queries = 0;
    let queriedCols = '';

    (supabase as any).from = (table: string) => {
      assert.strictEqual(table, 'profiles');
      return {
        select: (cols: string) => {
          queries += 1;
          queriedCols = cols;
          return {
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: 'p_top',
                      nickname: 'Champ',
                      avatar_id: 'avatar_6',
                      level: 7,
                      coins: 2400,
                      wins: 18,
                      win_streak: 5,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    };

    const first = await playerProfileService.fetchLeaderboardTopPlayers('coins', 10);
    assert.strictEqual(queries, 1);
    assert.strictEqual(queriedCols, LEADERBOARD_SELECT_COLUMNS);
    assert.strictEqual(first[0].nickname, 'Champ');

    const second = await playerProfileService.fetchLeaderboardTopPlayers('coins', 10);
    assert.strictEqual(queries, 1);
    assert.strictEqual(second.length, 1);
  });

  test('Room cleanup deletes finished/empty rooms and enforces stale sweep cooldown', async () => {
    const deleteCalls: Array<{ table: string; op: string; arg: string }> = [];

    (supabase as any).from = (table: string) => ({
      delete: () => ({
        eq: async (col: string, val: string) => {
          deleteCalls.push({ table, op: `eq:${col}`, arg: val });
          return { error: null };
        },
        or: async (filter: string) => {
          deleteCalls.push({ table, op: 'or', arg: filter });
          return { error: null };
        },
      }),
    });

    await markRoomFinished('4821');
    await deleteRoomRecord('4822');
    const swept1 = await cleanupStaleRooms(STALE_ROOM_MAX_AGE_MS);
    const swept2 = await cleanupStaleRooms(STALE_ROOM_MAX_AGE_MS);

    assert.strictEqual(swept1, true);
    assert.strictEqual(swept2, false, 'Second sweep within cooldown should be throttled');
    assert.strictEqual(deleteCalls[0].table, 'rooms');
    assert.strictEqual(deleteCalls[0].arg, '4821');
    assert.strictEqual(deleteCalls[1].arg, '4822');
    assert.match(deleteCalls[2].arg, /status\.eq\.finished/);
    assert.match(deleteCalls[2].arg, /player_count\.lte\.0/);
  });

  test('Offline vs_bot and pass_and_play gameplay turns trigger zero Supabase network calls', async () => {
    await playerProfileService.resetProfile();
    let supabaseFromCalled = 0;

    (supabase as any).from = () => {
      supabaseFromCalled += 1;
      return {} as any;
    };

    let state = createGame(
      [
        { id: 'local_p1', name: 'Hero', isBot: false },
        { id: 'bot_1', name: 'Bot', isBot: true },
      ],
      'vs_bot'
    );
    state.discardPile = [{ id: 'top_red', color: 'red', value: '3', scoreValue: 3 }];
    state.activeColor = 'red';
    state.players[0].hand = [
      { id: 'p1_c1', color: 'red', value: '5', scoreValue: 5 },
      { id: 'p1_c2', color: 'blue', value: '7', scoreValue: 7 },
    ];

    state = playCard(state, 'local_p1', 'p1_c1');
    assert.strictEqual(supabaseFromCalled, 0);

    // Offline reward tally for Pass & Play makes 0 cloud sync calls
    const ppRewards = await playerProfileService.awardMatchRewards(true, 8, 'pass_and_play');
    assert.strictEqual(ppRewards.earnedCoins, 0);
    assert.strictEqual(supabaseFromCalled, 0);
  });
});
