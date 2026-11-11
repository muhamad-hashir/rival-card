// src/__tests__/authService.test.ts - In-App Email OTP & Guest Progress Preservation Test Suite
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  authService,
  parseAuthParams,
  sendEmailOtp,
  verifyEmailOtp,
  signInWithGoogleNative,
  signOutNativeGoogle,
  GoogleSignin,
  statusCodes,
} from '../services/authService';
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
    it('Case A (First-time Sign-Up): preserves all guest progress, coins, and level without reset to 0', async () => {
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

    it('Case B (Returning Account): merges delta coins and retains higher cloud level/stats', async () => {
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

    it('CASE 1: Returning player on new device restores remote cloud profile and overwrites local AsyncStorage without touching cloud with fresh guest data', async () => {
      // 1. Fresh local install with initial default guest stats (level 1, 0 XP, 250 coins, 0 wins)
      const freshGuest = await playerProfileService.getProfile();
      assert.strictEqual(freshGuest.level, 1);
      assert.strictEqual(freshGuest.currentXp, 0);
      assert.strictEqual(freshGuest.coins, 250);
      assert.strictEqual(freshGuest.stats.wins, 0);
      assert.strictEqual(freshGuest.isGuest, true);

      // 2. Returning player logs in; remote profile has accumulated high progression
      const mockRemoteCloudProfile = {
        id: 'veteran_device2_789',
        email: 'device2@rivalcard.com',
        nickname: 'CloudMaster',
        avatar_id: 'avatar_6',
        level: 12,
        current_xp: 850,
        xp_to_next_level: 1200,
        coins: 15000,
        gems: 200,
        games_played: 180,
        wins: 130,
        win_streak: 9,
      };

      const restored = await playerProfileService.migrateAndLinkGuestAccount(
        {
          id: 'veteran_device2_789',
          email: 'device2@rivalcard.com',
        },
        mockRemoteCloudProfile
      );

      // 3. Cloud profile is authoritatively restored, local guest stats do NOT overwrite cloud
      assert.strictEqual(restored.isGuest, false);
      assert.strictEqual(restored.id, 'veteran_device2_789');
      assert.strictEqual(restored.email, 'device2@rivalcard.com');
      assert.strictEqual(restored.nickname, 'CloudMaster');
      assert.strictEqual(restored.avatarId, 'avatar_6');
      assert.strictEqual(restored.level, 12);
      assert.strictEqual(restored.currentXp, 850);
      assert.strictEqual(restored.coins, 15000);
      assert.strictEqual(restored.gems, 200);
      assert.strictEqual(restored.stats.wins, 130);
      assert.strictEqual(restored.stats.gamesPlayed, 180);

      // 4. Local AsyncStorage is overwritten with restored cloud profile
      const localStored = await playerProfileService.getProfile(true);
      assert.strictEqual(localStored.level, 12);
      assert.strictEqual(localStored.coins, 15000);
      assert.strictEqual(localStored.isGuest, false);
      assert.strictEqual(localStored.nickname, 'CloudMaster');
    });

    it('Preserves guest XP (e.g. XP 3 or XP 25) upon signing in and never resets XP to 0', async () => {
      // 1. Guest plays offline matches and accumulates 25 XP
      await playerProfileService.awardMatchRewards(false, 10, 'online_ranked'); // Defeat awards +25 XP
      const guestBefore = await playerProfileService.getProfile();
      assert.strictEqual(guestBefore.currentXp, 25, 'Guest must have earned 25 XP');
      assert.strictEqual(guestBefore.level, 1);

      // 2. Link account with first-time user (remote has no progress)
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

    it('handleAuthDeepLink reports error when invalid code is supplied', async () => {
      const url = 'rivalcard://auth/callback?code=invalid_dummy_code';
      const res = await authService.handleAuthDeepLink(url);
      assert.strictEqual(res.success, false);
      assert.ok(res.error);
    });

    it('handleAuthDeepLink parses and exchanges PKCE code for session', async () => {
      const originalExchange = supabase.auth.exchangeCodeForSession;
      (supabase.auth as any).exchangeCodeForSession = async (code: string) => {
        if (code === 'valid_pkce_code_123') {
          return {
            data: {
              session: {
                user: {
                  id: 'pkce_user_555',
                  email: 'pkce@rivalcard.com',
                  user_metadata: { full_name: 'PKCE Player' },
                },
              },
            },
            error: null,
          };
        }
        return { data: { session: null }, error: new Error('Invalid code') };
      };

      try {
        await playerProfileService.addCurrency(300, 15);
        const url = 'rivalcard://auth/callback?code=valid_pkce_code_123';
        const res = await authService.handleAuthDeepLink(url);
        assert.strictEqual(res.success, true);
        assert.ok(res.session);

        const currentProfile = await playerProfileService.getProfile();
        assert.strictEqual(currentProfile.isGuest, false);
        assert.strictEqual(currentProfile.email, 'pkce@rivalcard.com');
        assert.strictEqual(currentProfile.coins, 550); // 250 default + 300
        assert.strictEqual(currentProfile.gems, 25); // 10 default + 15
      } finally {
        (supabase.auth as any).exchangeCodeForSession = originalExchange;
      }
    });

    it('Cold-start deep-link flow does not reset or overwrite @rival_card_profile stats with empty default', async () => {
      // 1. Player earned stats prior to deep link click
      await playerProfileService.addCurrency(500, 20); // 750 coins, 30 gems
      await playerProfileService.recordMatchResult(true); // 1 win
      const profileBefore = await playerProfileService.getProfile();
      assert.strictEqual(profileBefore.coins, 750);
      assert.strictEqual(profileBefore.stats.wins, 1);

      // 2. Cold-start deep link external intent fires and auth resolves
      const mockColdStartUser = {
        id: 'cold_start_user_888',
        email: 'coldstart@rivalcard.com',
      };
      const linked = await playerProfileService.migrateAndLinkGuestAccount(mockColdStartUser);
      assert.strictEqual(linked.isGuest, false);
      assert.strictEqual(linked.coins, 750);
      assert.strictEqual(linked.stats.wins, 1);

      // 3. Force-refresh getProfile maintains the preserved progress
      const refetched = await playerProfileService.getProfile(true);
      assert.strictEqual(refetched.coins, 750);
      assert.strictEqual(refetched.stats.wins, 1);
      assert.strictEqual(refetched.isGuest, false);
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

    it('handleAuthDeepLink parses and verifies token_hash parameter for magic link', async () => {
      const originalVerifyOtp = supabase.auth.verifyOtp;
      (supabase.auth as any).verifyOtp = async (params: any) => {
        if (params.token_hash === 'magic_token_abc' && params.type === 'email') {
          return {
            data: {
              session: {
                user: {
                  id: 'magic_user_222',
                  email: 'magic@rivalcard.com',
                },
              },
            },
            error: null,
          };
        }
        return { data: { session: null }, error: new Error('Invalid magic token') };
      };

      try {
        const url = 'rivalcard://auth/callback?token_hash=magic_token_abc&type=email';
        const res = await authService.handleAuthDeepLink(url);
        assert.strictEqual(res.success, true);
        assert.ok(res.session);

        const currentProfile = await playerProfileService.getProfile();
        assert.strictEqual(currentProfile.isGuest, false);
        assert.strictEqual(currentProfile.email, 'magic@rivalcard.com');
      } finally {
        (supabase.auth as any).verifyOtp = originalVerifyOtp;
      }
    });
  });

  describe('Native Google Sign-In & Supabase Token Exchange', () => {
    it('signInWithGoogleNative exchanges Google ID token (v13+ response.data.idToken) with Supabase and links guest account', async () => {
      // 1. Give guest some XP and coins to confirm they are preserved
      await playerProfileService.awardMatchRewards(false, 1, 'online_ranked'); // +25 XP, +10 Coins
      await playerProfileService.addCurrency(290, 10); // Coins: 250 + 10 + 290 = 550; Gems: 10 + 10 = 20
      const guestBefore = await playerProfileService.getProfile();
      assert.strictEqual(guestBefore.currentXp, 25);
      assert.strictEqual(guestBefore.coins, 550);

      const originalSignIn = GoogleSignin.signIn;
      const originalSignInWithIdToken = (supabase.auth as any).signInWithIdToken;

      (GoogleSignin as any).signIn = async () => ({
        type: 'success',
        data: {
          idToken: 'mock_google_id_token_v13',
          user: { email: 'v13player@gmail.com', name: 'V13 Player' },
        },
      });

      let exchangedToken = '';
      (supabase.auth as any).signInWithIdToken = async (params: { provider: string; token: string }) => {
        exchangedToken = params.token;
        return {
          data: {
            session: {
              user: {
                id: 'google_user_v13_id',
                email: 'v13player@gmail.com',
                user_metadata: { full_name: 'V13 Player' },
              },
            },
          },
          error: null,
        };
      };

      try {
        const result = await signInWithGoogleNative();
        assert.strictEqual(result.cancelled, false);
        assert.strictEqual(exchangedToken, 'mock_google_id_token_v13');
        assert.ok(result.data?.session?.user);

        // Verify account migration preserved guest XP and coins
        const profile = await playerProfileService.getProfile();
        assert.strictEqual(profile.isGuest, false);
        assert.strictEqual(profile.id, 'google_user_v13_id');
        assert.strictEqual(profile.email, 'v13player@gmail.com');
        assert.strictEqual(profile.currentXp, 25);
        assert.strictEqual(profile.coins, 550);

        const onboardingDone = await authService.isOnboardingCompleted();
        assert.strictEqual(onboardingDone, true);
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
        (supabase.auth as any).signInWithIdToken = originalSignInWithIdToken;
      }
    });

    it('signInWithGoogleNative exchanges Google ID token (legacy response.idToken) with Supabase', async () => {
      const originalSignIn = GoogleSignin.signIn;
      const originalSignInWithIdToken = (supabase.auth as any).signInWithIdToken;

      (GoogleSignin as any).signIn = async () => ({
        idToken: 'mock_google_id_token_legacy',
      });

      let exchangedToken = '';
      (supabase.auth as any).signInWithIdToken = async (params: { provider: string; token: string }) => {
        exchangedToken = params.token;
        return {
          data: {
            session: {
              user: {
                id: 'google_user_legacy_id',
                email: 'legacy@gmail.com',
              },
            },
          },
          error: null,
        };
      };

      try {
        const result = await signInWithGoogleNative();
        assert.strictEqual(result.cancelled, false);
        assert.strictEqual(exchangedToken, 'mock_google_id_token_legacy');

        const profile = await playerProfileService.getProfile();
        assert.strictEqual(profile.isGuest, false);
        assert.strictEqual(profile.email, 'legacy@gmail.com');
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
        (supabase.auth as any).signInWithIdToken = originalSignInWithIdToken;
      }
    });

    it('signInWithGoogleNative gracefully catches user cancellation (SIGN_IN_CANCELLED) and returns cancelled: true', async () => {
      const originalSignIn = GoogleSignin.signIn;
      (GoogleSignin as any).signIn = async () => {
        const err: any = new Error('Sign in was cancelled');
        err.code = statusCodes.SIGN_IN_CANCELLED;
        throw err;
      };

      try {
        const result = await signInWithGoogleNative();
        assert.strictEqual(result.cancelled, true);
        assert.strictEqual(result.data, undefined);
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
      }
    });

    it('signInWithGoogleNative gracefully catches Android 12501 user cancellation code', async () => {
      const originalSignIn = GoogleSignin.signIn;
      (GoogleSignin as any).signIn = async () => {
        const err: any = new Error('12501');
        err.code = 12501;
        throw err;
      };

      try {
        const result = await signInWithGoogleNative();
        assert.strictEqual(result.cancelled, true);
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
      }
    });

    it('signInWithGoogleNative throws error when Google does not return an ID token', async () => {
      const originalSignIn = GoogleSignin.signIn;
      (GoogleSignin as any).signIn = async () => ({
        data: {},
      });

      try {
        await assert.rejects(async () => {
          await signInWithGoogleNative();
        }, /No Google ID token received/);
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
      }
    });

    it('signOutNativeGoogle signs out of Google and Supabase and reverts profile to guest', async () => {
      let googleSignedOut = false;
      let supabaseSignedOut = false;

      const originalGoogleSignOut = GoogleSignin.signOut;
      const originalSupabaseSignOut = supabase.auth.signOut;

      (GoogleSignin as any).signOut = async () => {
        googleSignedOut = true;
      };
      (supabase.auth as any).signOut = async () => {
        supabaseSignedOut = true;
        return { error: null };
      };

      try {
        // First simulate a signed-in profile
        await playerProfileService.migrateAndLinkGuestAccount({
          id: 'signout_test_user',
          email: 'signout@gmail.com',
        });
        const authedProfile = await playerProfileService.getProfile();
        assert.strictEqual(authedProfile.isGuest, false);

        const guestProfile = await signOutNativeGoogle();
        assert.strictEqual(googleSignedOut, true);
        assert.strictEqual(supabaseSignedOut, true);
        assert.strictEqual(guestProfile.isGuest, true);
        assert.strictEqual(guestProfile.email, undefined);

        const storedProfile = await playerProfileService.getProfile();
        assert.strictEqual(storedProfile.isGuest, true);
      } finally {
        (GoogleSignin as any).signOut = originalGoogleSignOut;
        (supabase.auth as any).signOut = originalSupabaseSignOut;
      }
    });

    it('authService class methods signInWithGoogleNative and signOutNativeGoogle work seamlessly', async () => {
      const originalSignIn = GoogleSignin.signIn;
      const originalSignInWithIdToken = (supabase.auth as any).signInWithIdToken;

      (GoogleSignin as any).signIn = async () => ({
        data: { idToken: 'token_via_class' },
      });
      (supabase.auth as any).signInWithIdToken = async () => ({
        data: {
          session: {
            user: { id: 'class_user', email: 'class@gmail.com' },
          },
        },
        error: null,
      });

      try {
        const res = await authService.signInWithGoogleNative();
        assert.strictEqual(res.cancelled, false);

        const profile = await playerProfileService.getProfile();
        assert.strictEqual(profile.email, 'class@gmail.com');

        const out = await authService.signOutNativeGoogle();
        assert.strictEqual(out.isGuest, true);
      } finally {
        (GoogleSignin as any).signIn = originalSignIn;
        (supabase.auth as any).signInWithIdToken = originalSignInWithIdToken;
      }
    });
  });
});
