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
   * Triggers Supabase OAuth with Google.
   */
  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      const redirectUrl =
        typeof window !== 'undefined' && window.location
          ? window.location.origin
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await this.completeOnboarding();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google Sign-in failed' };
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
