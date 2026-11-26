// src/__tests__/adService.test.ts - Unit tests for Google AdMob Rewarded & Interstitial Ad Manager
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  adService,
  ADMOB_TEST_ANDROID_APP_ID,
  ADMOB_TEST_INTERSTITIAL_ID,
  ADMOB_TEST_REWARDED_ID,
  computeDoubleMatchRewardBonus,
  ENABLE_INTERSTITIAL_ADS,
  formatCooldownRemaining,
  getGoogleMobileAdsModule,
  initializeAdMob,
  INTERSTITIAL_MATCH_INTERVAL,
  MAX_POST_MATCH_REWARDED_ADS_PER_DAY,
  MAX_REWARDED_ADS_PER_DAY,
  MAX_SHOP_REWARDED_ADS_PER_DAY,
  MAX_TOTAL_REWARDED_ADS_PER_DAY,
  POST_MATCH_REWARDED_FALLBACK_MIN_COINS,
  resolveMatchAdContext,
  REWARDED_AD_COIN_PAYOUT,
  REWARDED_COOLDOWN_WINDOW_MS,
  resolveAdUnitId,
  shouldShowPostMatchDoubleRewardButton,
  AdInstanceLike,
  MobileAdsModuleLike,
} from '../services/adService';
import { playerProfileService } from '../services/playerProfileService';

type ListenerFn = (payload?: any) => void;

class MockAdInstance implements AdInstanceLike {
  public loaded = false;
  public loadCalls = 0;
  public showCalls = 0;
  public unitId: string;
  private listeners: Map<string, Set<ListenerFn>> = new Map();
  private onLoadBehavior?: (ad: MockAdInstance) => void;
  private onShowBehavior?: (ad: MockAdInstance) => void;

  constructor(
    unitId: string,
    opts?: {
      onLoad?: (ad: MockAdInstance) => void;
      onShow?: (ad: MockAdInstance) => void;
    }
  ) {
    this.unitId = unitId;
    this.onLoadBehavior = opts?.onLoad;
    this.onShowBehavior = opts?.onShow;
  }

  public addAdEventListener(eventType: string, listener: ListenerFn): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public emit(eventType: string, payload?: any): void {
    const fns = this.listeners.get(eventType);
    if (!fns) return;
    for (const fn of Array.from(fns)) {
      fn(payload);
    }
  }

  public load(): void {
    this.loadCalls += 1;
    if (this.onLoadBehavior) {
      this.onLoadBehavior(this);
    }
  }

  public async show(): Promise<void> {
    this.showCalls += 1;
    if (this.onShowBehavior) {
      this.onShowBehavior(this);
    }
  }
}

function createMockAdsModule(config?: {
  onRewardedLoad?: (ad: MockAdInstance) => void;
  onRewardedShow?: (ad: MockAdInstance) => void;
  onInterstitialLoad?: (ad: MockAdInstance) => void;
  onInterstitialShow?: (ad: MockAdInstance) => void;
}) {
  const createdRewarded: MockAdInstance[] = [];
  const createdInterstitials: MockAdInstance[] = [];
  let initializeCalls = 0;

  const AdEventType = {
    LOADED: 'loaded',
    ERROR: 'error',
    OPENED: 'opened',
    CLOSED: 'closed',
  };

  const RewardedAdEventType = {
    LOADED: 'rewarded_loaded',
    EARNED_REWARD: 'rewarded_earned_reward',
  };

  const mod: MobileAdsModuleLike = {
    default: () => ({
      initialize: async () => {
        initializeCalls += 1;
        return [];
      },
    }),
    AdEventType,
    RewardedAdEventType,
    RewardedAd: {
      createForAdRequest: (adUnitId: string) => {
        const instance = new MockAdInstance(adUnitId, {
          onLoad:
            config?.onRewardedLoad ??
            ((ad) => {
              ad.loaded = true;
              ad.emit(RewardedAdEventType.LOADED, { type: 'coins', amount: 100 });
            }),
          onShow:
            config?.onRewardedShow ??
            ((ad) => {
              ad.emit(RewardedAdEventType.EARNED_REWARD, { type: 'coins', amount: 100 });
              ad.emit(AdEventType.CLOSED);
            }),
        });
        createdRewarded.push(instance);
        return instance;
      },
    },
    InterstitialAd: {
      createForAdRequest: (adUnitId: string) => {
        const instance = new MockAdInstance(adUnitId, {
          onLoad:
            config?.onInterstitialLoad ??
            ((ad) => {
              ad.loaded = true;
              ad.emit(AdEventType.LOADED);
            }),
          onShow:
            config?.onInterstitialShow ??
            ((ad) => {
              ad.emit(AdEventType.CLOSED);
            }),
        });
        createdInterstitials.push(instance);
        return instance;
      },
    },
  };

  return {
    mod,
    createdRewarded,
    createdInterstitials,
    getInitializeCalls: () => initializeCalls,
    AdEventType,
    RewardedAdEventType,
  };
}

describe('Google AdMob Service (Rewarded +100 Coins & Every-3rd-Match Interstitial)', () => {
  beforeEach(async () => {
    await adService.resetForTesting();
    adService.setMobileAdsModuleForTesting(null);
    await playerProfileService.resetProfile();
  });

  afterEach(async () => {
    await adService.resetForTesting();
    adService.setMobileAdsModuleForTesting(null);
  });

  test('app.json, app.config.ts, and .env.example configure AdMob and block unused foreground service permissions', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'app.json'), 'utf8')
    );
    const blocked: string[] = appJson.expo?.android?.blockedPermissions ?? [];
    assert.ok(blocked.includes('android.permission.FOREGROUND_SERVICE'));
    assert.ok(blocked.includes('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'));

    const plugins: any[] = appJson.expo?.plugins ?? [];
    const adMobPlugin = plugins.find(
      (p) => (Array.isArray(p) ? p[0] : p) === 'react-native-google-mobile-ads'
    );
    assert.ok(Array.isArray(adMobPlugin), 'app.json must configure react-native-google-mobile-ads plugin');
    assert.strictEqual(adMobPlugin[1]?.androidAppId, ADMOB_TEST_ANDROID_APP_ID);

    const appConfigPath = path.resolve(process.cwd(), 'app.config.ts');
    assert.ok(fs.existsSync(appConfigPath), 'app.config.ts must exist for dynamic env androidAppId');
    const appConfigSrc = fs.readFileSync(appConfigPath, 'utf8');
    assert.ok(appConfigSrc.includes('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID'));
    assert.ok(appConfigSrc.includes(ADMOB_TEST_ANDROID_APP_ID));

    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const envExampleSrc = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(envExampleSrc.includes('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID'));
    assert.ok(envExampleSrc.includes('EXPO_PUBLIC_ADMOB_REWARDED_ID'));
    assert.ok(envExampleSrc.includes('EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID'));
  });

  test('resolveAdUnitId uses Google official test IDs in __DEV__ or when env vars are empty', () => {
    assert.strictEqual(
      resolveAdUnitId('rewarded', { isDev: true, envValue: 'ca-app-pub-prod/rewarded' }),
      ADMOB_TEST_REWARDED_ID
    );
    assert.strictEqual(
      resolveAdUnitId('interstitial', { isDev: true, envValue: 'ca-app-pub-prod/interstitial' }),
      ADMOB_TEST_INTERSTITIAL_ID
    );
    assert.strictEqual(
      resolveAdUnitId('rewarded', { isDev: false, envValue: '' }),
      ADMOB_TEST_REWARDED_ID
    );
    assert.strictEqual(
      resolveAdUnitId('interstitial', { isDev: false, envValue: '   ' }),
      ADMOB_TEST_INTERSTITIAL_ID
    );
    assert.strictEqual(
      resolveAdUnitId('rewarded', { isDev: false, envValue: 'ca-app-pub-123/456' }),
      'ca-app-pub-123/456'
    );
    assert.strictEqual(
      resolveAdUnitId('interstitial', { isDev: false, envValue: 'ca-app-pub-123/789' }),
      'ca-app-pub-123/789'
    );
  });

  test('ENABLE_INTERSTITIAL_ADS is false by default: skips interstitial preloads/shows while rewarded ads & loss-streak recovery stay active', async () => {
    assert.strictEqual(ENABLE_INTERSTITIAL_ADS, false);

    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    assert.strictEqual(mock.getInitializeCalls(), 1);
    assert.strictEqual(mock.createdRewarded.length, 1);
    assert.strictEqual(mock.createdInterstitials.length, 0, 'Must NOT preload interstitials when ENABLE_INTERSTITIAL_ADS is false');
    assert.strictEqual(adService.isRewardedAdReady(), true);
    assert.strictEqual(adService.isInterstitialAdReady(), false);

    // Rewarded ads still work normally and grant +100 Coins
    const rewardedRes = await adService.showRewardedAdForCoins('shop', 1_234_567);
    assert.strictEqual(rewardedRes.shown, true);
    assert.strictEqual(rewardedRes.rewarded, true);
    assert.strictEqual(rewardedRes.coinsAwarded, 100);

    // Calling preloadInterstitialAd() directly also remains a no-op
    adService.preloadInterstitialAd();
    assert.strictEqual(mock.createdInterstitials.length, 0);

    // Match tracking & 2-loss recovery still work, while interstitials return reason: 'interstitials_disabled'
    const l1 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isWinner: false });
    assert.strictEqual(l1.shown, false);
    assert.strictEqual(l1.reason, 'interstitials_disabled');

    const l2 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isWinner: false });
    assert.strictEqual(l2.shown, false);
    assert.strictEqual(l2.reason, 'interstitials_disabled');
    assert.strictEqual(await adService.getConsecutiveLosses(), 2);
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), true);

    // 3rd match & room series completion never queue/show interstitials while disabled
    const m3 = await adService.recordCompletedMatch({ isWinner: true, wasRecoveryBotMatch: true });
    assert.strictEqual(m3.completedMatchesCount, 3);
    assert.strictEqual(m3.shouldShowInterstitial, false);
    assert.strictEqual(await adService.getConsecutiveLosses(), 0);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);

    const pendingSolo = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(pendingSolo.shown, false);
    assert.strictEqual(pendingSolo.reason, 'interstitials_disabled');

    await adService.recordCompletedMatch({ isOnlineRoom: true, isSeriesComplete: true, isWinner: true });
    const pendingRoom = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(pendingRoom.shown, false);
    assert.strictEqual(pendingRoom.reason, 'interstitials_disabled');
    assert.strictEqual(mock.createdInterstitials.length, 0);
  });

  test('initialize() preloads ads silently without showing any ad on first launch (when interstitials enabled)', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);

    await adService.initialize();

    assert.strictEqual(mock.getInitializeCalls(), 1);
    assert.strictEqual(mock.createdRewarded.length, 1);
    assert.strictEqual(mock.createdInterstitials.length, 1);
    assert.strictEqual(mock.createdRewarded[0].showCalls, 0);
    assert.strictEqual(mock.createdInterstitials[0].showCalls, 0);
    assert.strictEqual(adService.isRewardedAdReady(), true);
    assert.strictEqual(adService.isInterstitialAdReady(), true);
  });

  test('Rewarded ad grants +100 Coins strictly after EARNED_REWARD fires and preloads next ad', async () => {
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    const beforeProfile = await playerProfileService.getProfile();
    const initialCoins = beforeProfile.coins;

    const result = await adService.showRewardedAdForCoins('shop', 1_000_000);
    assert.strictEqual(result.shown, true);
    assert.strictEqual(result.rewarded, true);
    assert.strictEqual(result.coinsAwarded, REWARDED_AD_COIN_PAYOUT);
    assert.strictEqual(result.coinsAwarded, 100);
    assert.strictEqual(result.cooldownStatus.placement, 'shop');
    assert.strictEqual(result.cooldownStatus.watchedToday, 1);
    assert.strictEqual(result.cooldownStatus.remainingWatches, MAX_REWARDED_ADS_PER_DAY - 1);
    assert.strictEqual(result.cooldownStatus.maxPerDay, 5);

    const afterProfile = await playerProfileService.getProfile();
    assert.strictEqual(afterProfile.coins, initialCoins + 100);

    // Preloaded next rewarded ad in background
    assert.strictEqual(mock.createdRewarded.length, 2);
  });

  test('Rewarded ad closed early without EARNED_REWARD grants 0 Coins and does not consume daily quota', async () => {
    const mock = createMockAdsModule({
      onRewardedShow: (ad) => {
        // User closes ad without earning reward
        ad.emit('closed');
      },
    });
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    const beforeProfile = await playerProfileService.getProfile();
    const result = await adService.showRewardedAdForCoins('shop', 1_000_000);

    assert.strictEqual(result.shown, true);
    assert.strictEqual(result.rewarded, false);
    assert.strictEqual(result.coinsAwarded, 0);
    assert.strictEqual(result.reason, 'dismissed_early');
    assert.strictEqual(result.cooldownStatus.watchedToday, 0);
    assert.strictEqual(result.cooldownStatus.remainingWatches, MAX_REWARDED_ADS_PER_DAY);

    const afterProfile = await playerProfileService.getProfile();
    assert.strictEqual(afterProfile.coins, beforeProfile.coins);
  });

  test('Split daily quotas allow 5 Shop (+100 Coins) + 6 Post-Match (2x) rewarded ads independently and show clean exhaustion message', async () => {
    assert.strictEqual(MAX_SHOP_REWARDED_ADS_PER_DAY, 5);
    assert.strictEqual(MAX_REWARDED_ADS_PER_DAY, 5);
    assert.strictEqual(MAX_POST_MATCH_REWARDED_ADS_PER_DAY, 6);
    assert.strictEqual(MAX_TOTAL_REWARDED_ADS_PER_DAY, 11);
    assert.strictEqual(REWARDED_COOLDOWN_WINDOW_MS, 24 * 60 * 60 * 1000);
    assert.strictEqual(formatCooldownRemaining(24 * 60 * 60 * 1000), '24h');
    assert.strictEqual(formatCooldownRemaining(23 * 60 * 60 * 1000 + 15 * 60 * 1000), '23h 15m');
    assert.strictEqual(formatCooldownRemaining(5 * 60 * 1000), '5 mins');

    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    const baseTime = 10_000_000;
    const startCoins = (await playerProfileService.getProfile()).coins;

    // 1. Exhaust all 5 Shop rewarded ads (500 coins)
    for (let i = 0; i < MAX_SHOP_REWARDED_ADS_PER_DAY; i++) {
      const res = await adService.showRewardedAdForCoins('shop', baseTime + i * 1000);
      assert.strictEqual(res.rewarded, true, `Shop rewarded ad #${i + 1} should succeed`);
      assert.strictEqual(res.coinsAwarded, 100);
      assert.strictEqual(res.cooldownStatus.placement, 'shop');
      assert.strictEqual(res.cooldownStatus.maxPerDay, 5);
    }

    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 500);

    // 6th Shop attempt within 24h is blocked cleanly
    const blockedShopRes = await adService.showRewardedAdForCoins('shop', baseTime + 2 * 60 * 60 * 1000);
    assert.strictEqual(blockedShopRes.shown, false);
    assert.strictEqual(blockedShopRes.rewarded, false);
    assert.strictEqual(blockedShopRes.coinsAwarded, 0);
    assert.strictEqual(blockedShopRes.reason, 'cooldown');
    assert.strictEqual(blockedShopRes.message, 'No more ads available for today.');
    assert.strictEqual(blockedShopRes.cooldownStatus.remainingWatches, 0);

    // 2. Post-Match bucket is completely independent -> allows 6 watches/day
    const postStatusBefore = await adService.getRewardedAdCooldownStatus('post_match', baseTime + 10_000);
    assert.strictEqual(postStatusBefore.canWatch, true);
    assert.strictEqual(postStatusBefore.remainingWatches, 6);
    assert.strictEqual(postStatusBefore.maxPerDay, 6);

    for (let i = 0; i < MAX_POST_MATCH_REWARDED_ADS_PER_DAY; i++) {
      const res = await adService.showRewardedAdForCoins('post_match', baseTime + 20_000 + i * 1000);
      assert.strictEqual(res.rewarded, true, `Post-match rewarded ad #${i + 1} should succeed`);
      assert.strictEqual(res.coinsAwarded, 100);
      assert.strictEqual(res.cooldownStatus.placement, 'post_match');
      assert.strictEqual(res.cooldownStatus.maxPerDay, 6);
    }

    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 1100);

    // 7th Post-Match attempt within 24h is blocked cleanly
    const blockedPostRes = await adService.showRewardedAdForCoins(
      'post_match',
      baseTime + 2 * 60 * 60 * 1000
    );
    assert.strictEqual(blockedPostRes.shown, false);
    assert.strictEqual(blockedPostRes.reason, 'cooldown');
    assert.strictEqual(blockedPostRes.message, 'No more ads available for today.');

    // After 24 hours + 1ms from first watch, Shop quota opens back up
    const unlockedRes = await adService.showRewardedAdForCoins(
      'shop',
      baseTime + REWARDED_COOLDOWN_WINDOW_MS + 1
    );
    assert.strictEqual(unlockedRes.rewarded, true);
    assert.strictEqual(unlockedRes.coinsAwarded, 100);
    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 1200);
  });

  test('Smart Post-Match Interstitial shows strictly after every 3rd completed non-tutorial match', async () => {
    assert.strictEqual(INTERSTITIAL_MATCH_INTERVAL, 3);
    adService.setInterstitialAdsEnabledForTesting(true);

    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    // Tutorial matches never increment count and never show interstitials
    const tutRes = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: true });
    assert.strictEqual(tutRes.shown, false);
    assert.strictEqual(tutRes.completedMatchesCount, 0);
    assert.strictEqual(tutRes.skippedReason, 'tutorial');

    // Match 1 -> no interstitial
    const m1 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    assert.strictEqual(m1.completedMatchesCount, 1);
    assert.strictEqual(m1.shown, false);
    assert.strictEqual(m1.skippedReason, 'interval');

    // Match 2 -> no interstitial
    const m2 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    assert.strictEqual(m2.completedMatchesCount, 2);
    assert.strictEqual(m2.shown, false);
    assert.strictEqual(m2.skippedReason, 'interval');

    // Match 3 -> SHOWS interstitial and preloads next one
    const m3 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    assert.strictEqual(m3.completedMatchesCount, 3);
    assert.strictEqual(m3.shouldShow, true);
    assert.strictEqual(m3.shown, true);

    // Tutorial after match 3 still never triggers or increments
    const tutRes2 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: true });
    assert.strictEqual(tutRes2.shown, false);
    assert.strictEqual(tutRes2.completedMatchesCount, 3);

    // Matches 4 & 5 -> no interstitial
    const m4 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    const m5 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    assert.strictEqual(m4.shown, false);
    assert.strictEqual(m5.shown, false);

    // Match 6 -> SHOWS interstitial again
    const m6 = await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    assert.strictEqual(m6.completedMatchesCount, 6);
    assert.strictEqual(m6.shown, true);

    const totalInterstitialShows = mock.createdInterstitials.reduce(
      (sum, ad) => sum + ad.showCalls,
      0
    );
    assert.strictEqual(totalInterstitialShows, 2);
  });

  test('Deferred post-match interstitial fires cleanly on transition after every 3rd match', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    await adService.recordCompletedMatch({ isTutorial: false });
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);

    await adService.recordCompletedMatch({ isTutorial: false });
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);

    const third = await adService.recordCompletedMatch({ isTutorial: false });
    assert.strictEqual(third.shouldShowInterstitial, true);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), true);

    const shown = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(shown.shown, true);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);

    // Subsequent call without another 3 matches does not double-show
    const secondCall = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(secondCall.shown, false);
  });

  test('Watching a post-match rewarded ad suppresses any due post-match interstitial on exit', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    await adService.recordCompletedMatch({ isTutorial: false });
    await adService.recordCompletedMatch({ isTutorial: false });
    const third = await adService.recordCompletedMatch({ isTutorial: false });
    assert.strictEqual(third.shouldShowInterstitial, true);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), true);

    // Player watches optional post-match rewarded ad on Victory screen
    const rewardedRes = await adService.showRewardedAdForCoins('post_match', 5_000_000);
    assert.strictEqual(rewardedRes.rewarded, true);
    assert.strictEqual(rewardedRes.coinsAwarded, 100);

    // Due post-match interstitial must be suppressed when leaving the Victory screen
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);
    const interstitialRes = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(interstitialRes.shown, false);
    assert.strictEqual(
      mock.createdInterstitials.reduce((sum, ad) => sum + ad.showCalls, 0),
      0
    );
  });

  test('Fails silently without throwing when offline or when ads fail to fill', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule({
      onRewardedLoad: (ad) => {
        ad.loaded = false;
        ad.emit('error', new Error('No fill'));
      },
      onInterstitialLoad: (ad) => {
        ad.loaded = false;
        ad.emit('error', new Error('Offline'));
      },
    });
    adService.setMobileAdsModuleForTesting(mock.mod);

    await assert.doesNotReject(async () => {
      await adService.initialize();
    });

    const rewardedRes = await adService.showRewardedAdForCoins('shop', 2_000_000);
    assert.strictEqual(rewardedRes.shown, false);
    assert.strictEqual(rewardedRes.rewarded, false);
    assert.strictEqual(rewardedRes.coinsAwarded, 0);
    assert.strictEqual(rewardedRes.reason, 'unavailable');

    // Reach 3rd match with failed interstitial fill -> never crashes or blocks
    await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    await adService.recordCompletedMatchAndMaybeShowInterstitial({ isTutorial: false });
    const thirdRes = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isTutorial: false,
    });
    assert.strictEqual(thirdRes.completedMatchesCount, 3);
    assert.strictEqual(thirdRes.shown, false);
    assert.strictEqual(thirdRes.skippedReason, 'not_loaded');
  });

  test('3-loss frustration guard suppresses interstitials, while winning a 2-loss recovery match triggers an ad directly', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    // Loss 1 -> consecutiveLosses = 1, shouldTriggerRecoveryBotMatch = false
    const l1 = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isTutorial: false,
      isWinner: false,
    });
    assert.strictEqual(l1.shown, false);
    assert.strictEqual(await adService.getConsecutiveLosses(), 1);
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), false);

    // Loss 2 -> consecutiveLosses = 2, shouldTriggerRecoveryBotMatch = true (2 losses in a row!)
    const l2 = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isTutorial: false,
      isWinner: false,
    });
    assert.strictEqual(l2.shown, false);
    assert.strictEqual(await adService.getConsecutiveLosses(), 2);
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), true);

    // If player loses Match 3 too (3 losses in a row!) -> Frustration guard MUST suppress interstitial!
    const l3 = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isTutorial: false,
      isWinner: false,
    });
    assert.strictEqual(l3.completedMatchesCount, 3);
    assert.strictEqual(l3.shouldShow, false);
    assert.strictEqual(l3.shown, false);
    assert.strictEqual(l3.skippedReason, 'loss_streak_guard');
    assert.strictEqual(await adService.getConsecutiveLosses(), 3);
    assert.strictEqual(
      mock.createdInterstitials.reduce((sum, ad) => sum + ad.showCalls, 0),
      0,
      'Must NOT show interstitial after 3 consecutive losses'
    );

    // Now player wins the recovery match (match #4, not a multiple of 3!) -> resets streak & shows ad directly!
    const recoveryWin = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isTutorial: false,
      isWinner: true,
      wasRecoveryBotMatch: true,
    });
    assert.strictEqual(recoveryWin.completedMatchesCount, 4);
    assert.strictEqual(recoveryWin.shouldShow, true);
    assert.strictEqual(recoveryWin.shown, true);
    assert.strictEqual(await adService.getConsecutiveLosses(), 0);
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), false);
  });

  test('Online Room series: individual games never increment 3-match counter, trigger recovery bots, or show between-round ads', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    // Seed Solo/Quick Match state: 2 matches played, 1 consecutive loss
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: true });
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    assert.strictEqual(await adService.getCompletedMatchesCount(), 2);
    assert.strictEqual(await adService.getConsecutiveLosses(), 1);

    // Play 4 individual Online Room rounds (losses & wins) in an ongoing 5-match series
    for (let round = 1; round <= 4; round++) {
      const roundRes = await adService.recordCompletedMatch({
        isTutorial: false,
        isWinner: round % 2 === 0,
        isOnlineRoom: true,
        isSeriesComplete: false,
      });
      assert.strictEqual(roundRes.completedMatchesCount, 2, `Room match #${round} must not increment 3-match counter`);
      assert.strictEqual(roundRes.consecutiveLosses, 1, `Room match #${round} must not alter consecutiveLosses`);
      assert.strictEqual(roundRes.shouldShowInterstitial, false, `No interstitial after ongoing Room match #${round}`);
      assert.strictEqual(roundRes.suppressedByLossStreak, false);
      assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);
    }

    assert.strictEqual(await adService.getCompletedMatchesCount(), 2);
    assert.strictEqual(await adService.getConsecutiveLosses(), 1);
    assert.strictEqual(await adService.shouldTriggerRecoveryBotMatch(), false);
    assert.strictEqual(
      mock.createdInterstitials.reduce((sum, ad) => sum + ad.showCalls, 0),
      0
    );

    // Direct call helper during ongoing room series also stays silent
    const midSeriesDirect = await adService.recordCompletedMatchAndMaybeShowInterstitial({
      isOnlineRoom: true,
      isSeriesComplete: false,
      isWinner: false,
    });
    assert.strictEqual(midSeriesDirect.shown, false);
    assert.strictEqual(midSeriesDirect.shouldShow, false);
    assert.strictEqual(midSeriesDirect.skippedReason, 'room_series_in_progress');
    assert.strictEqual(await adService.getCompletedMatchesCount(), 2);
  });

  test('Online Room series completion triggers interstitial for both winners & losers even when consecutiveLosses >= 3', async () => {
    adService.setInterstitialAdsEnabledForTesting(true);
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    // Put player into 3-loss suppression state via Solo/Quick Match
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    await adService.recordCompletedMatch({ isTutorial: false, isWinner: false });
    assert.strictEqual(await adService.getCompletedMatchesCount(), 3);
    assert.strictEqual(await adService.getConsecutiveLosses(), 3);

    // Winner finishing an Online Room series gets the series-end interstitial (bypasses loss_streak_guard)
    const winnerRecord = await adService.recordCompletedMatch({
      isOnlineRoom: true,
      isSeriesComplete: true,
      isWinner: true,
    });
    assert.strictEqual(winnerRecord.completedMatchesCount, 3);
    assert.strictEqual(winnerRecord.consecutiveLosses, 3);
    assert.strictEqual(winnerRecord.shouldShowInterstitial, true);
    assert.strictEqual(winnerRecord.suppressedByLossStreak, false);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), true);

    const winnerShown = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(winnerShown.shown, true);
    assert.strictEqual(winnerShown.shouldShow, true);

    // Loser finishing an Online Room series ALSO gets the series-end interstitial even with 3 Solo losses
    const loserRecord = await adService.recordCompletedMatch({
      isOnlineRoom: true,
      isSeriesComplete: true,
      isWinner: false,
    });
    assert.strictEqual(loserRecord.completedMatchesCount, 3);
    assert.strictEqual(loserRecord.consecutiveLosses, 3);
    assert.strictEqual(loserRecord.shouldShowInterstitial, true);
    assert.strictEqual(loserRecord.suppressedByLossStreak, false);

    const loserShown = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(loserShown.shown, true);
    assert.strictEqual(loserShown.shouldShow, true);

    // Watching a post-match rewarded ad on the final room screen still prevents back-to-back interstitials
    await adService.recordCompletedMatch({
      isOnlineRoom: true,
      isSeriesComplete: true,
      isWinner: false,
    });
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), true);
    const rewardedRes = await adService.showRewardedAdForCoins('post_match', 7_000_000);
    assert.strictEqual(rewardedRes.rewarded, true);
    assert.strictEqual(adService.hasPendingPostMatchInterstitial(), false);

    const suppressedBackToBack = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(suppressedBackToBack.shown, false);

    // Total interstitials shown = 2 (winner + loser), NOT 3
    assert.strictEqual(
      mock.createdInterstitials.reduce((sum, ad) => sum + ad.showCalls, 0),
      2
    );
  });

  test('resolveMatchAdContext cleanly separates Online Room series from Solo, Quick Match, and Tutorial', () => {
    // Tutorial never shows ads
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'vs_bot',
        isQuickMatch: false,
        isTutorial: true,
        isGameOver: true,
      }),
      {
        isOnlineRoom: false,
        isSeriesComplete: false,
        canShowPendingInterstitialOnExit: false,
      }
    );

    // Solo vs AI & Quick Match (both vs_bot fallback and 1v1 human) follow standard Solo/QM rules
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'vs_bot',
        isQuickMatch: false,
        isGameOver: true,
      }),
      {
        isOnlineRoom: false,
        isSeriesComplete: false,
        canShowPendingInterstitialOnExit: true,
      }
    );
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'multiplayer',
        isQuickMatch: true,
        isGameOver: true,
      }),
      {
        isOnlineRoom: false,
        isSeriesComplete: false,
        canShowPendingInterstitialOnExit: true,
      }
    );

    // Online Room round 2 of 5 -> ongoing series, cannot show interstitial on exit
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'multiplayer',
        isQuickMatch: false,
        isGameOver: true,
        seriesState: {
          isPrivateSeries: true,
          currentMatchNumber: 2,
          totalMatches: 5,
          seriesEndedEarly: false,
        },
      }),
      {
        isOnlineRoom: true,
        isSeriesComplete: false,
        canShowPendingInterstitialOnExit: false,
      }
    );

    // Online Room final match 5 of 5 -> series complete, eligible for interstitial
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'multiplayer',
        isQuickMatch: false,
        isGameOver: true,
        seriesState: {
          isPrivateSeries: true,
          currentMatchNumber: 5,
          totalMatches: 5,
          seriesEndedEarly: false,
        },
      }),
      {
        isOnlineRoom: true,
        isSeriesComplete: true,
        canShowPendingInterstitialOnExit: true,
      }
    );

    // Online Room ended early (e.g. players left after match 2) -> series complete
    assert.deepStrictEqual(
      resolveMatchAdContext({
        gameMode: 'multiplayer',
        isQuickMatch: false,
        isGameOver: true,
        seriesState: {
          isPrivateSeries: true,
          currentMatchNumber: 2,
          totalMatches: 5,
          seriesEndedEarly: true,
        },
      }),
      {
        isOnlineRoom: true,
        isSeriesComplete: true,
        canShowPendingInterstitialOnExit: true,
      }
    );
  });

  test('Lazy native module loader returns null safely and AdService no-ops cleanly on Web / Expo Go', async () => {
    // In Node/Expo Go/Web without native RNGoogleMobileAdsModule linked, lazy loader returns null without throwing
    assert.strictEqual(getGoogleMobileAdsModule(), null);

    adService.setMobileAdsModuleForTesting(null);
    adService.setInterstitialAdsEnabledForTesting(true);
    await assert.doesNotReject(async () => {
      await initializeAdMob();
      await adService.initializeAdMob();
      adService.preloadRewardedAd();
      adService.preloadInterstitialAd();
    });

    assert.strictEqual(adService.isRewardedAdReady(), false);
    assert.strictEqual(adService.isInterstitialAdReady(), false);

    const rewardedRes = await adService.showRewardedAdForCoins('shop', 9_000_000);
    assert.strictEqual(rewardedRes.shown, false);
    assert.strictEqual(rewardedRes.rewarded, false);
    assert.strictEqual(rewardedRes.coinsAwarded, 0);
    assert.strictEqual(rewardedRes.reason, 'unavailable');

    await adService.recordCompletedMatch({ isOnlineRoom: true, isSeriesComplete: true, isWinner: true });
    const interRes = await adService.showPendingPostMatchInterstitialIfDue();
    assert.strictEqual(interRes.shown, false);
    assert.strictEqual(interRes.skippedReason, 'unavailable');
  });

  test('Post-match 2x Rewards ad is winners-only, doubles earned Coins & XP, uses fallback minimum on 0 coins, and enforces 5/day cap', async () => {
    const mock = createMockAdsModule();
    adService.setMobileAdsModuleForTesting(mock.mod);
    await adService.initialize();

    // 1. Visibility helper: strictly winners only (hidden on loss or tie)
    assert.strictEqual(
      shouldShowPostMatchDoubleRewardButton({ isWinner: true, winnerId: 'p1' }),
      true
    );
    assert.strictEqual(
      shouldShowPostMatchDoubleRewardButton({ isWinner: false, winnerId: 'bot1' }),
      false
    );
    assert.strictEqual(
      shouldShowPostMatchDoubleRewardButton({ isWinner: true, winnerId: 'p1', isTie: true }),
      false
    );
    assert.strictEqual(
      shouldShowPostMatchDoubleRewardButton({ isWinner: true, winnerId: null }),
      false
    );

    // 2. Loser or tie attempting showPostMatchDoubleRewardsAd is rejected with 0 ads shown and 0 rewards
    const beforeProfile = await playerProfileService.getProfile();
    const lossRes = await adService.showPostMatchDoubleRewardsAd({
      isWinner: false,
      baseCoins: 10,
      baseXp: 25,
      nowMs: 1_000_000,
    });
    assert.strictEqual(lossRes.shown, false);
    assert.strictEqual(lossRes.rewarded, false);
    assert.strictEqual(lossRes.coinsAwarded, 0);
    assert.strictEqual(lossRes.xpAwarded, 0);
    assert.strictEqual(lossRes.reason, 'not_winner');
    assert.strictEqual(mock.createdRewarded[0].showCalls, 0);

    const tieRes = await adService.showPostMatchDoubleRewardsAd({
      isWinner: true,
      isTie: true,
      baseCoins: 50,
      baseXp: 100,
      nowMs: 1_000_500,
    });
    assert.strictEqual(tieRes.shown, false);
    assert.strictEqual(tieRes.reason, 'not_winner');
    assert.strictEqual(mock.createdRewarded[0].showCalls, 0);

    // 3. Quick Match win (50 Coins, 100 XP) -> grants matching +50 Coins & +100 XP (triggering Level 2 + level-up bonuses!)
    assert.deepStrictEqual(computeDoubleMatchRewardBonus({ baseCoins: 50, baseXp: 100 }), {
      bonusCoins: 50,
      bonusXp: 100,
      usedFallbackMinimum: false,
    });

    const winRes = await adService.showPostMatchDoubleRewardsAd({
      isWinner: true,
      baseCoins: 50,
      baseXp: 100,
      nowMs: 2_000_000,
    });
    assert.strictEqual(winRes.shown, true);
    assert.strictEqual(winRes.rewarded, true);
    assert.strictEqual(winRes.coinsAwarded, 50);
    assert.strictEqual(winRes.xpAwarded, 100);
    assert.strictEqual(winRes.cooldownStatus.placement, 'post_match');
    assert.strictEqual(winRes.cooldownStatus.maxPerDay, MAX_POST_MATCH_REWARDED_ADS_PER_DAY);
    assert.strictEqual(
      winRes.cooldownStatus.remainingWatches,
      MAX_POST_MATCH_REWARDED_ADS_PER_DAY - 1
    );
    assert.match(winRes.message, /\+50 Coins & \+100 XP/);

    // Profile gained +50 Coins (plus +100 Coins & +5 Gems from leveling up at 100 XP!)
    const afterWinProfile = await playerProfileService.getProfile();
    assert.strictEqual(afterWinProfile.level, 2);
    assert.strictEqual(afterWinProfile.coins, beforeProfile.coins + 50 + 100);
    assert.strictEqual(afterWinProfile.gems, beforeProfile.gems + 5);

    // 4. Fallback minimum coins when a winning mode awarded 0 base coins (e.g. capped bot / pass_and_play)
    assert.deepStrictEqual(computeDoubleMatchRewardBonus({ baseCoins: 0, baseXp: 20 }), {
      bonusCoins: POST_MATCH_REWARDED_FALLBACK_MIN_COINS,
      bonusXp: 20,
      usedFallbackMinimum: true,
    });

    const fallbackWinRes = await adService.showPostMatchDoubleRewardsAd({
      isWinner: true,
      baseCoins: 0,
      baseXp: 20,
      nowMs: 2_010_000,
    });
    assert.strictEqual(fallbackWinRes.rewarded, true);
    assert.strictEqual(fallbackWinRes.coinsAwarded, POST_MATCH_REWARDED_FALLBACK_MIN_COINS);
    assert.strictEqual(fallbackWinRes.xpAwarded, 20);
    assert.strictEqual(
      fallbackWinRes.cooldownStatus.remainingWatches,
      MAX_POST_MATCH_REWARDED_ADS_PER_DAY - 2
    );

    // 5. Shop rewarded ad still grants flat +100 Coins independently
    const shopRes = await adService.showRewardedAdForCoins('shop', 2_020_000);
    assert.strictEqual(shopRes.rewarded, true);
    assert.strictEqual(shopRes.coinsAwarded, 100);
    assert.strictEqual(shopRes.xpAwarded, 0);
  });
});
