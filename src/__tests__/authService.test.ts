// src/__tests__/authService.test.ts - Dual Auth (Google + Email OTP) & Deep Linking Test Suite
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService, parseAuthParams, sendEmailOtp, verifyEmailOtp } from '../services/authService';
import { playerProfileService } from '../services/playerProfileService';
import { supabase } from '../services/supabase';

describe('Auth Service & Deep Link Parsing', () => {
  beforeEach(async () => {
    await authService.resetOnboarding();
    await playerProfileService.resetProfile();
  });

  describe('parseAuthParams Helper', () => {
    it('correctly parses hash fragments with access_token and refresh_token', () => {
      const fragment = '#access_token=test_access_123&refresh_token=test_refresh_456&token_type=bearer';
      const parsed = parseAuthParams(fragment);

      assert.strictEqual(parsed.access_token, 'test_access_123');
      assert.strictEqual(parsed.refresh_token, 'test_refresh_456');
      assert.strictEqual(parsed.token_type, 'bearer');
    });

    it('correctly parses query strings with auth code and URI components', () => {
      const query = '?code=supabase_code_789&email=player%40rivalcard.com';
      const parsed = parseAuthParams(query);

      assert.strictEqual(parsed.code, 'supabase_code_789');
      assert.strictEqual(parsed.email, 'player@rivalcard.com');
    });

    it('gracefully handles empty or malformed strings', () => {
      assert.deepStrictEqual(parseAuthParams(''), {});
      assert.deepStrictEqual(parseAuthParams('#'), {});
      assert.deepStrictEqual(parseAuthParams('?'), {});
      assert.deepStrictEqual(parseAuthParams('&&&'), {});
    });
  });

  describe('Onboarding Lifecycle', () => {
    it('initially reports onboarding incomplete after reset', async () => {
      const completed = await authService.isOnboardingCompleted();
      assert.strictEqual(completed, false);
    });

    it('flags onboarding as complete and persists state', async () => {
      await authService.completeOnboarding();
      const completed = await authService.isOnboardingCompleted();
      assert.strictEqual(completed, true);
    });

    it('initGuestProfile creates a guest profile and marks onboarding completed', async () => {
      const profile = await authService.initGuestProfile();
      assert.strictEqual(profile.isGuest, true);
      assert.strictEqual(profile.nickname, 'Player');
      const completed = await authService.isOnboardingCompleted();
      assert.strictEqual(completed, true);
    });
  });

  describe('Email OTP Authentication Engine', () => {
    it('sendEmailOtp rejects invalid email inputs (class & standalone)', async () => {
      await assert.rejects(async () => {
        await authService.sendEmailOtp('');
      });

      await assert.rejects(async () => {
        await authService.sendEmailOtp('notanemail');
      });

      await assert.rejects(async () => {
        await sendEmailOtp('');
      });

      await assert.rejects(async () => {
        await sendEmailOtp('notanemail');
      });
    });

    it('verifyEmailOtp rejects invalid email and token (class & standalone)', async () => {
      await assert.rejects(async () => {
        await authService.verifyEmailOtp('', '123456');
      });

      await assert.rejects(async () => {
        await authService.verifyEmailOtp('test@example.com', '123');
      });

      await assert.rejects(async () => {
        await verifyEmailOtp('', '123456');
      });

      await assert.rejects(async () => {
        await verifyEmailOtp('test@example.com', '123');
      });
    });
  });

  describe('Guaranteed Guest Progress Preservation & Cloud Merge', () => {
    it('Case A (First-time Google Sign-Up): preserves all guest progress, coins, and level without reset to 0', async () => {
      // 1. Simulate active gameplay as a guest
      await playerProfileService.addCurrency(450, 15); // Coins: 250 + 450 = 700; Gems: 10 + 15 = 25
      await playerProfileService.updateNickname('AceRival');
      await playerProfileService.updateAvatar('avatar_3');
      await playerProfileService.recordMatchResult(true); // Wins: 1, GamesPlayed: 1, Streak: 1
      await playerProfileService.recordMatchResult(true); // Wins: 2, GamesPlayed: 2, Streak: 2

      const guestBefore = await playerProfileService.getProfile();
      assert.strictEqual(guestBefore.coins, 700);
      assert.strictEqual(guestBefore.gems, 25);
      assert.strictEqual(guestBefore.stats.wins, 2);
      assert.strictEqual(guestBefore.isGuest, true);

      // 2. Link account as first-time Google sign-up (remoteProfileOverride = null)
      const linked = await playerProfileService.migrateAndLinkGuestAccount(
        {
          id: 'new_google_user_123',
          email: 'ace@rivalcard.com',
          user_metadata: { full_name: 'Ace Google' },
        },
        null
      );

      // 3. Verify ALL guest progress was preserved and isGuest is false
      assert.strictEqual(linked.isGuest, false);
      assert.strictEqual(linked.id, 'new_google_user_123');
      assert.strictEqual(linked.email, 'ace@rivalcard.com');
      assert.strictEqual(linked.nickname, 'AceRival'); // Preserves custom nickname!
      assert.strictEqual(linked.avatarId, 'avatar_3'); // Preserves avatar!
      assert.strictEqual(linked.coins, 700); // 700 coins preserved! Not reset to 250 or 0!
      assert.strictEqual(linked.gems, 25); // 25 gems preserved! Not reset to 10 or 0!
      assert.strictEqual(linked.stats.wins, 2); // 2 wins preserved!
      assert.strictEqual(linked.stats.gamesPlayed, 2);
      assert.strictEqual(linked.stats.winStreak, 2);
    });

    it('Case B (Returning Google Account): merges delta coins and retains higher cloud level/stats', async () => {
      // 1. Local guest earned 100 coins offline during current session (250 + 100 = 350)
      await playerProfileService.addCurrency(100, 2); // Coins: 350, Gems: 12
      await playerProfileService.recordMatchResult(true); // 1 win as guest

      // 2. Remote cloud account has existing high stats from past plays
      const mockRemoteCloudProfile = {
        id: 'returning_user_456',
        email: 'veteran@rivalcard.com',
        nickname: 'VeteranPro',
        avatar_id: 'avatar_5',
        level: 8,
        current_xp: 450,
        xp_to_next_level: 800,
        coins: 10000,
        gems: 150,
        games_played: 120,
        wins: 85,
        win_streak: 6,
      };

      const merged = await playerProfileService.migrateAndLinkGuestAccount(
        {
          id: 'returning_user_456',
          email: 'veteran@rivalcard.com',
        },
        mockRemoteCloudProfile
      );

      // 3. Verify intelligent merge
      assert.strictEqual(merged.isGuest, false);
      assert.strictEqual(merged.id, 'returning_user_456');
      assert.strictEqual(merged.email, 'veteran@rivalcard.com');
      assert.strictEqual(merged.nickname, 'VeteranPro');
      assert.strictEqual(merged.avatarId, 'avatar_5');
      assert.strictEqual(merged.level, 8); // Higher level preserved
      assert.strictEqual(merged.coins, 10100); // 10,000 cloud + 100 delta earned as guest!
      assert.strictEqual(merged.gems, 152); // 150 cloud + 2 delta earned as guest!
      assert.strictEqual(merged.stats.wins, 86); // 85 cloud wins + 1 guest win!
      assert.strictEqual(merged.stats.winStreak, 6);
    });

    it('Preserves guest XP (e.g. XP 3 or XP 25) upon signing in and never resets XP to 0', async () => {
      // 1. Guest plays offline matches and accumulates 25 XP
      await playerProfileService.awardMatchRewards(false, 10, 'online_ranked'); // Defeat awards +25 XP
      const guestBefore = await playerProfileService.getProfile();
      assert.strictEqual(guestBefore.currentXp, 25, 'Guest must have earned 25 XP');
      assert.strictEqual(guestBefore.level, 1);

      // 2. Link account with first-time Google user (remote has no progress)
      const linked = await playerProfileService.migrateAndLinkGuestAccount(
        {
          id: 'user_preserve_xp_1',
          email: 'xpuser@rivalcard.com',
        },
        null
      );

      // 3. Verify XP was preserved and not wiped to 0
      assert.strictEqual(linked.isGuest, false);
      assert.strictEqual(linked.currentXp, 25, 'Guest XP must be preserved at 25');
      assert.strictEqual(linked.level, 1);

      // 4. Case where remote account has existing row with 0 XP vs guest 25 XP: takes Math.max(0, 25) = 25
      const mockZeroXpRemote = {
        id: 'user_zero_remote_xp',
        email: 'remotezero@rivalcard.com',
        level: 1,
        current_xp: 0,
        coins: 250,
      };
      const linkedWithZeroRemote = await playerProfileService.migrateAndLinkGuestAccount(
        {
          id: 'user_zero_remote_xp',
          email: 'remotezero@rivalcard.com',
        },
        mockZeroXpRemote
      );
      assert.strictEqual(linkedWithZeroRemote.currentXp, 25, 'Must preserve 25 XP using Math.max(0, 25)');
    });

    it('signOut cleanly reverts authenticated profile back to guest state', async () => {
      await playerProfileService.linkAuthAccount({
        email: 'charlie@rivalcard.com',
        displayName: 'CharlieRival',
      });

      const guestAgain = await authService.signOut();
      assert.strictEqual(guestAgain.isGuest, true);
      assert.strictEqual(guestAgain.email, undefined);
      assert.strictEqual(guestAgain.nickname, 'Player');
    });
  });

  describe('Deep Linking OAuth & Callback Handlers', () => {
    it('handleAuthDeepLink detects error parameters in URL', async () => {
      const url = 'rivalcard://auth/callback?error=access_denied&error_description=User+cancelled+sign+in';
      const res = await authService.handleAuthDeepLink(url);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'User cancelled sign in');
    });

    it('handleAuthDeepLink reports error when no credentials present in URL', async () => {
      const url = 'rivalcard://auth/callback';
      const res = await authService.handleAuthDeepLink(url);
      assert.strictEqual(res.success, false);
      assert.ok(res.error?.includes('No authentication credentials'));
    });

    it('handleAuthDeepLink handles empty URL cleanly', async () => {
      const res = await authService.handleAuthDeepLink('');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'No URL provided');
    });

    it('handleAuthDeepLink reports error when code is supplied without access tokens (PKCE deprecated in favor of Email OTP)', async () => {
      const url = 'rivalcard://auth/callback?code=deprecated_code';
      const res = await authService.handleAuthDeepLink(url);
      assert.strictEqual(res.success, false);
      assert.ok(res.error?.includes('No authentication credentials found in URL'));
    });

    it('handleAuthDeepLink parses hash access_token and refresh_token', async () => {
      // Mock setSession
      const originalSetSession = supabase.auth.setSession;
      (supabase.auth as any).setSession = async ({ access_token, refresh_token }: any) => {
        if (access_token === 'mock_token_abc' && refresh_token === 'mock_refresh_xyz') {
          return {
            data: {
              session: {
                user: {
                  id: 'hash_user_111',
                  email: 'hash@rivalcard.com',
                  user_metadata: { full_name: 'Hash Player' },
                },
              },
            },
            error: null,
          };
        }
        return { data: { session: null }, error: new Error('Invalid session tokens') };
      };

      try {
        const url = 'rivalcard://auth/callback#access_token=mock_token_abc&refresh_token=mock_refresh_xyz&token_type=bearer';
        const res = await authService.handleAuthDeepLink(url);
        assert.strictEqual(res.success, true);
        assert.ok(res.session);

        const currentProfile = await playerProfileService.getProfile();
        assert.strictEqual(currentProfile.isGuest, false);
        assert.strictEqual(currentProfile.email, 'hash@rivalcard.com');
      } finally {
        (supabase.auth as any).setSession = originalSetSession;
      }
    });
  });
});
