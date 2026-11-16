import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Forces Android immersive hidden navigation bar directly via ExpoNavigationBar,
 * bypassing the JS `NavigationBar.setHidden` memoization cache that can go stale
 * after SplashScreen dismissal, orientation switches, modals, or OEM resets (e.g. Huawei EMUI).
 */
export async function applyImmersiveNavigationBar(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    if (typeof NavigationBar.setStyle === 'function') {
      NavigationBar.setStyle('light');
    }
    if (typeof NavigationBar.setVisibilityAsync === 'function') {
      await NavigationBar.setVisibilityAsync('hidden');
    } else if (typeof NavigationBar.NavigationBar?.setHidden === 'function') {
      NavigationBar.NavigationBar.setHidden(true);
    }
  } catch (err) {
    console.warn('[Immersive] NavigationBar configuration warning:', err);
  }
}

/**
 * Applies immersive navigation bar immediately and retries after short delays
 * to survive Android activity/orientation/dialog window-focus transitions.
 * Returns a cleanup function that cancels pending timers.
 */
export function scheduleImmersiveNavigationBar(delays: readonly number[] = [0, 180, 650]): () => void {
  if (Platform.OS !== 'android') return () => {};

  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const delay of delays) {
    if (delay <= 0) {
      applyImmersiveNavigationBar();
    } else {
      timers.push(setTimeout(applyImmersiveNavigationBar, delay));
    }
  }

  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}
