// src/services/networkService.ts - Cross-Platform Connectivity Detection & Offline Guards
import { errorToastService } from './errorToastService';

type AlertHandler = (title: string, message: string) => void;
let customAlertHandler: AlertHandler | null = null;

export function setNetworkAlertHandler(handler: AlertHandler): void {
  customAlertHandler = handler;
}

function triggerAlert(title: string, message: string): void {
  if (customAlertHandler) {
    customAlertHandler(title, message);
    return;
  }
  try {
    const pkg = 'react-native';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = typeof require !== 'undefined' ? require(pkg) : null;
    if (rn && rn.Alert && typeof rn.Alert.alert === 'function') {
      rn.Alert.alert(title, message, [{ text: 'Got It', style: 'default' }]);
    }
  } catch {
    // Safe fallback in test or headless environments
  }
}

class NetworkService {
  /**
   * Fast connectivity check using ping with a strict 2-second timeout.
   * Works reliably on Web, Android, iOS, and Expo Go without native dependencies.
   */
  public async isOnline(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      if (!navigator.onLine) {
        return false;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      }).catch(async () => {
        // Fallback ping to Cloudflare CDN trace
        return await fetch('https://1.1.1.1/cdn-cgi/trace', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Guards online-only actions. If offline, triggers the friendly cartoon toast
   * and alert message and returns false. If online, returns true.
   */
  public async ensureOnline(_actionContext: string = 'this feature'): Promise<boolean> {
    const online = await this.isOnline();
    if (!online) {
      const message = "You're disconnected! Please check your connection and try again.";
      errorToastService.showWarning(message, 5000);
      triggerAlert(
        'Offline Mode Active',
        `${message}\n\nYou can still enjoy "Play VS Bot" and "Pass & Play" offline anytime!`
      );
      return false;
    }
    return true;
  }
}

export const networkService = new NetworkService();
