// src/services/googleMobileAdsTypes.ts - Shared lightweight interfaces for lazy AdMob loading
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
