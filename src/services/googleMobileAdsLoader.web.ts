// src/services/googleMobileAdsLoader.web.ts - Web-safe AdMob loader (never imports native module in Web bundles)
import type { MobileAdsModuleLike } from './googleMobileAdsTypes';

export function isExpoGoRuntime(): boolean {
  return false;
}

export function getGoogleMobileAdsModule(): MobileAdsModuleLike | null {
  return null;
}
