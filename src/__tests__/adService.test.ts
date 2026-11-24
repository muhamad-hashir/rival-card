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
  formatCooldownRemaining,
  INTERSTITIAL_MATCH_INTERVAL,
  MAX_REWARDED_ADS_PER_DAY,
  MAX_TOTAL_REWARDED_ADS_PER_DAY,
  REWARDED_AD_COIN_PAYOUT,
  REWARDED_COOLDOWN_WINDOW_MS,
  resolveAdUnitId,
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

  test('initialize() preloads ads silently without showing any ad on first launch', async () => {
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

  test('Split daily quotas allow 5 Shop + 5 Post-Match rewarded ads (10/day = 1,000 coins/day) independently and unlock after 24h', async () => {
    assert.strictEqual(MAX_REWARDED_ADS_PER_DAY, 5);
    assert.strictEqual(MAX_TOTAL_REWARDED_ADS_PER_DAY, 10);
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
    for (let i = 0; i < MAX_REWARDED_ADS_PER_DAY; i++) {
      const res = await adService.showRewardedAdForCoins('shop', baseTime + i * 1000);
      assert.strictEqual(res.rewarded, true, `Shop rewarded ad #${i + 1} should succeed`);
      assert.strictEqual(res.coinsAwarded, 100);
      assert.strictEqual(res.cooldownStatus.placement, 'shop');
    }

    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 500);

    // 6th Shop attempt within 24h is blocked
    const blockedShopRes = await adService.showRewardedAdForCoins('shop', baseTime + 2 * 60 * 60 * 1000);
    assert.strictEqual(blockedShopRes.shown, false);
    assert.strictEqual(blockedShopRes.rewarded, false);
    assert.strictEqual(blockedShopRes.coinsAwarded, 0);
    assert.strictEqual(blockedShopRes.reason, 'cooldown');
    assert.match(blockedShopRes.message, /Shop daily limit reached \(5\/5\)/);
    assert.strictEqual(blockedShopRes.cooldownStatus.remainingWatches, 0);

    // 2. Post-Match bucket is completely independent -> still has all 5 watches (another 500 coins = 1,000 total)
    const postStatusBefore = await adService.getRewardedAdCooldownStatus('post_match', baseTime + 10_000);
    assert.strictEqual(postStatusBefore.canWatch, true);
    assert.strictEqual(postStatusBefore.remainingWatches, 5);

    for (let i = 0; i < MAX_REWARDED_ADS_PER_DAY; i++) {
      const res = await adService.showRewardedAdForCoins('post_match', baseTime + 20_000 + i * 1000);
      assert.strictEqual(res.rewarded, true, `Post-match rewarded ad #${i + 1} should succeed`);
      assert.strictEqual(res.coinsAwarded, 100);
      assert.strictEqual(res.cooldownStatus.placement, 'post_match');
    }

    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 1000);

    // 6th Post-Match attempt within 24h is blocked
    const blockedPostRes = await adService.showRewardedAdForCoins(
      'post_match',
      baseTime + 2 * 60 * 60 * 1000
    );
    assert.strictEqual(blockedPostRes.shown, false);
    assert.strictEqual(blockedPostRes.reason, 'cooldown');
    assert.match(blockedPostRes.message, /Post-match daily limit reached \(5\/5\)/);

    // After 24 hours + 1ms from first watch, Shop quota opens back up
    const unlockedRes = await adService.showRewardedAdForCoins(
      'shop',
      baseTime + REWARDED_COOLDOWN_WINDOW_MS + 1
    );
    assert.strictEqual(unlockedRes.rewarded, true);
    assert.strictEqual(unlockedRes.coinsAwarded, 100);
    assert.strictEqual((await playerProfileService.getProfile()).coins, startCoins + 1100);
  });

  test('Smart Post-Match Interstitial shows strictly after every 3rd completed non-tutorial match', async () => {
    assert.strictEqual(INTERSTITIAL_MATCH_INTERVAL, 3);

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
});
