import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEFAULT_ADMOB_ANDROID_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const DEFAULT_ADMOB_IOS_TEST_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidAppId =
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim() || DEFAULT_ADMOB_ANDROID_TEST_APP_ID;
  const iosAppId =
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() || DEFAULT_ADMOB_IOS_TEST_APP_ID;

  const existingPlugins = config.plugins ?? [];
  const updatedPlugins = existingPlugins.map((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    if (pluginName === 'react-native-google-mobile-ads') {
      return [
        'react-native-google-mobile-ads',
        {
          androidAppId,
          iosAppId,
        },
      ] as [string, Record<string, unknown>];
    }
    return plugin;
  });

  const hasAdMobPlugin = updatedPlugins.some((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName === 'react-native-google-mobile-ads';
  });

  if (!hasAdMobPlugin) {
    updatedPlugins.push([
      'react-native-google-mobile-ads',
      {
        androidAppId,
        iosAppId,
      },
    ]);
  }

  return {
    ...config,
    name: config.name ?? 'Rival Card',
    slug: config.slug ?? 'rival-card',
    android: {
      ...config.android,
      blockedPermissions: Array.from(
        new Set([
          ...(config.android?.blockedPermissions ?? []),
          'android.permission.FOREGROUND_SERVICE',
          'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        ])
      ),
    },
    plugins: updatedPlugins,
    extra: {
      ...config.extra,
      EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: androidAppId,
      ...(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID
        ? { EXPO_PUBLIC_ADMOB_REWARDED_ID: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID.trim() }
        : {}),
      ...(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID
        ? {
            EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID:
              process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID.trim(),
          }
        : {}),
    },
  };
};
