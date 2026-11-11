// src/services/authService.ts - Authentication & Account Management Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleSignin as GoogleSigninType } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { playerProfileService, PlayerProfile } from './playerProfileService';

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

let GoogleSigninModule: typeof GoogleSigninType | null = null;
let nativeStatusCodes: any = statusCodes;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const googleModule = require('@react-native-google-signin/google-signin');
  if (googleModule?.GoogleSignin) {
    GoogleSigninModule = googleModule.GoogleSignin;
  }
  if (googleModule?.statusCodes) {
    nativeStatusCodes = googleModule.statusCodes;
  }
} catch {
  // Headless test runner or web fallback
  GoogleSigninModule = null;
}

export const GoogleSignin: typeof GoogleSigninType = GoogleSigninModule || ({
  configure: (_config: any) => {},
  hasPlayServices: async (_options?: any) => true,
  signIn: async () => ({ data: { idToken: 'mock_google_id_token' } } as any),
  signOut: async () => {},
  addScopes: async () => true,
  getTokens: async () => ({ idToken: 'mock_google_id_token', accessToken: 'mock_google_access_token' }),
  getCurrentUser: async () => null,
  clearCachedAccessToken: async () => {},
  revokeAccess: async () => {},
} as any);

let expoExtra: Record<string, any> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants')?.default ?? require('expo-constants');
  expoExtra = Constants?.expoConfig?.extra || {};
} catch {
  // fallback if expo-constants is not loaded in test runner
}

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  expoExtra.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '533714585618-inbuf0dbn3ijr0gshb11bob1bkhsv2hf.apps.googleusercontent.com';

if (GoogleSignin && typeof GoogleSignin.configure === 'function') {
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
    });
  } catch (err) {
    console.warn('[GoogleSignin] configure warning:', err);
  }
}

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

/**
 * Sends a 6-digit OTP verification code to the specified email address.
 */
export const sendEmailOtp = async (email: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      // Explicitly NO emailRedirectTo
    },
  });
  if (error) throw error;
  return data;
};

/**
 * Verifies the 6-digit OTP code sent to user email and establishes an authenticated session,
 * seamlessly migrating and linking guest progression to cloud account.
 */
export const verifyEmailOtp = async (email: string, token: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
  if (data?.session?.user) {
    await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
  }
  return data;
};

/**
 * Initiates native Google Sign-In with Play Services sheet, extracts ID token,
 * exchanges with Supabase signInWithIdToken, and links guest progression to cloud account.
 */
export const signInWithGoogleNative = async (): Promise<{
  data?: any;
  error?: any;
  cancelled?: boolean;
}> => {
  try {
    if (GoogleSignin && typeof GoogleSignin.hasPlayServices === 'function') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response: any = await GoogleSignin.signIn();

    // Extract ID token: handle both response.data?.idToken (v13+) and response.idToken (legacy)
    const idToken = response?.data?.idToken || response?.idToken;

    if (!idToken) {
      throw new Error('No Google ID token received from authentication sheet.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;

    if (data?.session?.user) {
      await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
    }

    await authService.completeOnboarding();
    return { data, cancelled: false };
  } catch (err: any) {
    // Gracefully catch user cancellation without throwing alert errors
    const isCancelled =
      err?.code === nativeStatusCodes.SIGN_IN_CANCELLED ||
      err?.code === statusCodes.SIGN_IN_CANCELLED ||
      err?.code === 'SIGN_IN_CANCELLED' ||
      err?.code === 12501 || // Android Google Play Services user cancel error code
      err?.message?.includes?.('SIGN_IN_CANCELLED') ||
      err?.message?.includes?.('canceled') ||
      err?.message?.includes?.('cancelled');

    if (isCancelled) {
      return { cancelled: true };
    }

    throw err;
  }
};

/**
 * Signs out from both native Google Sign-In and Supabase Auth, returning to clean guest state.
 */
export const signOutNativeGoogle = async (): Promise<PlayerProfile> => {
  try {
    if (GoogleSignin && typeof GoogleSignin.signOut === 'function') {
      await GoogleSignin.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }

  try {
    await supabase.auth.signOut().catch(() => {});
  } catch {
    // ignore
  }

  return playerProfileService.signOut();
};

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
   * Sends a 6-digit OTP verification code to the specified email address.
   */
  public async sendEmailOtp(email: string) {
    return sendEmailOtp(email);
  }

  /**
   * Verifies the 6-digit OTP code sent to user email and establishes an authenticated session.
   */
  public async verifyEmailOtp(email: string, token: string) {
    return verifyEmailOtp(email, token);
  }

  /**
   * Initiates native Google Sign-In with Play Services sheet and Supabase signInWithIdToken.
   */
  public async signInWithGoogleNative() {
    return signInWithGoogleNative();
  }

  /**
   * Signs out from both native Google Sign-In and Supabase Auth.
   */
  public async signOutNativeGoogle(): Promise<PlayerProfile> {
    return signOutNativeGoogle();
  }

  /**
   * Handles incoming session deep links (e.g. #access_token=...&refresh_token=...)
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

      // 2. Hash Fragment Access Token (#access_token=...&refresh_token=...)
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

      // 3. Query Parameter Fallback (?access_token=...&refresh_token=...)
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

      // 4. PKCE / OAuth Code Exchange (?code=... or #code=...)
      if (url.includes('code=')) {
        let code: string | null = null;
        try {
          const urlObj = new URL(url);
          code = urlObj.searchParams.get('code');
        } catch {
          const query = url.split('?')[1]?.split('#')[0] || '';
          code = parseAuthParams(query).code || null;
        }

        if (!code && url.includes('#')) {
          const hashPart = url.split('#')[1] || '';
          const params = new URLSearchParams(hashPart);
          code = params.get('code') || parseAuthParams(hashPart).code || null;
        }

        if (code) {
          try {
            if (typeof supabase.auth.exchangeCodeForSession === 'function') {
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
          } catch (codeErr: any) {
            return { success: false, error: codeErr?.message || 'Code exchange failed' };
          }
        }
      }

      // 5. Token Hash Verification (?token_hash=... or #token_hash=...)
      if (url.includes('token_hash=')) {
        let token_hash: string | null = null;
        let otpType: string | null = null;
        try {
          const urlObj = new URL(url);
          token_hash = urlObj.searchParams.get('token_hash');
          otpType = urlObj.searchParams.get('type');
        } catch {
          const query = url.split('?')[1]?.split('#')[0] || '';
          token_hash = parseAuthParams(query).token_hash || null;
          otpType = parseAuthParams(query).type || null;
        }

        if (!token_hash && url.includes('#')) {
          const hashPart = url.split('#')[1] || '';
          const params = new URLSearchParams(hashPart);
          token_hash = params.get('token_hash') || parseAuthParams(hashPart).token_hash || null;
          otpType = otpType || params.get('type') || parseAuthParams(hashPart).type || null;
        }

        if (token_hash) {
          try {
            if (typeof supabase.auth.verifyOtp === 'function') {
              const { data, error } = await supabase.auth.verifyOtp({
                token_hash,
                type: (otpType as any) || 'email',
              });
              if (error) {
                return { success: false, error: error.message };
              }
              if (data?.session?.user) {
                await playerProfileService.migrateAndLinkGuestAccount(data.session.user);
              }
              await this.completeOnboarding();
              return { success: true, session: data?.session };
            }
          } catch (tokenErr: any) {
            return { success: false, error: tokenErr?.message || 'Token verification failed' };
          }
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
