// src/__tests__/playerProfileService.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEligibleCareerStatMatch,
  playerProfileService,
  AVATAR_OPTIONS,
  getAvatarConfig,
} from '../services/playerProfileService';

describe('Player Profile Service (Guest Profile System)', () => {
  beforeEach(async () => {
    await playerProfileService.resetProfile();
  });

  it('initializes default guest profile with 0 stats and default avatar', async () => {
    const profile = await playerProfileService.getProfile();
    assert.ok(profile.id, 'Profile should have a unique ID');
    assert.strictEqual(profile.nickname, 'Player');
    assert.strictEqual(profile.avatarId, 'avatar_1');
    assert.strictEqual(profile.isGuest, true);
    assert.strictEqual(profile.stats.gamesPlayed, 0);
    assert.strictEqual(profile.stats.wins, 0);
    assert.strictEqual(profile.stats.winStreak, 0);
  });

  it('updates and persists nickname with trimming and 16-char limit', async () => {
    const updated = await playerProfileService.updateNickname('  AcePlayer  ');
    assert.strictEqual(updated.nickname, 'AcePlayer');

    // Verify persistence via getProfile
    const fetched = await playerProfileService.getProfile();
    assert.strictEqual(fetched.nickname, 'AcePlayer');

    // Test max length trimming (16 chars)
    const longName = await playerProfileService.updateNickname('SuperUltraChampionPlayer');
    assert.strictEqual(longName.nickname.length, 16);
    assert.strictEqual(longName.nickname, 'SuperUltraChampi');

    // Fallback to 'Player' on empty string
    const empty = await playerProfileService.updateNickname('   ');
    assert.strictEqual(empty.nickname, 'Player');
  });

  it('updates avatar only with valid avatar IDs and falls back on invalid', async () => {
    const updated = await playerProfileService.updateAvatar('avatar_4');
    assert.strictEqual(updated.avatarId, 'avatar_4');

    const config = getAvatarConfig(updated.avatarId);
    assert.strictEqual(config.id, 'avatar_4');
    assert.strictEqual(config.emoji, '🐼');

    // Invalid avatar id fallback
    const invalid = await playerProfileService.updateAvatar('invalid_avatar_999');
    assert.strictEqual(invalid.avatarId, 'avatar_1');
  });

  it('records match wins correctly and tracks win streaks', async () => {
    // 1st win
    let p = await playerProfileService.recordMatchResult(true);
    assert.strictEqual(p.stats.gamesPlayed, 1);
    assert.strictEqual(p.stats.wins, 1);
    assert.strictEqual(p.stats.winStreak, 1);

    // 2nd win (streak = 2)
    p = await playerProfileService.recordMatchResult(true);
    assert.strictEqual(p.stats.gamesPlayed, 2);
    assert.strictEqual(p.stats.wins, 2);
    assert.strictEqual(p.stats.winStreak, 2);

    // 1 loss (streak resets to 0, gamesPlayed = 3, wins = 2)
    p = await playerProfileService.recordMatchResult(false);
    assert.strictEqual(p.stats.gamesPlayed, 3);
    assert.strictEqual(p.stats.wins, 2);
    assert.strictEqual(p.stats.winStreak, 0);

    // 1 win after loss (streak becomes 1)
    p = await playerProfileService.recordMatchResult(true);
    assert.strictEqual(p.stats.gamesPlayed, 4);
    assert.strictEqual(p.stats.wins, 3);
    assert.strictEqual(p.stats.winStreak, 1);
  });

  it('dispatches subscriber notifications upon profile mutation', async () => {
    const notifications: string[] = [];
    const unsubscribe = playerProfileService.subscribe((profile) => {
      notifications.push(profile.nickname);
    });

    await playerProfileService.updateNickname('NovaStriker');
    assert.ok(notifications.includes('NovaStriker'));

    unsubscribe();
    const countBefore = notifications.length;
    await playerProfileService.updateNickname('Ghost');
    assert.strictEqual(notifications.length, countBefore, 'Should not notify after unsubscribe');
  });

  it('provides avatar options list with required assets and emojis', () => {
    assert.ok(AVATAR_OPTIONS.length >= 6);
    for (const opt of AVATAR_OPTIONS) {
      assert.ok(opt.id.startsWith('avatar_'));
      assert.ok(opt.emoji.length > 0);
      assert.ok(opt.label.length > 0);
      assert.ok(opt.bgColor.startsWith('#'));
    }
  });

  it('mirrors to window.localStorage when available on web preview', async () => {
    // Mock global window.localStorage
    const mockStorage: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
      },
    };

    await playerProfileService.updateNickname('WebHero');
    const stored = (globalThis as any).window.localStorage.getItem('@rival_card_guest_player_profile_v1');
    assert.ok(stored, 'Should persist directly to localStorage');
    const parsed = JSON.parse(stored);
    assert.strictEqual(parsed.nickname, 'WebHero');

    delete (globalThis as any).window;
  });

  it('tracks losses, winRate, bestStreak, rivalCalls, and enforces matchId idempotency', async () => {
    let p = await playerProfileService.recordMatchResult(true, {
      matchId: 'mp_match_1',
      rivalCalls: 1,
    });
    assert.strictEqual(p.stats.gamesPlayed, 1);
    assert.strictEqual(p.stats.wins, 1);
    assert.strictEqual(p.stats.losses, 0);
    assert.strictEqual(p.stats.winRate, 100);
    assert.strictEqual(p.stats.winStreak, 1);
    assert.strictEqual(p.stats.bestStreak, 1);
    assert.strictEqual(p.stats.rivalCalls, 1);

    // Duplicate matchId must NOT double-count
    p = await playerProfileService.recordMatchResult(true, {
      matchId: 'mp_match_1',
      rivalCalls: 1,
    });
    assert.strictEqual(p.stats.gamesPlayed, 1);
    assert.strictEqual(p.stats.wins, 1);
    assert.strictEqual(p.stats.rivalCalls, 1);

    // Loss increments losses, resets winStreak, preserves bestStreak=1, updates winRate=50%
    p = await playerProfileService.recordMatchResult(false, {
      matchId: 'mp_match_2',
      rivalCalls: 2,
    });
    assert.strictEqual(p.stats.gamesPlayed, 2);
    assert.strictEqual(p.stats.wins, 1);
    assert.strictEqual(p.stats.losses, 1);
    assert.strictEqual(p.stats.winRate, 50);
    assert.strictEqual(p.stats.winStreak, 0);
    assert.strictEqual(p.stats.bestStreak, 1);
    assert.strictEqual(p.stats.rivalCalls, 3);
  });

  it('allows Career Stats strictly for public human-vs-human multiplayer matches only', () => {
    // Qualifying public human-vs-human Quick Match
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'multiplayer',
        isQuickMatch: true,
        isPrivateSeries: false,
        localPlayerId: 'user_1',
        players: [
          { id: 'user_1', isBot: false },
          { id: 'user_2', isBot: false },
        ],
      }),
      true
    );

    // Excluded: Private Room match
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'multiplayer',
        isQuickMatch: false,
        isPrivateSeries: true,
        localPlayerId: 'user_1',
        players: [
          { id: 'user_1', isBot: false },
          { id: 'user_2', isBot: false },
        ],
      }),
      false
    );

    // Excluded: Solo vs Bot
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'vs_bot',
        isQuickMatch: false,
        isPrivateSeries: false,
        localPlayerId: 'p1',
        players: [
          { id: 'p1', isBot: false },
          { id: 'bot_1', isBot: true },
        ],
      }),
      false
    );

    // Excluded: Matchmaking fallback vs Bot even if marked isQuickMatch
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'multiplayer',
        isQuickMatch: true,
        isPrivateSeries: false,
        localPlayerId: 'user_1',
        players: [
          { id: 'user_1', isBot: false },
          { id: 'bot_rival', isBot: true },
        ],
      }),
      false
    );

    // Excluded: Local Pass & Play
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'pass_and_play',
        isQuickMatch: false,
        isPrivateSeries: false,
        localPlayerId: 'p1',
        players: [
          { id: 'p1', isBot: false },
          { id: 'p2', isBot: false },
        ],
      }),
      false
    );
  });
});
