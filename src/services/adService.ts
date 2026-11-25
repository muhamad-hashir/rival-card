// src/services/adService.ts - Non-intrusive Google AdMob Rewarded & Interstitial Ad Manager
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameMode, SeriesState } from '../types';
import { playerProfileService, PlayerProfile } from './playerProfileService';

function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    return rn?.Platform?.OS ?? 'node';
  } catch {
    return 'node';
  }
}

export const ADMOB_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const ADMOB_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';
export const ADMOB_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

export const REWARDED_AD_COIN_PAYOUT = 100;
export const MAX_REWARDED_ADS_PER_DAY = 5;
export const MAX_TOTAL_REWARDED_ADS_PER_DAY = MAX_REWARDED_ADS_PER_DAY * 2;
export const REWARDED_COOLDOWN_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INTERSTITIAL_MATCH_INTERVAL = 3;

export const REWARDED_SHOP_TIMESTAMPS_STORAGE_KEY = '@rivalcard:rewarded_ad_timestamps_shop';
export const REWARDED_POST_MATCH_TIMESTAMPS_STORAGE_KEY =
  '@rivalcard:rewarded_ad_timestamps_post_match';
export const REWARDED_TIMESTAMPS_STORAGE_KEY = REWARDED_SHOP_TIMESTAMPS_STORAGE_KEY;
export const COMPLETED_MATCHES_AD_STORAGE_KEY = '@rivalcard:completed_matches_for_ads';
export const CONSECUTIVE_LOSSES_AD_STORAGE_KEY = '@rivalcard:consecutive_losses_for_ads';
export const LOSS_STREAK_RECOVERY_THRESHOLD = 2;
export const LOSS_STREAK_AD_SUPPRESS_THRESHOLD = 3;

export type RewardedAdPlacement = 'shop' | 'post_match';

const FALLBACK_AD_EVENT_TYPES = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
} as const;

const FALLBACK_REWARDED_EVENT_TYPES = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'rewarded_earned_reward',
} as const;

export interface AdInstanceLike {
  loaded?: boolean;
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (eventType: string, listener: (payload?: any) => void) => () => void;
}

export interface MobileAdsModuleLike {
  default?: () => { initialize: () => Promise<any> };
  RewardedAd: {
    createForAdRequest: (adUnitId: string, requestOptions?: Record<string, any>) => AdInstanceLike;
  };
  InterstitialAd: {
    createForAdRequest: (adUnitId: string, requestOptions?: Record<string, any>) => AdInstanceLike;
  };
  AdEventType: {
    LOADED: string;
    ERROR: string;
    OPENED?: string;
    CLOSED: string;
  };
  RewardedAdEventType: {
    LOADED: string;
    EARNED_REWARD: string;
  };
}

export interface RewardedAdCooldownStatus {
  placement: RewardedAdPlacement;
  canWatch: boolean;
  watchedToday: number;
  remainingWatches: number;
  maxPerDay: number;
  nextAvailableInMs: number;
}

export interface RewardedAdResult {
  shown: boolean;
  rewarded: boolean;
  coinsAwarded: number;
  profile?: PlayerProfile;
  cooldownStatus: RewardedAdCooldownStatus;
  reason?: 'rewarded' | 'cooldown' | 'unavailable' | 'dismissed_early' | 'error';
  message: string;
}

export interface InterstitialCheckResult {
  shown: boolean;
  completedMatchesCount: number;
  shouldShow: boolean;
  skippedReason?:
    | 'tutorial'
    | 'interval'
    | 'room_series_in_progress'
    | 'loss_streak_guard'
    | 'not_loaded'
    | 'unavailable'
    | 'error';
}

export interface RecordCompletedMatchOptions {
  isTutorial?: boolean;
  isWinner?: boolean;
  wasRecoveryBotMatch?: boolean;
  /**
   * True for Online Room matches (multiplayer room series with 2-4 players, non-Quick-Match).
   * Room matches do not increment the 3-match counter, do not update consecutive losses or
   * recovery bot triggers, and are never blocked by the 3-loss suppression guard.
   */
  isOnlineRoom?: boolean;
  /**
   * For `isOnlineRoom` matches: true only when the entire room series finishes (final match
   * completed, series ended early, or single-game room concluded). When false, no interstitial
   * is queued between individual room games.
   */
  isSeriesComplete?: boolean;
}

export interface MatchAdContextInput {
  gameMode: GameMode;
  isQuickMatch: boolean;
  isTutorial?: boolean;
  isGameOver: boolean;
  isRecoveryMatch?: boolean;
  seriesState?: Pick<
    SeriesState,
    'isPrivateSeries' | 'currentMatchNumber' | 'totalMatches' | 'seriesEndedEarly'
  > | null;
}

export interface MatchAdContext {
  isOnlineRoom: boolean;
  isSeriesComplete: boolean;
  canShowPendingInterstitialOnExit: boolean;
}

/**
 * Classifies whether a match belongs to an Online Room series (2-4 players) vs Solo/Quick Match,
 * whether the entire room series has finished, and whether an exit/rematch transition is eligible
 * to display a queued post-match interstitial.
 */
export function resolveMatchAdContext(input: MatchAdContextInput): MatchAdContext {
  if (input.isTutorial) {
    return {
      isOnlineRoom: false,
      isSeriesComplete: false,
      canShowPendingInterstitialOnExit: false,
    };
  }

  const isOnlineRoom = input.gameMode === 'multiplayer' && !input.isQuickMatch;
  if (!isOnlineRoom) {
    return {
      isOnlineRoom: false,
      isSeriesComplete: false,
      canShowPendingInterstitialOnExit: input.isGameOver,
    };
  }

  const series = input.seriesState;
  const isSeriesComplete = !series?.isPrivateSeries
    ? true
    : Boolean(series.seriesEndedEarly) || series.currentMatchNumber >= series.totalMatches;

  return {
    isOnlineRoom: true,
    isSeriesComplete,
    canShowPendingInterstitialOnExit: input.isGameOver && isSeriesComplete,
  };
}

const memoryStorage: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
    const val = await AsyncStorage.getItem(key);
    if (val !== null) return val;
    return memoryStorage[key] ?? null;
  } catch {
    return memoryStorage[key] ?? null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  memoryStorage[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // Fail silently if native storage is unavailable
  }
}

async function storageRemove(key: string): Promise<void> {
  delete memoryStorage[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function getExpoExtra(): Record<string, any> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants')?.default ?? require('expo-constants');
    return Constants?.expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

export function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

/**
 * Resolves the active Ad Unit ID with automatic Google Test Unit ID fallbacks
 * whenever `__DEV__` is true or the corresponding `EXPO_PUBLIC_ADMOB_*` env var is empty.
 */
export function resolveAdUnitId(
  kind: 'rewarded' | 'interstitial',
  options?: { isDev?: boolean; envValue?: string }
): string {
  const isDev = options?.isDev ?? isDevRuntime();
  const testId = kind === 'rewarded' ? ADMOB_TEST_REWARDED_ID : ADMOB_TEST_INTERSTITIAL_ID;
  if (isDev) {
    return testId;
  }

  const extra = getExpoExtra();
  const rawValue =
    options?.envValue !== undefined
      ? options.envValue
      : kind === 'rewarded'
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || extra.EXPO_PUBLIC_ADMOB_REWARDED_ID
      : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || extra.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;

  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  return trimmed.length > 0 ? trimmed : testId;
}

export function formatCooldownRemaining(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalMinutes = Math.ceil(clamped / 60000);
  if (totalMinutes <= 1) return '1 min';
  if (totalMinutes < 60) return `${totalMinutes} mins`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

class AdService {
  private moduleOverride: MobileAdsModuleLike | null = null;
  private nativeModuleLoaded = false;
  private nativeModule: MobileAdsModuleLike | null = null;
  private initialized = false;

  private rewardedAd: AdInstanceLike | null = null;
  private rewardedLoaded = false;
  private rewardedLoading = false;
  private rewardedUnsubs: Array<() => void> = [];
  private activeRewardedPromise: Promise<RewardedAdResult> | null = null;

  private interstitialAd: AdInstanceLike | null = null;
  private interstitialLoaded = false;
  private interstitialLoading = false;
  private interstitialUnsubs: Array<() => void> = [];
  private pendingPostMatchInterstitial = false;
  private pendingInterstitialBypassLossGuard = false;
  private isShowingInterstitial = false;

  private getMobileAdsModule(): MobileAdsModuleLike | null {
    if (this.moduleOverride) {
      return this.moduleOverride;
    }

    if (getPlatformOS() === 'web') {
      return null;
    }

    if (!this.nativeModuleLoaded) {
      this.nativeModuleLoaded = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('react-native-google-mobile-ads');
        if (mod && mod.RewardedAd && mod.InterstitialAd) {
          this.nativeModule = mod as MobileAdsModuleLike;
        }
      } catch {
        this.nativeModule = null;
      }
    }

    return this.nativeModule;
  }

  /**
   * Injects a mock `react-native-google-mobile-ads` module for automated unit tests.
   */
  public setMobileAdsModuleForTesting(mod: MobileAdsModuleLike | null): void {
    this.clearRewardedListeners();
    this.clearInterstitialListeners();
    this.rewardedAd = null;
    this.rewardedLoaded = false;
    this.rewardedLoading = false;
    this.interstitialAd = null;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this.initialized = false;
    this.pendingPostMatchInterstitial = false;
    this.pendingInterstitialBypassLossGuard = false;
    this.isShowingInterstitial = false;
    this.activeRewardedPromise = null;
    this.moduleOverride = mod;
  }

  private clearRewardedListeners(): void {
    for (const unsub of this.rewardedUnsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.rewardedUnsubs = [];
  }

  private clearInterstitialListeners(): void {
    for (const unsub of this.interstitialUnsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.interstitialUnsubs = [];
  }

  private restoreImmersiveModeIfAndroid(): void {
    if (getPlatformOS() === 'android') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const immersive = require('../utils/immersiveMode');
        immersive?.scheduleImmersiveNavigationBar?.([150, 450]);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Safely initializes Google Mobile Ads SDK and preloads Rewarded & Interstitial ads
   * in the background. Never throws or blocks app boot when offline.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const adsMod = this.getMobileAdsModule();
    if (!adsMod) return;

    try {
      const mobileAdsFactory = adsMod.default;
      if (typeof mobileAdsFactory === 'function') {
        const sdk = mobileAdsFactory();
        if (sdk && typeof sdk.initialize === 'function') {
          await sdk.initialize().catch(() => {});
        }
      }
    } catch {
      // Fail silently
    }

    this.preloadRewardedAd();
    this.preloadInterstitialAd();
  }

  /**
   * Preloads the next Rewarded Ad silently in the background.
   */
  public preloadRewardedAd(): void {
    if (this.rewardedLoaded || this.rewardedLoading) return;
    const adsMod = this.getMobileAdsModule();
    if (!adsMod) return;

    try {
      this.clearRewardedListeners();
      this.rewardedLoading = true;
      this.rewardedLoaded = false;

      const unitId = resolveAdUnitId('rewarded');
      const ad = adsMod.RewardedAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });
      this.rewardedAd = ad;

      const rewardedEvents = adsMod.RewardedAdEventType || FALLBACK_REWARDED_EVENT_TYPES;
      const adEvents = adsMod.AdEventType || FALLBACK_AD_EVENT_TYPES;

      const unsubLoaded = ad.addAdEventListener(rewardedEvents.LOADED, () => {
        this.rewardedLoaded = true;
        this.rewardedLoading = false;
      });
      const unsubError = ad.addAdEventListener(adEvents.ERROR, () => {
        this.rewardedLoaded = false;
        this.rewardedLoading = false;
      });

      this.rewardedUnsubs.push(unsubLoaded, unsubError);
      ad.load();
    } catch {
      this.rewardedLoaded = false;
      this.rewardedLoading = false;
    }
  }

  /**
   * Preloads the next Interstitial Ad silently in the background.
   */
  public preloadInterstitialAd(): void {
    if (this.interstitialLoaded || this.interstitialLoading) return;
    const adsMod = this.getMobileAdsModule();
    if (!adsMod) return;

    try {
      this.clearInterstitialListeners();
      this.interstitialLoading = true;
      this.interstitialLoaded = false;

      const unitId = resolveAdUnitId('interstitial');
      const ad = adsMod.InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });
      this.interstitialAd = ad;

      const adEvents = adsMod.AdEventType || FALLBACK_AD_EVENT_TYPES;

      const unsubLoaded = ad.addAdEventListener(adEvents.LOADED, () => {
        this.interstitialLoaded = true;
        this.interstitialLoading = false;
      });
      const unsubError = ad.addAdEventListener(adEvents.ERROR, () => {
        this.interstitialLoaded = false;
        this.interstitialLoading = false;
      });

      this.interstitialUnsubs.push(unsubLoaded, unsubError);
      ad.load();
    } catch {
      this.interstitialLoaded = false;
      this.interstitialLoading = false;
    }
  }

  public isRewardedAdReady(): boolean {
    return Boolean(this.rewardedAd && this.rewardedLoaded);
  }

  public isInterstitialAdReady(): boolean {
    return Boolean(this.interstitialAd && this.interstitialLoaded);
  }

  private getRewardedStorageKey(placement: RewardedAdPlacement): string {
    return placement === 'post_match'
      ? REWARDED_POST_MATCH_TIMESTAMPS_STORAGE_KEY
      : REWARDED_SHOP_TIMESTAMPS_STORAGE_KEY;
  }

  private async getRewardedClaimTimestamps(
    placement: RewardedAdPlacement = 'shop',
    nowMs: number = Date.now()
  ): Promise<number[]> {
    try {
      const raw = await storageGet(this.getRewardedStorageKey(placement));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cutoff = nowMs - REWARDED_COOLDOWN_WINDOW_MS;
      return parsed
        .filter((ts) => typeof ts === 'number' && Number.isFinite(ts) && ts > cutoff)
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  private async recordRewardedClaimTimestamp(
    placement: RewardedAdPlacement = 'shop',
    nowMs: number = Date.now()
  ): Promise<number[]> {
    const recent = await this.getRewardedClaimTimestamps(placement, nowMs);
    const updated = [...recent, nowMs].slice(-MAX_REWARDED_ADS_PER_DAY);
    await storageSet(this.getRewardedStorageKey(placement), JSON.stringify(updated));
    return updated;
  }

  /**
   * Returns current 24-hour daily cooldown quota for a placement ('shop' or 'post_match').
   * Each placement allows 5 rewarded ads per rolling 24-hour day (10/day total = 1,000 coins/day).
   */
  public async getRewardedAdCooldownStatus(
    placement: RewardedAdPlacement = 'shop',
    nowMs: number = Date.now()
  ): Promise<RewardedAdCooldownStatus> {
    const recent = await this.getRewardedClaimTimestamps(placement, nowMs);
    const watchedToday = recent.length;
    const remainingWatches = Math.max(0, MAX_REWARDED_ADS_PER_DAY - watchedToday);
    const canWatch = remainingWatches > 0;
    const nextAvailableInMs =
      canWatch || recent.length === 0
        ? 0
        : Math.max(0, recent[0] + REWARDED_COOLDOWN_WINDOW_MS - nowMs);

    return {
      placement,
      canWatch,
      watchedToday,
      remainingWatches,
      maxPerDay: MAX_REWARDED_ADS_PER_DAY,
      nextAvailableInMs,
    };
  }

  private waitForRewardedLoad(timeoutMs: number = 3500): Promise<boolean> {
    if (this.rewardedAd && this.rewardedLoaded) {
      return Promise.resolve(true);
    }

    const adsMod = this.getMobileAdsModule();
    if (!adsMod) return Promise.resolve(false);

    if (!this.rewardedLoading) {
      this.preloadRewardedAd();
    }

    const ad = this.rewardedAd;
    if (!ad) return Promise.resolve(false);

    const rewardedEvents = adsMod.RewardedAdEventType || FALLBACK_REWARDED_EVENT_TYPES;
    const adEvents = adsMod.AdEventType || FALLBACK_AD_EVENT_TYPES;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          unsubLoad();
          unsubErr();
        } catch {
          // ignore
        }
        resolve(ok);
      };

      const timer = setTimeout(() => finish(Boolean(this.rewardedLoaded)), timeoutMs);
      const unsubLoad = ad.addAdEventListener(rewardedEvents.LOADED, () => finish(true));
      const unsubErr = ad.addAdEventListener(adEvents.ERROR, () => finish(false));
    });
  }

  /**
   * Displays a Rewarded Ad for the given placement ('shop' or 'post_match') and grants
   * `+100 Coins` strictly AFTER `RewardedAdEventType.EARNED_REWARD` fires.
   * Each placement enforces 5 rewarded ads per rolling 24-hour day (10/day total = 1,000 coins/day).
   * Watching a post-match rewarded ad suppresses any due post-match interstitial on exit.
   */
  public async showRewardedAdForCoins(
    placement: RewardedAdPlacement = 'shop',
    nowMs: number = Date.now()
  ): Promise<RewardedAdResult> {
    if (this.activeRewardedPromise) {
      return this.activeRewardedPromise;
    }

    const run = async (): Promise<RewardedAdResult> => {
      const cooldownStatus = await this.getRewardedAdCooldownStatus(placement, nowMs);
      if (!cooldownStatus.canWatch) {
        const waitLabel = formatCooldownRemaining(cooldownStatus.nextAvailableInMs);
        const label = placement === 'post_match' ? 'Post-match daily' : 'Shop daily';
        return {
          shown: false,
          rewarded: false,
          coinsAwarded: 0,
          cooldownStatus,
          reason: 'cooldown',
          message: `${label} limit reached (${MAX_REWARDED_ADS_PER_DAY}/${MAX_REWARDED_ADS_PER_DAY}). Try again in ${waitLabel}.`,
        };
      }

      const adsMod = this.getMobileAdsModule();
      if (!adsMod) {
        return {
          shown: false,
          rewarded: false,
          coinsAwarded: 0,
          cooldownStatus,
          reason: 'unavailable',
          message: 'Ads are not available on this device right now.',
        };
      }

      const isReady = await this.waitForRewardedLoad(3500);
      const ad = this.rewardedAd;
      if (!isReady || !ad) {
        this.preloadRewardedAd();
        return {
          shown: false,
          rewarded: false,
          coinsAwarded: 0,
          cooldownStatus,
          reason: 'unavailable',
          message: 'No ad ready right now. Check your connection and try again!',
        };
      }

      const rewardedEvents = adsMod.RewardedAdEventType || FALLBACK_REWARDED_EVENT_TYPES;
      const adEvents = adsMod.AdEventType || FALLBACK_AD_EVENT_TYPES;

      let earnedReward = false;

      const outcome = await new Promise<'closed' | 'error'>((resolve) => {
        let settled = false;
        let unsubReward: (() => void) | null = null;
        let unsubClosed: (() => void) | null = null;
        let unsubErr: (() => void) | null = null;

        const finish = (status: 'closed' | 'error') => {
          if (settled) return;
          settled = true;
          try {
            unsubReward?.();
            unsubClosed?.();
            unsubErr?.();
          } catch {
            // ignore
          }
          resolve(status);
        };

        try {
          unsubReward = ad.addAdEventListener(rewardedEvents.EARNED_REWARD, () => {
            earnedReward = true;
          });
          unsubClosed = ad.addAdEventListener(adEvents.CLOSED, () => {
            finish('closed');
          });
          unsubErr = ad.addAdEventListener(adEvents.ERROR, () => {
            finish('error');
          });

          this.rewardedLoaded = false;
          this.rewardedAd = null;
          this.clearRewardedListeners();

          Promise.resolve(ad.show()).catch(() => {
            finish('error');
          });
        } catch {
          finish('error');
        }
      });

      this.restoreImmersiveModeIfAndroid();
      // Always preload next rewarded ad in background
      this.preloadRewardedAd();

      if (earnedReward) {
        if (placement === 'post_match') {
          // Do not double-serve an interstitial right after the player watched a post-match rewarded ad
          this.pendingPostMatchInterstitial = false;
          this.pendingInterstitialBypassLossGuard = false;
        }
        const updatedProfile = await playerProfileService.addCurrency(REWARDED_AD_COIN_PAYOUT, 0);
        await this.recordRewardedClaimTimestamp(placement, nowMs);
        const updatedCooldown = await this.getRewardedAdCooldownStatus(placement, nowMs);
        return {
          shown: true,
          rewarded: true,
          coinsAwarded: REWARDED_AD_COIN_PAYOUT,
          profile: updatedProfile,
          cooldownStatus: updatedCooldown,
          reason: 'rewarded',
          message: `+${REWARDED_AD_COIN_PAYOUT} Coins added to your balance!`,
        };
      }

      if (outcome === 'error') {
        return {
          shown: false,
          rewarded: false,
          coinsAwarded: 0,
          cooldownStatus,
          reason: 'error',
          message: 'Ad could not be displayed right now. Please try again later.',
        };
      }

      return {
        shown: true,
        rewarded: false,
        coinsAwarded: 0,
        cooldownStatus,
        reason: 'dismissed_early',
        message: `Watch the full ad to earn +${REWARDED_AD_COIN_PAYOUT} Coins!`,
      };
    };

    this.activeRewardedPromise = run().finally(() => {
      this.activeRewardedPromise = null;
    });

    return this.activeRewardedPromise;
  }

  public async getCompletedMatchesCount(): Promise<number> {
    try {
      const raw = await storageGet(COMPLETED_MATCHES_AD_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  }

  public async getConsecutiveLosses(): Promise<number> {
    try {
      const raw = await storageGet(CONSECUTIVE_LOSSES_AD_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Returns true when the player has lost 2 or more consecutive matches so matchmaking
   * discreetly pairs them with a friendly human-named undercover bot to restore momentum.
   */
  public async shouldTriggerRecoveryBotMatch(): Promise<boolean> {
    const losses = await this.getConsecutiveLosses();
    return losses >= LOSS_STREAK_RECOVERY_THRESHOLD;
  }

  /**
   * Records a completed match for engagement & ad pacing:
   * - Tutorial matches are never counted and never trigger interstitials.
   * - Online Room matches (multiplayer room series with 2-4 players) never increment the
   *   3-match counter, never update consecutive losses / recovery bot triggers, never show
   *   interstitials between individual rounds, and queue an interstitial for all players on
   *   final series completion regardless of win/loss or 3-loss suppression.
   * - Solo vs AI & Quick Match:
   *   - Tracks consecutive losses: resets to 0 on win, increments on loss.
   *   - Frustration Guard: if consecutiveLosses >= 3, NEVER show an interstitial ad.
   *   - Recovery Win Direct Ad: if the player wins a 2-loss recovery match, queue an interstitial directly.
   *   - Otherwise, shows an interstitial strictly on every 3rd completed non-tutorial match.
   */
  public async recordCompletedMatch(
    options: RecordCompletedMatchOptions = {}
  ): Promise<{
    completedMatchesCount: number;
    consecutiveLosses: number;
    shouldShowInterstitial: boolean;
    suppressedByLossStreak: boolean;
  }> {
    const current = await this.getCompletedMatchesCount();
    const prevLosses = await this.getConsecutiveLosses();
    if (options.isTutorial) {
      return {
        completedMatchesCount: current,
        consecutiveLosses: prevLosses,
        shouldShowInterstitial: false,
        suppressedByLossStreak: false,
      };
    }

    if (options.isOnlineRoom) {
      const seriesDone = options.isSeriesComplete === true;
      this.pendingPostMatchInterstitial = seriesDone;
      this.pendingInterstitialBypassLossGuard = seriesDone;
      this.preloadInterstitialAd();
      return {
        completedMatchesCount: current,
        consecutiveLosses: prevLosses,
        shouldShowInterstitial: seriesDone,
        suppressedByLossStreak: false,
      };
    }

    const nextCount = current + 1;
    await storageSet(COMPLETED_MATCHES_AD_STORAGE_KEY, String(nextCount));

    let nextLosses = prevLosses;
    if (options.isWinner === true) {
      nextLosses = 0;
    } else if (options.isWinner === false) {
      nextLosses = prevLosses + 1;
    }
    await storageSet(CONSECUTIVE_LOSSES_AD_STORAGE_KEY, String(nextLosses));

    // Never frustrate a player who has lost 3+ matches in a row with an interstitial ad
    if (nextLosses >= LOSS_STREAK_AD_SUPPRESS_THRESHOLD) {
      this.pendingPostMatchInterstitial = false;
      this.pendingInterstitialBypassLossGuard = false;
      this.preloadInterstitialAd();
      return {
        completedMatchesCount: nextCount,
        consecutiveLosses: nextLosses,
        shouldShowInterstitial: false,
        suppressedByLossStreak: true,
      };
    }

    const isRecoveryWin = Boolean(options.isWinner === true && options.wasRecoveryBotMatch);
    const isIntervalMatch = nextCount > 0 && nextCount % INTERSTITIAL_MATCH_INTERVAL === 0;
    const shouldShowInterstitial = isRecoveryWin || isIntervalMatch;

    if (shouldShowInterstitial) {
      this.pendingPostMatchInterstitial = true;
      this.pendingInterstitialBypassLossGuard = false;
    }

    // Keep next interstitial warmed up silently in the background
    this.preloadInterstitialAd();

    return {
      completedMatchesCount: nextCount,
      consecutiveLosses: nextLosses,
      shouldShowInterstitial,
      suppressedByLossStreak: false,
    };
  }

  public hasPendingPostMatchInterstitial(): boolean {
    return this.pendingPostMatchInterstitial;
  }

  /**
   * Shows the queued post-match interstitial (respecting the 3+ consecutive losses guard for
   * Solo/Quick Match, and bypassing it for Online Room series completion) when transitioning away
   * from the Victory/Game Over/Series Complete modal. Never blocks or throws.
   */
  public async showPendingPostMatchInterstitialIfDue(): Promise<InterstitialCheckResult> {
    const count = await this.getCompletedMatchesCount();
    const losses = await this.getConsecutiveLosses();

    if (!this.pendingPostMatchInterstitial) {
      this.pendingInterstitialBypassLossGuard = false;
      return {
        shown: false,
        completedMatchesCount: count,
        shouldShow: false,
        skippedReason: 'interval',
      };
    }

    if (!this.pendingInterstitialBypassLossGuard && losses >= LOSS_STREAK_AD_SUPPRESS_THRESHOLD) {
      this.pendingPostMatchInterstitial = false;
      this.pendingInterstitialBypassLossGuard = false;
      return {
        shown: false,
        completedMatchesCount: count,
        shouldShow: false,
        skippedReason: 'loss_streak_guard',
      };
    }

    this.pendingPostMatchInterstitial = false;
    this.pendingInterstitialBypassLossGuard = false;
    return this.showPreloadedInterstitial(count);
  }

  /**
   * Convenience method combining match completion tracking and showing the interstitial
   * strictly on every 3rd completed non-tutorial Solo/Quick Match (or recovery win),
   * or on final completion of an Online Room series, while respecting the 3-loss frustration
   * guard for Solo/Quick Match only.
   */
  public async recordCompletedMatchAndMaybeShowInterstitial(
    options: RecordCompletedMatchOptions = {}
  ): Promise<InterstitialCheckResult> {
    if (options.isTutorial) {
      const count = await this.getCompletedMatchesCount();
      return {
        shown: false,
        completedMatchesCount: count,
        shouldShow: false,
        skippedReason: 'tutorial',
      };
    }

    const { completedMatchesCount, shouldShowInterstitial, suppressedByLossStreak } =
      await this.recordCompletedMatch({
        isTutorial: false,
        isWinner: options.isWinner,
        wasRecoveryBotMatch: options.wasRecoveryBotMatch,
        isOnlineRoom: options.isOnlineRoom,
        isSeriesComplete: options.isSeriesComplete,
      });

    if (suppressedByLossStreak) {
      return {
        shown: false,
        completedMatchesCount,
        shouldShow: false,
        skippedReason: 'loss_streak_guard',
      };
    }

    if (!shouldShowInterstitial) {
      return {
        shown: false,
        completedMatchesCount,
        shouldShow: false,
        skippedReason: options.isOnlineRoom ? 'room_series_in_progress' : 'interval',
      };
    }

    this.pendingPostMatchInterstitial = false;
    this.pendingInterstitialBypassLossGuard = false;
    return this.showPreloadedInterstitial(completedMatchesCount);
  }

  private async showPreloadedInterstitial(
    completedMatchesCount: number
  ): Promise<InterstitialCheckResult> {
    if (this.isShowingInterstitial) {
      return {
        shown: false,
        completedMatchesCount,
        shouldShow: true,
        skippedReason: 'unavailable',
      };
    }

    const adsMod = this.getMobileAdsModule();
    if (!adsMod) {
      return {
        shown: false,
        completedMatchesCount,
        shouldShow: true,
        skippedReason: 'unavailable',
      };
    }

    const ad = this.interstitialAd;
    if (!ad || !this.interstitialLoaded) {
      this.preloadInterstitialAd();
      return {
        shown: false,
        completedMatchesCount,
        shouldShow: true,
        skippedReason: 'not_loaded',
      };
    }

    const adEvents = adsMod.AdEventType || FALLBACK_AD_EVENT_TYPES;
    this.isShowingInterstitial = true;

    const shownOk = await new Promise<boolean>((resolve) => {
      let settled = false;
      let unsubClosed: (() => void) | null = null;
      let unsubError: (() => void) | null = null;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try {
          unsubClosed?.();
          unsubError?.();
        } catch {
          // ignore
        }
        resolve(ok);
      };

      try {
        unsubClosed = ad.addAdEventListener(adEvents.CLOSED, () => finish(true));
        unsubError = ad.addAdEventListener(adEvents.ERROR, () => finish(false));

        this.interstitialLoaded = false;
        this.interstitialAd = null;
        this.clearInterstitialListeners();

        Promise.resolve(ad.show()).catch(() => finish(false));
      } catch {
        finish(false);
      }
    });

    this.isShowingInterstitial = false;
    this.restoreImmersiveModeIfAndroid();
    this.preloadInterstitialAd();

    return {
      shown: shownOk,
      completedMatchesCount,
      shouldShow: true,
      ...(shownOk ? {} : { skippedReason: 'error' as const }),
    };
  }

  /**
   * Clears persisted ad counters & cooldowns (for tests).
   */
  public async resetForTesting(): Promise<void> {
    await storageRemove(REWARDED_SHOP_TIMESTAMPS_STORAGE_KEY);
    await storageRemove(REWARDED_POST_MATCH_TIMESTAMPS_STORAGE_KEY);
    await storageRemove(COMPLETED_MATCHES_AD_STORAGE_KEY);
    await storageRemove(CONSECUTIVE_LOSSES_AD_STORAGE_KEY);
    this.clearRewardedListeners();
    this.clearInterstitialListeners();
    this.rewardedAd = null;
    this.rewardedLoaded = false;
    this.rewardedLoading = false;
    this.interstitialAd = null;
    this.interstitialLoaded = false;
    this.interstitialLoading = false;
    this.pendingPostMatchInterstitial = false;
    this.pendingInterstitialBypassLossGuard = false;
    this.isShowingInterstitial = false;
    this.activeRewardedPromise = null;
    this.initialized = false;
  }
}

export const adService = new AdService();
