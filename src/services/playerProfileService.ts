// src/services/playerProfileService.ts - Persistent Guest Player Profile, Progression, and Economy System
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  winStreak: number;
}

export interface PlayerProfile {
  id: string; // UUID generated on first run
  nickname: string; // defaults to "Player", user-editable
  avatarId: string; // e.g. "avatar_1", "avatar_2", "avatar_3", "avatar_4"
  level: number; // starts at 1
  currentXp: number; // starts at 0
  xpToNextLevel: number; // formula: level * 100
  coins: number; // starts at 250 for new guests
  gems: number; // starts at 10 for new guests
  stats: PlayerStats;
  isGuest: boolean; // set to true
  email?: string; // optional linked email for authenticated accounts
}

export interface AwardRewardsResult {
  leveledUp: boolean;
  newLevel: number;
  bonusCoins: number;
  bonusGems: number;
  earnedXp: number;
  earnedCoins: number;
  currentXp: number;
  xpToNextLevel: number;
}

export type AuthUserLike = {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
};

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

export const STORAGE_KEY = '@rivalcard:player_profile';
export const LEGACY_STORAGE_KEY = '@rival_card_guest_player_profile_v1';

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

async function storageRemove(key: string): Promise<void> {
  delete memoryStorage[key];
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
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

let shopServiceRef: any = null;
function getShopService(): any {
  if (!shopServiceRef) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      shopServiceRef = require('./shopService').shopService;
    } catch {
      // ignore
    }
  }
  return shopServiceRef;
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

    let raw = await storageGet(STORAGE_KEY);
    if (!raw) {
      raw = await storageGet(LEGACY_STORAGE_KEY);
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const level = typeof parsed.level === 'number' && parsed.level >= 1 ? parsed.level : 1;
          const currentXp = typeof parsed.currentXp === 'number' && parsed.currentXp >= 0 ? parsed.currentXp : 0;
          const xpToNextLevel =
            typeof parsed.xpToNextLevel === 'number' && parsed.xpToNextLevel > 0
              ? parsed.xpToNextLevel
              : level * 100;
          const coins = typeof parsed.coins === 'number' && parsed.coins >= 0 ? parsed.coins : 250;
          const gems = typeof parsed.gems === 'number' && parsed.gems >= 0 ? parsed.gems : 10;
          const isGuest = typeof parsed.isGuest === 'boolean' ? parsed.isGuest : true;
          const email = typeof parsed.email === 'string' && parsed.email ? parsed.email : undefined;

          this.cachedProfile = {
            id: typeof parsed.id === 'string' && parsed.id ? parsed.id : generateUUID(),
            nickname:
              typeof parsed.nickname === 'string' && parsed.nickname.trim()
                ? parsed.nickname.trim().slice(0, 15)
                : 'Player',
            avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : 'avatar_1',
            level,
            currentXp,
            xpToNextLevel,
            coins,
            gems,
            stats: {
              gamesPlayed: typeof parsed.stats?.gamesPlayed === 'number' ? parsed.stats.gamesPlayed : 0,
              wins: typeof parsed.stats?.wins === 'number' ? parsed.stats.wins : 0,
              winStreak: typeof parsed.stats?.winStreak === 'number' ? parsed.stats.winStreak : 0,
            },
            isGuest,
            email,
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
      level: 1,
      currentXp: 0,
      xpToNextLevel: 100,
      coins: 250,
      gems: 10,
      stats: {
        gamesPlayed: 0,
        wins: 0,
        winStreak: 0,
      },
      isGuest: true,
    };

    this.cachedProfile = defaultProfile;
    await storageSet(STORAGE_KEY, JSON.stringify(defaultProfile));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(defaultProfile));
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
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
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
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
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
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Awards match rewards (XP and Coins) with Level-Up threshold detection.
   * - Online Ranked / Standard: 100% rewards (+120 XP / +60 coins on win, +50 XP / +20 coins on loss).
   * - Bot Match (CPU): strictly 10% rewards (Math.floor(reward * 0.10)).
   * - Pass & Play & Custom Private Rooms: 0 XP and 0 Coins (disabled).
   * When currentXp >= xpToNextLevel: level increments, carry over remainder,
   * next threshold becomes level * 100, bonus +100 Coins & +5 Gems awarded.
   */
  public async awardMatchRewards(
    isWinner: boolean,
    turnsPlayed: number = 0,
    matchType: 'online_ranked' | 'bot' | 'custom_private' | 'pass_and_play' = 'online_ranked'
  ): Promise<AwardRewardsResult> {
    const current = await this.getProfile();

    const baseXp = isWinner ? 120 : 50;
    const baseCoins = isWinner ? 60 : 20;

    let earnedXp = 0;
    let earnedCoins = 0;

    if (matchType === 'online_ranked') {
      earnedXp = baseXp;
      earnedCoins = baseCoins;
    } else if (matchType === 'bot') {
      earnedXp = Math.floor(baseXp * 0.10);
      earnedCoins = Math.floor(baseCoins * 0.10);
    } else {
      // 'pass_and_play' or 'custom_private': completely disabled
      earnedXp = 0;
      earnedCoins = 0;
    }

    let currentXp = current.currentXp + earnedXp;
    let level = current.level;
    let xpToNextLevel = current.xpToNextLevel || (level * 100);

    let leveledUp = false;
    let bonusCoins = 0;
    let bonusGems = 0;

    while (currentXp >= xpToNextLevel) {
      leveledUp = true;
      currentXp -= xpToNextLevel;
      level += 1;
      xpToNextLevel = level * 100;
      bonusCoins += 100;
      bonusGems += 5;
    }

    const totalCoins = current.coins + earnedCoins + bonusCoins;
    const totalGems = current.gems + bonusGems;

    const updated: PlayerProfile = {
      ...current,
      level,
      currentXp,
      xpToNextLevel,
      coins: totalCoins,
      gems: totalGems,
    };

    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();

    return {
      leveledUp,
      newLevel: level,
      bonusCoins,
      bonusGems,
      earnedXp,
      earnedCoins,
      currentXp,
      xpToNextLevel,
    };
  }

  /**
   * Adds coins and/or gems to the player profile.
   */
  public async addCurrency(coins: number, gems: number): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const updated: PlayerProfile = {
      ...current,
      coins: current.coins + Math.max(0, coins),
      gems: current.gems + Math.max(0, gems),
    };
    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Deducts coins and/or gems from the player profile if sufficient funds exist.
   * Returns true if successful, or false if insufficient balance.
   */
  public async deductCurrency(coins: number, gems: number): Promise<boolean> {
    const current = await this.getProfile();
    const cleanCoins = Math.max(0, coins);
    const cleanGems = Math.max(0, gems);
    if (current.coins < cleanCoins || current.gems < cleanGems) {
      return false;
    }
    const updated: PlayerProfile = {
      ...current,
      coins: current.coins - cleanCoins,
      gems: current.gems - cleanGems,
    };
    this.cachedProfile = updated;
    await storageSet(STORAGE_KEY, JSON.stringify(updated));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return true;
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
    await storageRemove(STORAGE_KEY);
    await storageRemove(LEGACY_STORAGE_KEY);
    this.cachedProfile = null;
    return this.getProfile(true);
  }

  /**
   * Preserves guest player progression and intelligently merges with Supabase cloud account.
   * - Case A (First-time sign-up): Upserts existing guest stats, coins, and progress so nothing resets to 0.
   * - Case B (Returning account): Compares local guest stats with remote cloud stats, taking higher/delta values.
   * Writes merged profile back to local AsyncStorage and notifies all subscribers/stores.
   */
  public async migrateAndLinkGuestAccount(
    authUser: AuthUserLike,
    remoteProfileOverride?: any
  ): Promise<PlayerProfile> {
    if (!authUser || !authUser.id) {
      return this.getProfile();
    }

    // 1. Read the current local guest data from AsyncStorage
    const currentGuest = await this.getProfile();

    const authEmail = authUser.email?.trim().toLowerCase() || currentGuest.email;
    const authDisplayName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.user_metadata?.user_name ||
      (authEmail ? authEmail.split('@')[0] : undefined);

    // 2. Check Supabase `profiles` table for authUser.id with safety timeout
    let remoteProfile: any = null;
    if (remoteProfileOverride !== undefined) {
      remoteProfile = remoteProfileOverride;
    } else {
      try {
        const { data, error } = await Promise.race([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
        ]);
        if (!error && data) {
          remoteProfile = data;
        }
      } catch (fetchErr) {
        // In offline mode or when profiles table does not exist, proceed cleanly with local guest preservation
        console.warn('[PlayerProfileService] Could not fetch remote cloud profile (offline/timeout):', fetchErr);
      }
    }

    let merged: PlayerProfile;

    if (!remoteProfile) {
      // Case A: First-time Google Sign-Up / no remote profile yet
      // Preserve all guest stats, level, coins, xp, and items so nothing resets to 0!
      const nickname =
        currentGuest.nickname && currentGuest.nickname !== 'Player'
          ? currentGuest.nickname
          : (authDisplayName ? authDisplayName.slice(0, 15) : (currentGuest.nickname || 'Player'));

      merged = {
        ...currentGuest,
        id: authUser.id,
        email: authEmail,
        nickname,
        avatarId: currentGuest.avatarId || 'avatar_1',
        level: currentGuest.level || 1,
        currentXp: currentGuest.currentXp || 0,
        xpToNextLevel: currentGuest.xpToNextLevel || 100,
        coins: currentGuest.coins ?? 250,
        gems: currentGuest.gems ?? 10,
        stats: {
          gamesPlayed: currentGuest.stats?.gamesPlayed || 0,
          wins: currentGuest.stats?.wins || 0,
          winStreak: currentGuest.stats?.winStreak || 0,
        },
        isGuest: false,
      };

      // Upsert into Supabase profiles table
      try {
        await Promise.race([
          supabase.from('profiles').upsert({
            id: authUser.id,
            email: authEmail || '',
            nickname: merged.nickname,
            avatar_id: merged.avatarId,
            level: merged.level,
            current_xp: merged.currentXp,
            xp_to_next_level: merged.xpToNextLevel,
            coins: merged.coins,
            gems: merged.gems,
            games_played: merged.stats.gamesPlayed,
            wins: merged.stats.wins,
            win_streak: merged.stats.winStreak,
            is_guest: false,
            updated_at: new Date().toISOString(),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('upsert timeout')), 2500)),
        ]);
      } catch (upsertErr) {
        console.warn('[PlayerProfileService] Cloud upsert warning (Case A):', upsertErr);
      }
    } else {
      // Case B: Existing Google Account returning
      // Compare local guest stats with remote cloud stats and intelligently merge
      const remoteCoins = typeof remoteProfile.coins === 'number' ? remoteProfile.coins : 250;
      const remoteGems = typeof remoteProfile.gems === 'number' ? remoteProfile.gems : 10;
      const remoteLevel = typeof remoteProfile.level === 'number' ? remoteProfile.level : 1;
      const remoteCurrentXp =
        typeof (remoteProfile.current_xp ?? remoteProfile.currentXp) === 'number'
          ? (remoteProfile.current_xp ?? remoteProfile.currentXp)
          : 0;
      const remoteXpToNextLevel =
        typeof (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel) === 'number'
          ? (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel)
          : remoteLevel * 100;
      const remoteGamesPlayed =
        typeof (remoteProfile.games_played ?? remoteProfile.stats?.gamesPlayed) === 'number'
          ? (remoteProfile.games_played ?? remoteProfile.stats?.gamesPlayed)
          : 0;
      const remoteWins =
        typeof (remoteProfile.wins ?? remoteProfile.stats?.wins) === 'number'
          ? (remoteProfile.wins ?? remoteProfile.stats?.wins)
          : 0;
      const remoteWinStreak =
        typeof (remoteProfile.win_streak ?? remoteProfile.stats?.winStreak) === 'number'
          ? (remoteProfile.win_streak ?? remoteProfile.stats?.winStreak)
          : 0;
      const remoteNickname = remoteProfile.nickname?.trim();
      const remoteAvatarId = remoteProfile.avatar_id || remoteProfile.avatarId;

      // Coins merge: guest baseline is 250. Delta earned while offline: Math.max(0, currentGuest.coins - 250).
      const guestDeltaCoins = Math.max(0, (currentGuest.coins ?? 250) - 250);
      const mergedCoins = Math.max(remoteCoins + guestDeltaCoins, currentGuest.coins ?? 250, remoteCoins);

      // Gems merge: guest baseline is 10. Delta: Math.max(0, currentGuest.gems - 10).
      const guestDeltaGems = Math.max(0, (currentGuest.gems ?? 10) - 10);
      const mergedGems = Math.max(remoteGems + guestDeltaGems, currentGuest.gems ?? 10, remoteGems);

      // Level and XP merge: take higher level and progress
      let mergedLevel = remoteLevel;
      let mergedCurrentXp = remoteCurrentXp;
      let mergedXpToNextLevel = remoteXpToNextLevel;

      if ((currentGuest.level || 1) > remoteLevel) {
        mergedLevel = currentGuest.level;
        mergedCurrentXp = currentGuest.currentXp || 0;
        mergedXpToNextLevel = currentGuest.xpToNextLevel || mergedLevel * 100;
      } else if (remoteLevel === (currentGuest.level || 1)) {
        mergedLevel = remoteLevel;
        mergedCurrentXp = Math.max(remoteCurrentXp, currentGuest.currentXp || 0);
        mergedXpToNextLevel = remoteXpToNextLevel;
      }

      // Stats merge: take highest wins/streak and sum games played
      const mergedGamesPlayed = Math.max(
        remoteGamesPlayed + (currentGuest.stats?.gamesPlayed || 0),
        remoteGamesPlayed,
        currentGuest.stats?.gamesPlayed || 0
      );
      const mergedWins = Math.max(
        remoteWins + (currentGuest.stats?.wins || 0),
        remoteWins,
        currentGuest.stats?.wins || 0
      );
      const mergedWinStreak = Math.max(remoteWinStreak, currentGuest.stats?.winStreak || 0);

      // Nickname merge
      let mergedNickname = remoteNickname || authDisplayName;
      if (!mergedNickname || mergedNickname === 'Player') {
        if (currentGuest.nickname && currentGuest.nickname !== 'Player') {
          mergedNickname = currentGuest.nickname;
        } else {
          mergedNickname = authDisplayName || 'Player';
        }
      }

      // Avatar merge
      const mergedAvatarId = remoteAvatarId || currentGuest.avatarId || 'avatar_1';

      merged = {
        id: authUser.id,
        email: authEmail || remoteProfile.email,
        nickname: mergedNickname.slice(0, 15),
        avatarId: mergedAvatarId,
        level: mergedLevel,
        currentXp: mergedCurrentXp,
        xpToNextLevel: mergedXpToNextLevel,
        coins: mergedCoins,
        gems: mergedGems,
        stats: {
          gamesPlayed: mergedGamesPlayed,
          wins: mergedWins,
          winStreak: mergedWinStreak,
        },
        isGuest: false,
      };

      // Sync merged result back to Supabase profiles
      try {
        await Promise.race([
          supabase.from('profiles').upsert({
            id: authUser.id,
            email: merged.email || '',
            nickname: merged.nickname,
            avatar_id: merged.avatarId,
            level: merged.level,
            current_xp: merged.currentXp,
            xp_to_next_level: merged.xpToNextLevel,
            coins: merged.coins,
            gems: merged.gems,
            games_played: merged.stats.gamesPlayed,
            wins: merged.stats.wins,
            win_streak: merged.stats.winStreak,
            is_guest: false,
            updated_at: new Date().toISOString(),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('upsert timeout')), 2500)),
        ]);
      } catch (upsertErr) {
        console.warn('[PlayerProfileService] Cloud upsert warning (Case B):', upsertErr);
      }
    }

    // Merge unlocked items/cosmetics if available from remote
    if (remoteProfile && (remoteProfile.unlocked_items || remoteProfile.owned_item_ids)) {
      const remoteItems = remoteProfile.unlocked_items || remoteProfile.owned_item_ids;
      if (Array.isArray(remoteItems) && remoteItems.length > 0) {
        try {
          const shop = getShopService();
          if (shop && typeof shop.mergeInventory === 'function') {
            await shop.mergeInventory(remoteItems);
          }
        } catch (itemErr) {
          console.warn('[PlayerProfileService] Inventory merge warning:', itemErr);
        }
      }
    }

    // 3. Write merged profile back to local AsyncStorage and notify all active player state stores / contexts
    this.cachedProfile = merged;
    await storageSet(STORAGE_KEY, JSON.stringify(merged));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(merged));
    this.notify();

    return merged;
  }

  /**
   * Links an authenticated Supabase user to the player profile (delegates to migrateAndLinkGuestAccount).
   */
  public async linkAuthAccount(details: {
    email?: string;
    userId?: string;
    displayName?: string;
  }): Promise<PlayerProfile> {
    return this.migrateAndLinkGuestAccount(
      {
        id: details.userId || this.cachedProfile?.id || generateUUID(),
        email: details.email,
        user_metadata: details.displayName ? { full_name: details.displayName } : undefined,
      },
      details.userId ? undefined : null
    );
  }

  /**
   * Initializes or retrieves default guest profile.
   */
  public async initGuestProfile(): Promise<PlayerProfile> {
    return this.getProfile();
  }

  /**
   * Signs out from Supabase Auth and reverts local session to a clean guest state.
   */
  public async signOut(): Promise<PlayerProfile> {
    try {
      await supabase.auth.signOut().catch(() => {});
    } catch {
      // ignore
    }

    const cleanGuest: PlayerProfile = {
      id: generateUUID(),
      nickname: 'Player',
      avatarId: 'avatar_1',
      level: 1,
      currentXp: 0,
      xpToNextLevel: 100,
      coins: 250,
      gems: 10,
      stats: { gamesPlayed: 0, wins: 0, winStreak: 0 },
      isGuest: true,
    };
    this.cachedProfile = cleanGuest;
    await storageSet(STORAGE_KEY, JSON.stringify(cleanGuest));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(cleanGuest));
    await storageRemove('@rivalcard:active_online_match');
    this.notify();
    return cleanGuest;
  }

  /**
   * Deletes user account, invokes auth wipe, and clears all local storage keys:
   * @rivalcard:player_profile, @rivalcard:inventory, @rivalcard:settings, @rivalcard:active_online_match.
   * Resets the app state cleanly to a brand new guest user.
   */
  public async deleteAccount(): Promise<PlayerProfile> {
    try {
      await supabase.auth.signOut().catch(() => {});
    } catch {
      // ignore
    }

    // Wipe all player keys
    await storageRemove(STORAGE_KEY);
    await storageRemove(LEGACY_STORAGE_KEY);
    await storageRemove('@rivalcard:inventory');
    await storageRemove('@rivalcard:settings');
    await storageRemove('@rivalcard:active_online_match');
    await storageRemove('@rivalcard:onboarding_completed');

    const freshGuest: PlayerProfile = {
      id: generateUUID(),
      nickname: 'Player',
      avatarId: 'avatar_1',
      level: 1,
      currentXp: 0,
      xpToNextLevel: 100,
      coins: 250,
      gems: 10,
      stats: { gamesPlayed: 0, wins: 0, winStreak: 0 },
      isGuest: true,
    };
    this.cachedProfile = freshGuest;
    await storageSet(STORAGE_KEY, JSON.stringify(freshGuest));
    await storageSet(LEGACY_STORAGE_KEY, JSON.stringify(freshGuest));
    this.notify();
    return freshGuest;
  }
}

export const playerProfileService = new PlayerProfileService();
