// src/services/authService.ts - Authentication & Account Management Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { playerProfileService, PlayerProfile } from './playerProfileService';

export const ONBOARDING_COMPLETED_KEY = '@rivalcard:onboarding_completed';

const memoryStore: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
    const val = await AsyncStorage.getItem(key);
    if (val !== null) return val;
    return memoryStore[key] || null;
  } catch {
    return memoryStore[key] || null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

async function storageRemove(key: string): Promise<void> {
  delete memoryStore[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Universal query/hash parameter parser supporting both browser and native environments.
 */
export function parseAuthParams(queryString: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!queryString) return result;
  const clean = queryString.replace(/^[\?#]/, '');
  const pairs = clean.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const rawKey = pair.slice(0, eqIdx).replace(/\+/g, ' ').trim();
      const rawVal = pair.slice(eqIdx + 1).replace(/\+/g, ' ').trim();
      const key = decodeURIComponent(rawKey);
      const val = decodeURIComponent(rawVal);
      if (key) result[key] = val;
    } else {
      const key = decodeURIComponent(pair.replace(/\+/g, ' ').trim());
      if (key) result[key] = 'true';
    }
  }
  return result;
}

class AuthService {
  /**
   * Checks whether the user has completed the first-launch onboarding flow.
   */
  public async isOnboardingCompleted(): Promise<boolean> {
    const val = await storageGet(ONBOARDING_COMPLETED_KEY);
    return val === 'true';
  }

  /**
   * Flags onboarding as completed.
   */
  public async completeOnboarding(): Promise<void> {
    await storageSet(ONBOARDING_COMPLETED_KEY, 'true');
  }

  /**
   * Resets onboarding status (e.g. for testing or account deletion).
   */
  public async resetOnboarding(): Promise<void> {
    await storageRemove(ONBOARDING_COMPLETED_KEY);
  }

  /**
   * Initializes default guest profile and completes onboarding.
   */
  public async initGuestProfile(): Promise<PlayerProfile> {
    await this.completeOnboarding();
    return playerProfileService.initGuestProfile();
  }

  /**
   * Syncs active Supabase auth session (user data/email) to player profile,
   * preserving all guest progression and merging with cloud account.
   */
  public async syncAuthSessionToProfile(): Promise<PlayerProfile> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        await this.completeOnboarding();
        return await playerProfileService.migrateAndLinkGuestAccount(data.user);
      }
    } catch (err) {
      console.warn('[AuthService] syncAuthSessionToProfile error:', err);
    }
    return playerProfileService.getProfile();
  }

  /**
   * Triggers Supabase OAuth with Google.
   */
  public async signInWithGoogle(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const isWeb =
        typeof window !== 'undefined' &&
        typeof window.location !== 'undefined' &&
        typeof window.document !== 'undefined';
      const redirectUrl = isWeb
        ? window.location.origin
        : 'rivalcard://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await this.completeOnboarding();
      return { success: true, url: data?.url };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google Sign-in failed' };
    }
  }

  /**
   * Sends a 6-digit OTP verification code to the specified email address.
   */
  public async sendEmailOtp(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return { success: false, error: 'Please enter a valid email address.' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send verification code.' };
    }
  }

  /**
   * Verifies the 6-digit OTP code sent to user email and establishes an authenticated session.
   */
  public async verifyEmailOtp(
    email: string,
    token: string
  ): Promise<{ success: boolean; profile?: PlayerProfile; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();

      if (!cleanEmail) {
        return { success: false, error: 'Email address is required.' };
      }
      if (!cleanToken || cleanToken.length < 6) {
        return { success: false, error: 'Please enter a valid 6-digit verification code.' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await this.completeOnboarding();
      const profile = await this.syncAuthSessionToProfile();
      return { success: true, profile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed. Please check the code.' };
    }
  }

  /**
   * Handles incoming deep links (e.g. rivalcard://auth/callback?code=... or #access_token=...)
   */
  public async handleAuthDeepLink(url: string): Promise<{ success: boolean; session?: any; error?: string }> {
    try {
      if (!url) return { success: false, error: 'No URL provided' };

      // 1. Check for error description in query or hash fragment
      let errorDesc: string | null = null;
      try {
        const urlObj = new URL(url);
        errorDesc = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');
      } catch {
        const query = url.split('?')[1]?.split('#')[0] || '';
        errorDesc = parseAuthParams(query).error_description || parseAuthParams(query).error || null;
      }

      if (!errorDesc && url.includes('#')) {
        const hashPart = url.split('#')[1] || '';
        const params = new URLSearchParams(hashPart);
        errorDesc = params.get('error_description') || params.get('error');
      }

      if (errorDesc) {
        return { success: false, error: errorDesc.replace(/\+/g, ' ') };
      }

      // 2. PKCE Authorization Code Exchange (?code=...)
      if (url.includes('code=')) {
        let code: string | null = null;
        try {
          const urlObj = new URL(url);
          code = urlObj.searchParams.get('code');
        } catch {
          const query = url.split('?')[1]?.split('#')[0] || '';
          code = parseAuthParams(query).code || null;
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            return { success: false, error: error.message };
          }
          if (data?.session?.user) {
            await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
          }
          await this.completeOnboarding();
          return { success: true, session: data?.session };
        }
      }

      // 3. Hash Fragment Access Token (#access_token=...&refresh_token=...)
      if (url.includes('#access_token=') || (url.includes('#') && url.includes('access_token='))) {
        const hashPart = url.split('#')[1] || '';
        const params = new URLSearchParams(hashPart);
        const access_token = params.get('access_token') || parseAuthParams(hashPart).access_token;
        const refresh_token = params.get('refresh_token') || parseAuthParams(hashPart).refresh_token;

        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            return { success: false, error: error.message };
          }
          if (data?.session?.user) {
            await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
          }
          await this.completeOnboarding();
          return { success: true, session: data?.session };
        }
      }

      // 4. Query Parameter Fallback (?access_token=...&refresh_token=...)
      if (url.includes('access_token=') && url.includes('refresh_token=')) {
        let access_token: string | null = null;
        let refresh_token: string | null = null;
        try {
          const urlObj = new URL(url);
          access_token = urlObj.searchParams.get('access_token');
          refresh_token = urlObj.searchParams.get('refresh_token');
        } catch {
          const query = url.split('?')[1]?.split('#')[0] || '';
          access_token = parseAuthParams(query).access_token || null;
          refresh_token = parseAuthParams(query).refresh_token || null;
        }

        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            return { success: false, error: error.message };
          }
          if (data?.session?.user) {
            await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
          }
          await this.completeOnboarding();
          return { success: true, session: data?.session };
        }
      }

      return { success: false, error: 'No authentication credentials found in URL' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to process authentication link' };
    }
  }

  /**
   * Signs out from Supabase Auth and resets local session to a clean guest state.
   */
  public async signOut(): Promise<PlayerProfile> {
    return playerProfileService.signOut();
  }

  /**
   * Deletes user account, invokes auth wipe, and wipes all local storage keys.
   */
  public async deleteAccount(): Promise<PlayerProfile> {
    await this.resetOnboarding();
    return playerProfileService.deleteAccount();
  }
}

export const authService = new AuthService();
