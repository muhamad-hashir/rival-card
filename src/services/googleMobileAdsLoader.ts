// src/services/googleMobileAdsLoader.ts - Lazy safe loader for react-native-google-mobile-ads (Native only; null on Web & Expo Go)
import type { MobileAdsModuleLike } from './googleMobileAdsTypes';

function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    return rn?.Platform?.OS ?? 'node';
  } catch {
    return 'node';
  }
}

/**
 * Returns true when running inside the Expo Go client where custom native AdMob
 * binaries are not linked.
 */
export function isExpoGoRuntime(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants')?.default ?? require('expo-constants');
    return (
      Constants?.executionEnvironment === 'storeClient' ||
      Constants?.appOwnership === 'expo'
    );
  } catch {
    return false;
  }
}

/**
 * Lazily requires `react-native-google-mobile-ads` at call time only when running
 * on a native build with the native AdMob module linked. Returns `null` on Web,
 * in Expo Go, or whenever the native module is unavailable.
 */
export function getGoogleMobileAdsModule(): MobileAdsModuleLike | null {
  if (getPlatformOS() === 'web' || isExpoGoRuntime()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    const hasTurbo =
      typeof rn?.TurboModuleRegistry?.get === 'function'
        ? Boolean(rn.TurboModuleRegistry.get('RNGoogleMobileAdsModule'))
        : undefined;
    const hasLegacy =
      rn?.NativeModules && typeof rn.NativeModules === 'object'
        ? Boolean(rn.NativeModules.RNGoogleMobileAdsModule)
        : undefined;

    if (hasTurbo === false && hasLegacy === false) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-google-mobile-ads');
    if (mod && mod.RewardedAd && mod.InterstitialAd) {
      return mod as MobileAdsModuleLike;
    }
    return null;
  } catch {
    return null;
  }
}
