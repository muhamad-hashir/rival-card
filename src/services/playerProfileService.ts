// src/services/playerProfileService.ts - Persistent Guest Player Profile, Progression, and Economy System
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { GameMode, Player } from '../types';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses?: number;
  winRate?: number;
  winStreak: number;
  bestStreak?: number;
  rivalCalls?: number;
}

export interface RecordMatchResultOptions {
  matchId?: string;
  rivalCalls?: number;
}

export interface CareerStatEligibilityInput {
  gameMode: GameMode;
  isQuickMatch: boolean;
  isPrivateSeries?: boolean;
  players: ReadonlyArray<Pick<Player, 'id' | 'isBot'>>;
  localPlayerId: string;
}

/**
 * Career Statistics are tracked strictly and exclusively for public human-vs-human Multiplayer
 * matchmaking games (excluding Private Rooms, Solo vs Bot / Bot Fallback, and Local Pass & Play).
 */
export function isEligibleCareerStatMatch(input: CareerStatEligibilityInput): boolean {
  if (input.gameMode !== 'multiplayer') return false;
  if (!input.isQuickMatch) return false;
  if (input.isPrivateSeries) return false;
  return input.players.some((p) => p.id !== input.localPlayerId && !p.isBot);
}

export function normalizePlayerStats(raw: any): PlayerStats {
  const gamesPlayed =
    typeof raw?.gamesPlayed === 'number' && raw.gamesPlayed >= 0 ? raw.gamesPlayed : 0;
  const wins =
    typeof raw?.wins === 'number' && raw.wins >= 0
      ? gamesPlayed > 0
        ? Math.min(raw.wins, gamesPlayed)
        : raw.wins
      : 0;
  const rawLosses =
    typeof raw?.losses === 'number' && raw.losses >= 0
      ? raw.losses
      : Math.max(0, gamesPlayed - wins);
  const losses = gamesPlayed > 0 ? Math.max(rawLosses, gamesPlayed - wins) : rawLosses;
  const winStreak =
    typeof raw?.winStreak === 'number' && raw.winStreak >= 0 ? raw.winStreak : 0;
  const bestStreak = Math.max(
    typeof raw?.bestStreak === 'number' && raw.bestStreak >= 0 ? raw.bestStreak : 0,
    winStreak
  );
  const rivalCalls =
    typeof raw?.rivalCalls === 'number' && raw.rivalCalls >= 0 ? raw.rivalCalls : 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  return {
    gamesPlayed,
    wins,
    losses,
    winRate,
    winStreak,
    bestStreak,
    rivalCalls,
  };
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
export const RECORDED_MATCHES_STORAGE_KEY = '@rivalcard:recorded_career_matches';
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

    // 1. Check all storage keys, prioritizing ALT_STORAGE_KEY (@rival_card_profile)
    const [rawAlt, rawMain, rawLegacy] = await Promise.all([
      storageGet(ALT_STORAGE_KEY),
      storageGet(STORAGE_KEY),
      storageGet(LEGACY_STORAGE_KEY),
    ]);

    const candidates: any[] = [];
    for (const item of [rawAlt, rawMain, rawLegacy]) {
      if (item) {
        try {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed === 'object') {
            candidates.push(parsed);
          }
        } catch {
          // ignore
        }
      }
    }

    if (candidates.length > 0) {
      // Pick the candidate with the highest progression score
      // Score = (level * 10000) + currentXp + coins + (wins * 100)
      const best = candidates.reduce((prev, curr) => {
        const prevScore =
          ((prev.level || 1) * 10000) +
          (prev.currentXp || 0) +
          (prev.coins || 0) +
          ((prev.stats?.wins || 0) * 100);
        const currScore =
          ((curr.level || 1) * 10000) +
          (curr.currentXp || 0) +
          (curr.coins || 0) +
          ((curr.stats?.wins || 0) * 100);
        return currScore > prevScore ? curr : prev;
      }, candidates[0]);

      try {
        const level = typeof best.level === 'number' && best.level >= 1 ? best.level : 1;
        const currentXp = typeof best.currentXp === 'number' && best.currentXp >= 0 ? best.currentXp : 0;
        const xpToNextLevel =
          typeof best.xpToNextLevel === 'number' && best.xpToNextLevel > 0
            ? best.xpToNextLevel
            : level * 100;
        const coins = typeof best.coins === 'number' && best.coins >= 0 ? best.coins : 250;
        const gems = typeof best.gems === 'number' && best.gems >= 0 ? best.gems : 10;
        const isGuest = typeof best.isGuest === 'boolean' ? best.isGuest : true;
        const email = typeof best.email === 'string' && best.email ? best.email : undefined;

        this.cachedProfile = {
          id: typeof best.id === 'string' && best.id ? best.id : generateUUID(),
          nickname:
            typeof best.nickname === 'string' && best.nickname.trim()
              ? best.nickname.trim().slice(0, 16)
              : 'Player',
          avatarId: typeof best.avatarId === 'string' ? best.avatarId : 'avatar_1',
          level,
          currentXp,
          xpToNextLevel,
          coins,
          gems,
          stats: normalizePlayerStats(best.stats),
          isGuest,
          email,
        };
        this.notify();
        return this.cachedProfile;
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
      stats: normalizePlayerStats(null),
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
    if (!updated.isGuest) {
      this.syncProfileToCloud(updated).catch(() => {});
    }
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
    if (!updated.isGuest) {
      this.syncProfileToCloud(updated).catch(() => {});
    }
    return updated;
  }

  private async getRecordedMatchIds(): Promise<string[]> {
    try {
      const raw = await storageGet(RECORDED_MATCHES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string');
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  private async markMatchIdRecorded(matchId: string): Promise<void> {
    const existing = await this.getRecordedMatchIds();
    if (existing.includes(matchId)) return;
    const updated = [...existing, matchId].slice(-100);
    await storageSet(RECORDED_MATCHES_STORAGE_KEY, JSON.stringify(updated));
  }

  /**
   * Sync local career stats and progression to Supabase `profiles` table for signed-in users.
   */
  public async syncProfileToCloud(profile: PlayerProfile): Promise<void> {
    if (!profile || profile.isGuest || !profile.id) return;
    try {
      await Promise.race([
        supabase.from('profiles').upsert({
          id: profile.id,
          email: profile.email || '',
          nickname: profile.nickname,
          avatar_id: profile.avatarId,
          level: profile.level,
          current_xp: profile.currentXp,
          xp_to_next_level: profile.xpToNextLevel,
          coins: profile.coins,
          gems: profile.gems,
          games_played: profile.stats.gamesPlayed,
          wins: profile.stats.wins,
          win_streak: profile.stats.winStreak,
          is_guest: false,
          updated_at: new Date().toISOString(),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('cloud sync timeout')), 2500)),
      ]);
    } catch (err) {
      console.warn('[PlayerProfileService] Cloud stat sync skipped/warning:', err);
    }
  }

  /**
   * Refresh Career Statistics and progression from Supabase for authenticated sessions.
   * Merges monotonically so offline local increments are preserved and never reset to 0.
   */
  public async refreshFromCloudIfAuthenticated(): Promise<PlayerProfile> {
    const local = await this.getProfile(true);
    try {
      const { data: sessionData } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('session timeout')), 2000)),
      ]);
      const userId = sessionData?.session?.user?.id;
      if (!userId) return local;

      const { data: remoteProfile } = await Promise.race([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('profile fetch timeout')), 2500)),
      ]);
      if (!remoteProfile) return local;

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

      const gamesPlayed = Math.max(local.stats.gamesPlayed, remoteGamesPlayed);
      const wins = Math.max(local.stats.wins, remoteWins);
      const losses = Math.max(
        local.stats.losses ?? 0,
        Math.max(0, gamesPlayed - wins)
      );
      const winStreak =
        remoteGamesPlayed > local.stats.gamesPlayed ? remoteWinStreak : local.stats.winStreak;
      const bestStreak = Math.max(
        local.stats.bestStreak ?? 0,
        remoteWinStreak,
        winStreak
      );

      const merged: PlayerProfile = {
        ...local,
        stats: normalizePlayerStats({
          gamesPlayed,
          wins,
          losses,
          winStreak,
          bestStreak,
          rivalCalls: local.stats.rivalCalls ?? 0,
        }),
      };

      this.cachedProfile = merged;
      await persistProfile(merged);
      this.notify();

      if (local.stats.gamesPlayed > remoteGamesPlayed) {
        await this.syncProfileToCloud(merged);
      }

      return merged;
    } catch {
      return local;
    }
  }

  /**
   * Records a qualifying public human-vs-human multiplayer match result,
   * updating gamesPlayed, wins, losses, winRate, winStreak, bestStreak, and rivalCalls.
   * Supports matchId idempotency to prevent double-counting on re-renders or remounts.
   */
  public async recordMatchResult(
    isWinner: boolean,
    options?: RecordMatchResultOptions
  ): Promise<PlayerProfile> {
    const current = await this.getProfile();
    const matchId = options?.matchId?.trim();
    if (matchId) {
      const recordedIds = await this.getRecordedMatchIds();
      if (recordedIds.includes(matchId)) {
        return current;
      }
    }

    const baseStats = normalizePlayerStats(current.stats);
    const nextGamesPlayed = baseStats.gamesPlayed + 1;
    const nextWins = isWinner ? baseStats.wins + 1 : baseStats.wins;
    const nextLosses = isWinner ? (baseStats.losses ?? 0) : (baseStats.losses ?? 0) + 1;
    const nextWinStreak = isWinner ? baseStats.winStreak + 1 : 0;
    const nextBestStreak = Math.max(baseStats.bestStreak ?? 0, nextWinStreak);
    const nextRivalCalls = (baseStats.rivalCalls ?? 0) + Math.max(0, options?.rivalCalls ?? 0);

    const updated: PlayerProfile = {
      ...current,
      stats: normalizePlayerStats({
        gamesPlayed: nextGamesPlayed,
        wins: nextWins,
        losses: nextLosses,
        winStreak: nextWinStreak,
        bestStreak: nextBestStreak,
        rivalCalls: nextRivalCalls,
      }),
    };

    this.cachedProfile = updated;
    await persistProfile(updated);
    if (matchId) {
      await this.markMatchIdRecorded(matchId);
    }
    this.notify();

    if (!updated.isGuest) {
      await this.syncProfileToCloud(updated);
    }
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
    if (!updated.isGuest && (earnedXp > 0 || earnedCoins > 0 || leveledUp)) {
      this.syncProfileToCloud(updated).catch(() => {});
    }

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
    if (!updated.isGuest) {
      this.syncProfileToCloud(updated).catch(() => {});
    }
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
    if (!updated.isGuest) {
      this.syncProfileToCloud(updated).catch(() => {});
    }
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
    await storageRemove(RECORDED_MATCHES_STORAGE_KEY);
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
    const [rawAlt, rawMain, rawLegacy] = await Promise.all([
      storageGet(ALT_STORAGE_KEY),
      storageGet(STORAGE_KEY),
      storageGet(LEGACY_STORAGE_KEY),
    ]);

    const candidates: any[] = [];
    if (this.cachedProfile) candidates.push(this.cachedProfile);
    for (const item of [rawAlt, rawMain, rawLegacy]) {
      if (item) {
        try {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed === 'object') {
            candidates.push(parsed);
          }
        } catch {
          // ignore
        }
      }
    }

    let currentGuest: PlayerProfile;
    if (candidates.length > 0) {
      currentGuest = candidates.reduce((prev, curr) => {
        const prevScore =
          ((prev.level || 1) * 10000) +
          (prev.currentXp || 0) +
          (prev.coins || 0) +
          ((prev.stats?.wins || 0) * 100);
        const currScore =
          ((curr.level || 1) * 10000) +
          (curr.currentXp || 0) +
          (curr.coins || 0) +
          ((curr.stats?.wins || 0) * 100);
        return currScore > prevScore ? curr : prev;
      }, candidates[0]);
    } else {
      currentGuest = await this.getProfile();
    }

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

    const guestDeltaCoins = Math.max(0, guestCoins - 250);
    const guestDeltaGems = Math.max(0, guestGems - 10);
    const hasLocalGuestProgress =
      guestLevel > 1 || guestXP > 0 || guestDeltaCoins > 0 || guestDeltaGems > 0 || guestGamesPlayed > 0;

    let merged: PlayerProfile;

    if (!hasRemoteProgress) {
      // CASE 2: BRAND NEW USER (First-time email link from local guest)
      // Read local guest stats from AsyncStorage (@rival_card_profile) and upsert to cloud record.
      // Progress, level, XP, and coins are NEVER reset to 0 / Level 1.
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
        stats: normalizePlayerStats(currentGuest.stats),
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
        console.warn('[PlayerProfileService] Cloud upsert warning (Case 2 - New User):', upsertErr);
      }
    } else {
      // CASE 1: EXISTING USER (Returning player on new device or re-login)
      const safeRemoteLevel = remoteLevel ?? 1;
      const safeRemoteXp = remoteCurrentXp ?? 0;
      const safeRemoteCoins = remoteCoins ?? 250;
      const safeRemoteGems = remoteGems ?? 10;
      const safeRemoteXpToNextLevel =
        typeof (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel) === 'number'
          ? (remoteProfile.xp_to_next_level ?? remoteProfile.xpToNextLevel)
          : safeRemoteLevel * 100;

      if (!hasLocalGuestProgress) {
        // Returning player on new device / fresh guest on device:
        // Do NOT overwrite the cloud record with the fresh local guest data!
        // Authoritatively restore the remote cloud profile to local storage & in-memory state.
        let mergedNickname = remoteNickname || authDisplayName;
        if (!mergedNickname || mergedNickname === 'Player') {
          mergedNickname = (guestNickname && guestNickname !== 'Player') ? guestNickname : (authDisplayName || 'Player');
        }

        merged = {
          id: authUser.id,
          email: remoteProfile.email || authEmail,
          nickname: mergedNickname.slice(0, 16),
          avatarId: remoteAvatarId || guestAvatarId || 'avatar_1',
          level: safeRemoteLevel,
          currentXp: safeRemoteXp,
          xpToNextLevel: safeRemoteXpToNextLevel,
          coins: safeRemoteCoins,
          gems: safeRemoteGems,
          stats: normalizePlayerStats({
            gamesPlayed: remoteGamesPlayed,
            wins: remoteWins,
            losses: remoteProfile.losses,
            winStreak: remoteWinStreak,
            bestStreak: remoteProfile.best_streak,
          }),
          isGuest: false,
        };
      } else {
        // Returning player who accumulated guest progression on this device:
        // Merge taking higher values and delta coins so no progress on either side is lost.
        const mergedCoins = Math.max(safeRemoteCoins, guestCoins, safeRemoteCoins + guestDeltaCoins);
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
          mergedXpToNextLevel = safeRemoteXpToNextLevel;
        } else {
          mergedLevel = safeRemoteLevel;
          mergedCurrentXp = Math.max(safeRemoteXp, guestXP);
          mergedXpToNextLevel = safeRemoteXpToNextLevel;
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
          stats: normalizePlayerStats({
            gamesPlayed: mergedGamesPlayed,
            wins: mergedWins,
            winStreak: mergedWinStreak,
            bestStreak: Math.max(
              currentGuest.stats?.bestStreak ?? 0,
              remoteProfile.best_streak ?? 0,
              mergedWinStreak
            ),
            rivalCalls: currentGuest.stats?.rivalCalls ?? 0,
          }),
          isGuest: false,
        };

        // Persist positive delta merges back to cloud record
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
          console.warn('[PlayerProfileService] Cloud upsert warning (Case 1 Delta):', upsertErr);
        }
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
      stats: normalizePlayerStats(null),
      isGuest: true,
    };
    this.cachedProfile = cleanGuest;
    await persistProfile(cleanGuest);
    await storageRemove('@rivalcard:active_online_match');
    await storageRemove(RECORDED_MATCHES_STORAGE_KEY);
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
    await storageRemove(RECORDED_MATCHES_STORAGE_KEY);

    const freshGuest: PlayerProfile = {
      id: generateUUID(),
      nickname: 'Player',
      avatarId: 'avatar_1',
      level: 1,
      currentXp: 0,
      xpToNextLevel: 100,
      coins: 250,
      gems: 10,
      stats: normalizePlayerStats(null),
      isGuest: true,
    };
    this.cachedProfile = freshGuest;
    await persistProfile(freshGuest);
    this.notify();
    return freshGuest;
  }
}

export const playerProfileService = new PlayerProfileService();
