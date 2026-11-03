// src/services/playerProfileService.ts - Persistent Guest Player Profile system
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  winStreak: number;
}

export interface PlayerProfile {
  id: string; // UUID generated on first run
  nickname: string; // defaults to "Player", user-editable
  avatarId: string; // e.g. "avatar_1", "avatar_2", "avatar_3", "avatar_4"
  stats: PlayerStats;
  isGuest: boolean; // set to true
}

export interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
  bgColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'avatar_1', emoji: '🦊', label: 'Fox', bgColor: '#FED7AA' },
  { id: 'avatar_2', emoji: '🤖', label: 'Bot', bgColor: '#BAE6FD' },
  { id: 'avatar_3', emoji: '🐯', label: 'Tiger', bgColor: '#FEF08A' },
  { id: 'avatar_4', emoji: '🐼', label: 'Panda', bgColor: '#E2E8F0' },
  { id: 'avatar_5', emoji: '⚡', label: 'Rival', bgColor: '#DDD6FE' },
  { id: 'avatar_6', emoji: '👑', label: 'Champ', bgColor: '#FDE68A' },
];

export function getAvatarConfig(avatarId?: string): AvatarOption {
  if (!avatarId) return AVATAR_OPTIONS[0];
  return AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];
}

const STORAGE_KEY = '@rival_card_guest_player_profile_v1';

// In-memory fallback for test environments or SSR where window/native storage is inaccessible
const memoryStorage: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  // 1. Try AsyncStorage
  try {
    const val = await AsyncStorage.getItem(key);
    if (val !== null && val !== undefined) {
      return val;
    }
  } catch {
    // ignore
  }

  // 2. Fallback to window.localStorage on web preview / browser
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null && val !== undefined) {
        return val;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to in-memory dictionary
  return memoryStorage[key] ?? null;
}

async function storageSet(key: string, value: string): Promise<void> {
  memoryStorage[key] = value;

  // Mirror to AsyncStorage
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }

  // Mirror to window.localStorage on web preview / browser
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

class PlayerProfileService {
  private cachedProfile: PlayerProfile | null = null;
  private listeners: Set<(profile: PlayerProfile) => void> = new Set();

  /**
   * Subscribe to profile updates. Returns an unsubscribe function.
   */
  public subscribe(listener: (profile: PlayerProfile) => void): () => void {
    this.listeners.add(listener);
    if (this.cachedProfile) {
      listener(this.cachedProfile);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.cachedProfile) {
      for (const listener of this.listeners) {
        try {
          listener(this.cachedProfile);
        } catch (err) {
          console.warn('Error in player profile subscriber listener:', err);
        }
      }
    }
  }

  /**
   * Reads the profile from persistent storage. If none exists, creates and saves default.
   */
  public async getProfile(forceRefresh = false): Promise<PlayerProfile> {
    if (this.cachedProfile && !forceRefresh) {
      return this.cachedProfile;
    }

    const raw = await storageGet(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedProfile = {
            id: typeof parsed.id === 'string' && parsed.id ? parsed.id : generateUUID(),
            nickname: typeof parsed.nickname === 'string' && parsed.nickname.trim() ? parsed.nickname.trim().slice(0, 15) : 'Player',
            avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : 'avatar_1',
            stats: {
              gamesPlayed: typeof parsed.stats?.gamesPlayed === 'number' ? parsed.stats.gamesPlayed : 0,
              wins: typeof parsed.stats?.wins === 'number' ? parsed.stats.wins : 0,
              winStreak: typeof parsed.stats?.winStreak === 'number' ? parsed.stats.winStreak : 0,
            },
            isGuest: true,
          };
          this.notify();
          return this.cachedProfile;
        }
      } catch (err) {
        console.warn('Failed to parse stored player profile:', err);
      }
    }

    // Initialize brand new default profile
    const defaultProfile: PlayerProfile = {
      id: generateUUID(),
      nickname: 'Player',
      avatarId: 'avatar_1',
      stats: {
        gamesPlayed: 0,
        wins: 0,
        winStreak: 0,
      },
      isGuest: true,
    };

    this.cachedProfile = defaultProfile;
    await storageSet(STORAGE_KEY, JSON.stringify(defaultProfile));
    this.notify();
    return defaultProfile;
  }

  /**
   * Updates and persists the player nickname (max 15 characters).
   */
  public async updateNickname(name: string): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const cleanName = name.trim().slice(0, 15) || 'Player';
    const updated: PlayerProfile = {
      ...current,
      nickname: cleanName,
    };
    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Updates and persists the selected avatar ID.
   */
  public async updateAvatar(avatarId: string): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const isValid = AVATAR_OPTIONS.some((a) => a.id === avatarId);
    const updated: PlayerProfile = {
      ...current,
      avatarId: isValid ? avatarId : 'avatar_1',
    };
    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Records the match result, updating gamesPlayed, wins, and winStreak.
   */
  public async recordMatchResult(isWinner: boolean): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const updated: PlayerProfile = {
      ...current,
      stats: {
        gamesPlayed: current.stats.gamesPlayed + 1,
        wins: isWinner ? current.stats.wins + 1 : current.stats.wins,
        winStreak: isWinner ? current.stats.winStreak + 1 : 0,
      },
    };
    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Synchronous getter for current cached profile or null.
   */
  public getCachedProfile(): PlayerProfile | null {
    return this.cachedProfile;
  }

  /**
   * Reset profile (clears storage & cache for testing).
   */
  public async resetProfile(): Promise<PlayerProfile> {
    delete memoryStorage[STORAGE_KEY];
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.cachedProfile = null;
    return this.getProfile(true);
  }
}

export const playerProfileService = new PlayerProfileService();
