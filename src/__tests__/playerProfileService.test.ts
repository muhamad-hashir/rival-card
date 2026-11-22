// src/__tests__/playerProfileService.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEligibleCareerStatMatch,
  playerProfileService,
  resolveMatchRewardType,
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
    assert.strictEqual(profile.avatarId, 'fox');
    assert.deepStrictEqual(profile.unlockedAvatars, ['fox', 'bot']);
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

  it('updates avatar only with unlocked valid avatar IDs and falls back on invalid', async () => {
    const updated = await playerProfileService.updateAvatar('avatar_2');
    assert.strictEqual(updated.avatarId, 'bot');

    const config = getAvatarConfig(updated.avatarId);
    assert.strictEqual(config.id, 'bot');
    assert.strictEqual(config.emoji, '🤖');

    // Locked avatar cannot be equipped directly without unlocking
    const lockedAttempt = await playerProfileService.updateAvatar('avatar_4');
    assert.strictEqual(lockedAttempt.avatarId, 'bot');

    // Invalid avatar id fallback
    const invalid = await playerProfileService.updateAvatar('invalid_avatar_999');
    assert.strictEqual(invalid.avatarId, 'fox');
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
    assert.strictEqual(AVATAR_OPTIONS.length, 12);
    for (const opt of AVATAR_OPTIONS) {
      assert.ok(opt.id.length > 0);
      assert.ok(opt.emoji.length > 0);
      assert.ok(opt.label.length > 0);
      assert.ok(opt.bgColor.startsWith('#'));
      assert.ok(opt.requiredLevel >= 1);
      assert.ok(opt.coinCost >= 0);
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

    // Included: Quick Match vs any of the 20 human-named undercover bots increments Career Stats & Win Streak
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'vs_bot',
        isQuickMatch: true,
        isPrivateSeries: false,
        localPlayerId: 'user_1',
        players: [
          { id: 'user_1', isBot: false },
          { id: 'qm_bot_hamza', name: 'Hamza_OP', isBot: true, countsTowardCareerStats: true },
        ],
      }),
      true
    );

    // Excluded: Quick Match every-3rd/4th rotation vs 3 named signature bots (NovaBot, CyberBot, EchoBot)
    // leaves Career Stats untouched while still earning online_ranked XP & Coins
    for (const sigBot of [
      { id: 'bot_nova', name: 'NovaBot', isBot: true, countsTowardCareerStats: false },
      { id: 'bot_cyber', name: 'CyberBot', isBot: true, countsTowardCareerStats: false },
      { id: 'bot_echo', name: 'EchoBot', isBot: true, countsTowardCareerStats: false },
    ]) {
      assert.strictEqual(
        isEligibleCareerStatMatch({
          gameMode: 'vs_bot',
          isQuickMatch: true,
          isPrivateSeries: false,
          localPlayerId: 'user_1',
          players: [{ id: 'user_1', isBot: false }, sigBot],
        }),
        false
      );
    }

    // Identical online_ranked reward tier across human, undercover bot, and signature bot Quick Matches
    assert.strictEqual(resolveMatchRewardType({ gameMode: 'multiplayer', isQuickMatch: true }), 'online_ranked');
    assert.strictEqual(resolveMatchRewardType({ gameMode: 'vs_bot', isQuickMatch: true }), 'online_ranked');
    assert.strictEqual(resolveMatchRewardType({ gameMode: 'vs_bot', isQuickMatch: false }), 'bot');
    assert.strictEqual(resolveMatchRewardType({ gameMode: 'multiplayer', isQuickMatch: false }), 'custom_private');
    assert.strictEqual(resolveMatchRewardType({ gameMode: 'pass_and_play', isQuickMatch: false }), 'pass_and_play');

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

  it('Quick Match rewards vs undercover bot update stats+streak, while signature bot awards Coins/XP only', async () => {
    // 1. Win vs undercover Quick Match bot -> increments gamesPlayed, wins, winStreak AND awards 100 XP + 50 Coins
    const undercoverEligible = isEligibleCareerStatMatch({
      gameMode: 'vs_bot',
      isQuickMatch: true,
      isPrivateSeries: false,
      localPlayerId: 'local_p1',
      players: [
        { id: 'local_p1', isBot: false },
        { id: 'qm_bot_aarav', name: 'Aarav_OP', isBot: true, countsTowardCareerStats: true },
      ],
    });
    assert.strictEqual(undercoverEligible, true);
    await playerProfileService.recordMatchResult(true, { matchId: 'qm_undercover_1' });
    await playerProfileService.awardMatchRewards(
      true,
      8,
      resolveMatchRewardType({ gameMode: 'vs_bot', isQuickMatch: true })
    );

    let profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.stats.gamesPlayed, 1);
    assert.strictEqual(profile.stats.wins, 1);
    assert.strictEqual(profile.stats.winStreak, 1);
    assert.strictEqual(profile.coins, 400); // 250 + 50 match + 100 level-up bonus

    // 2. Win vs named signature bot (NovaBot) in Quick Match -> awards online_ranked Coins/XP, stats & winStreak unchanged
    const novaEligible = isEligibleCareerStatMatch({
      gameMode: 'vs_bot',
      isQuickMatch: true,
      isPrivateSeries: false,
      localPlayerId: 'local_p1',
      players: [
        { id: 'local_p1', isBot: false },
        { id: 'bot_nova', name: 'NovaBot', isBot: true, countsTowardCareerStats: false },
      ],
    });
    assert.strictEqual(novaEligible, false);
    if (novaEligible) {
      await playerProfileService.recordMatchResult(true, { matchId: 'qm_nova_2' });
    }
    const novaRewards = await playerProfileService.awardMatchRewards(
      true,
      10,
      resolveMatchRewardType({ gameMode: 'vs_bot', isQuickMatch: true })
    );
    assert.strictEqual(novaRewards.earnedXp, 100);
    assert.strictEqual(novaRewards.earnedCoins, 50);

    profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.stats.gamesPlayed, 1, 'NovaBot must not increment gamesPlayed');
    assert.strictEqual(profile.stats.wins, 1, 'NovaBot must not increment wins');
    assert.strictEqual(profile.stats.winStreak, 1, 'NovaBot must not alter winStreak');
    assert.strictEqual(profile.coins, 450, 'NovaBot Quick Match win still awards +50 Coins');

    // 3. Loss vs signature bot (EchoBot) -> awards online_ranked loss Coins/XP (+25 XP, +10 Coins), preserves winStreak=1
    const echoEligible = isEligibleCareerStatMatch({
      gameMode: 'vs_bot',
      isQuickMatch: true,
      isPrivateSeries: false,
      localPlayerId: 'local_p1',
      players: [
        { id: 'local_p1', isBot: false },
        { id: 'bot_echo', name: 'EchoBot', isBot: true, countsTowardCareerStats: false },
      ],
    });
    assert.strictEqual(echoEligible, false);
    await playerProfileService.awardMatchRewards(
      false,
      12,
      resolveMatchRewardType({ gameMode: 'vs_bot', isQuickMatch: true })
    );

    profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.stats.gamesPlayed, 1);
    assert.strictEqual(profile.stats.wins, 1);
    assert.strictEqual(profile.stats.winStreak, 1, 'Signature bot loss must not reset winStreak');
    assert.strictEqual(profile.coins, 460, 'Signature bot Quick Match loss awards +10 Coins');
  });
});
