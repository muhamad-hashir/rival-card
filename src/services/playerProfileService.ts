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
export const ALT_STORAGE_KEY = '@rival_card_profile';
export const DAILY_BOT_STORAGE_KEY = '@rivalcard:daily_bot_earnings';
export const DAILY_BOT_COIN_CAP = 100;

export interface DailyBotEarnings {
  date: string; // YYYY-MM-DD
  coinsEarned: number;
}

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

async function persistProfile(profile: PlayerProfile): Promise<void> {
  const json = JSON.stringify(profile);
  await storageSet(STORAGE_KEY, json);
  await storageSet(LEGACY_STORAGE_KEY, json);
  await storageSet(ALT_STORAGE_KEY, json);
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
      raw = await storageGet(ALT_STORAGE_KEY);
    }
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
                ? parsed.nickname.trim().slice(0, 16)
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
    await persistProfile(defaultProfile);
    this.notify();
    return defaultProfile;
  }

  /**
   * Updates and persists the player nickname (max 16 characters).
   */
  public async updateNickname(name: string): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const cleanName = name.trim().slice(0, 16) || 'Player';
    const updated: PlayerProfile = {
      ...current,
      nickname: cleanName,
    };
    this.cachedProfile = updated;
    await persistProfile(updated);
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
    await persistProfile(updated);
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
    await persistProfile(updated);
    this.notify();
    return updated;
  }

  /**
   * Awards match rewards (XP and Coins) with Level-Up threshold detection.
   * - Online Ranked / Standard:
   *   * Win: 100 XP + 50 Coins
   *   * Loss: 25 XP + 10 Coins
   * - Bot Match (CPU):
   *   * Win: 20 XP + 10 Coins
   *   * Loss: 5 XP + 2 Coins
   *   * Daily bot earnings soft cap: max 100 coins/day against bots via storage (@rivalcard:daily_bot_earnings)
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

    let earnedXp = 0;
    let earnedCoins = 0;

    if (matchType === 'online_ranked') {
      earnedXp = isWinner ? 100 : 25;
      earnedCoins = isWinner ? 50 : 10;
    } else if (matchType === 'bot') {
      earnedXp = isWinner ? 20 : 5;
      const rawCoins = isWinner ? 10 : 2;

      // Soft cap: max 100 coins/day from bot matches
      const today = new Date().toISOString().slice(0, 10);
      const dailyRecord = await this.getDailyBotEarnings();
      const currentDayCoins = (dailyRecord.date === today) ? (dailyRecord.coinsEarned || 0) : 0;

      const remainingAllowance = Math.max(0, DAILY_BOT_COIN_CAP - currentDayCoins);
      earnedCoins = Math.min(rawCoins, remainingAllowance);

      // Persist updated daily bot coin earnings
      await storageSet(
        DAILY_BOT_STORAGE_KEY,
        JSON.stringify({
          date: today,
          coinsEarned: currentDayCoins + earnedCoins,
        })
      );
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
    await persistProfile(updated);
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
   * Retrieves the current daily bot earnings record.
   */
  public async getDailyBotEarnings(): Promise<DailyBotEarnings> {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = await storageGet(DAILY_BOT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.coinsEarned === 'number' && parsed.date === today) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { date: today, coinsEarned: 0 };
  }

  /**
   * Resets the daily bot earnings record (useful for testing or day rollover).
   */
  public async resetDailyBotEarnings(): Promise<void> {
    await storageRemove(DAILY_BOT_STORAGE_KEY);
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
    await persistProfile(updated);
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
    await persistProfile(updated);
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
    await storageRemove(ALT_STORAGE_KEY);
    await storageRemove(DAILY_BOT_STORAGE_KEY);
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

    // 1. Grab existing local guest stats FIRST before doing any database write
    const localGuestData =
      (await storageGet(ALT_STORAGE_KEY)) ||
      (await storageGet(STORAGE_KEY)) ||
      (await storageGet(LEGACY_STORAGE_KEY));

    let guestStats: PlayerProfile | null = null;
    if (localGuestData) {
      try {
        guestStats = JSON.parse(localGuestData);
      } catch {
        guestStats = null;
      }
    }
    const currentGuest: PlayerProfile = guestStats || (await this.getProfile());

    const guestCoins = currentGuest.coins ?? 250;
    const guestGems = currentGuest.gems ?? 10;
    const guestLevel = currentGuest.level ?? 1;
    const guestXP = currentGuest.currentXp ?? 0;
    const guestXpToNextLevel = currentGuest.xpToNextLevel || (guestLevel * 100);
    const guestGamesPlayed = currentGuest.stats?.gamesPlayed || 0;
    const guestWins = currentGuest.stats?.wins || 0;
    const guestWinStreak = currentGuest.stats?.winStreak || 0;
    const guestNickname = currentGuest.nickname;
    const guestAvatarId = currentGuest.avatarId;

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
        console.warn('[PlayerProfileService] Could not fetch remote cloud profile (offline/timeout):', fetchErr);
      }
    }

    const remoteCoins = typeof remoteProfile?.coins === 'number' ? remoteProfile.coins : null;
    const remoteGems = typeof remoteProfile?.gems === 'number' ? remoteProfile.gems : null;
    const remoteLevel = typeof remoteProfile?.level === 'number' ? remoteProfile.level : null;
    const remoteCurrentXp =
      typeof (remoteProfile?.current_xp ?? remoteProfile?.currentXp ?? remoteProfile?.xp) === 'number'
        ? (remoteProfile.current_xp ?? remoteProfile.currentXp ?? remoteProfile.xp)
        : null;
    const remoteGamesPlayed =
      typeof (remoteProfile?.games_played ?? remoteProfile?.stats?.gamesPlayed) === 'number'
        ? (remoteProfile.games_played ?? remoteProfile.stats?.gamesPlayed)
        : 0;
    const remoteWins =
      typeof (remoteProfile?.wins ?? remoteProfile?.stats?.wins) === 'number'
        ? (remoteProfile.wins ?? remoteProfile.stats?.wins)
        : 0;
    const remoteWinStreak =
      typeof (remoteProfile?.win_streak ?? remoteProfile?.stats?.winStreak) === 'number'
        ? (remoteProfile.win_streak ?? remoteProfile.stats?.winStreak)
        : 0;
    const remoteNickname = remoteProfile?.nickname?.trim();
    const remoteAvatarId = remoteProfile?.avatar_id || remoteProfile?.avatarId;

    const hasRemoteProgress =
      Boolean(remoteProfile) &&
      (remoteGamesPlayed > 0 ||
        (remoteLevel !== null && remoteLevel > 1) ||
        (remoteCurrentXp !== null && remoteCurrentXp > 0) ||
        (remoteCoins !== null && remoteCoins > 250));

    let merged: PlayerProfile;

    if (!hasRemoteProgress) {
      // Case A: First-time Google Sign-Up / no existing remote progress yet
      // Migrate ALL guestStats (XP, coins, inventory, stats) directly to cloud record. Never reset to 0 / Level 1!
      const nickname =
        guestNickname && guestNickname !== 'Player'
          ? guestNickname
          : (authDisplayName ? authDisplayName.slice(0, 16) : (guestNickname || 'Player'));

      merged = {
        ...currentGuest,
        id: authUser.id,
        email: authEmail,
        nickname,
        avatarId: guestAvatarId || 'avatar_1',
        level: guestLevel,
        currentXp: guestXP,
        xpToNextLevel: guestXpToNextLevel,
        coins: guestCoins,
        gems: guestGems,
        stats: {
          gamesPlayed: guestGamesPlayed,
          wins: guestWins,
          winStreak: guestWinStreak,
        },
        isGuest: false,
      };

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
      // Take the maximum (Math.max(remoteXP, guestXP), Math.max(remoteCoins, guestCoins)) so player never loses earned progress
      const safeRemoteLevel = remoteLevel ?? 1;
      const safeRemoteXp = remoteCurrentXp ?? 0;
      const safeRemoteCoins = remoteCoins ?? 250;
      const safeRemoteGems = remoteGems ?? 10;

      const guestDeltaCoins = Math.max(0, guestCoins - 250);
      const mergedCoins = Math.max(safeRemoteCoins, guestCoins, safeRemoteCoins + guestDeltaCoins);

      const guestDeltaGems = Math.max(0, guestGems - 10);
      const mergedGems = Math.max(safeRemoteGems, guestGems, safeRemoteGems + guestDeltaGems);

      let mergedLevel = Math.max(safeRemoteLevel, guestLevel);
      let mergedCurrentXp: number;
      let mergedXpToNextLevel: number;

      if (guestLevel > safeRemoteLevel) {
        mergedLevel = guestLevel;
        mergedCurrentXp = guestXP;
        mergedXpToNextLevel = guestXpToNextLevel;
      } else if (safeRemoteLevel > guestLevel) {
        mergedLevel = safeRemoteLevel;
        mergedCurrentXp = Math.max(safeRemoteXp, guestXP);
        mergedXpToNextLevel =
          typeof (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel) === 'number'
            ? (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel)
            : mergedLevel * 100;
      } else {
        mergedLevel = safeRemoteLevel;
        mergedCurrentXp = Math.max(safeRemoteXp, guestXP);
        mergedXpToNextLevel =
          typeof (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel) === 'number'
            ? (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel)
            : mergedLevel * 100;
      }

      const mergedGamesPlayed = Math.max(
        remoteGamesPlayed + guestGamesPlayed,
        remoteGamesPlayed,
        guestGamesPlayed
      );
      const mergedWins = Math.max(
        remoteWins + guestWins,
        remoteWins,
        guestWins
      );
      const mergedWinStreak = Math.max(remoteWinStreak, guestWinStreak);

      let mergedNickname = remoteNickname || authDisplayName;
      if (!mergedNickname || mergedNickname === 'Player') {
        mergedNickname = (guestNickname && guestNickname !== 'Player') ? guestNickname : (authDisplayName || 'Player');
      }

      const mergedAvatarId = remoteAvatarId || guestAvatarId || 'avatar_1';

      merged = {
        id: authUser.id,
        email: authEmail || remoteProfile.email,
        nickname: mergedNickname.slice(0, 16),
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
    await persistProfile(merged);
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
    await persistProfile(cleanGuest);
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
    await storageRemove(ALT_STORAGE_KEY);
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
    await persistProfile(freshGuest);
    this.notify();
    return freshGuest;
  }
}

export const playerProfileService = new PlayerProfileService();
