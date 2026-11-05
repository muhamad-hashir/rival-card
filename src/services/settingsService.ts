// src/services/settingsService.ts - User Settings & Preferences Service for Rival Card
import AsyncStorage from '@react-native-async-storage/async-storage';
import { soundService } from './soundService';
import { hapticsService } from './hapticsService';

export interface UserSettings {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  hapticsEnabled: boolean;
  fastBots: boolean;
  autoPass: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  sfxEnabled: true,
  bgmEnabled: true,
  hapticsEnabled: true,
  fastBots: false,
  autoPass: true,
};

export const SETTINGS_STORAGE_KEY = '@rivalcard:settings';

const memoryStore: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
    const val = await AsyncStorage.getItem(key);
    if (val !== null) return val;
    return memoryStore[key] || null;
  } catch {
    return memoryStore[key] || null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

async function storageRemove(key: string): Promise<void> {
  delete memoryStore[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type SettingsSubscriber = (settings: UserSettings) => void;

class SettingsService {
  private cachedSettings: UserSettings | null = null;
  private subscribers: Set<SettingsSubscriber> = new Set();

  /**
   * Retrieves user settings, falling back to defaults.
   */
  public async getSettings(forceReload = false): Promise<UserSettings> {
    if (this.cachedSettings && !forceReload) {
      return this.cachedSettings;
    }

    try {
      const raw = await storageGet(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const fullSettings: UserSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
        this.cachedSettings = fullSettings;
        this.syncServices(fullSettings);
        return fullSettings;
      }
    } catch (err) {
      console.warn('Failed to parse settings from storage:', err);
    }

    this.cachedSettings = { ...DEFAULT_SETTINGS };
    await storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(this.cachedSettings));
    this.syncServices(this.cachedSettings);
    return this.cachedSettings;
  }

  /**
   * Updates a single setting key and persists it.
   */
  public async updateSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated: UserSettings = {
      ...current,
      [key]: value,
    };

    this.cachedSettings = updated;
    await storageSet(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    this.syncServices(updated);
    this.notify();
    return updated;
  }

  /**
   * Syncs external audio and haptics services with settings values.
   */
  private syncServices(settings: UserSettings): void {
    soundService.setMuted(!settings.sfxEnabled);
    hapticsService.setEnabled(settings.hapticsEnabled);
  }

  /**
   * Subscribes to settings updates.
   */
  public subscribe(listener: SettingsSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    if (!this.cachedSettings) return;
    for (const listener of this.subscribers) {
      try {
        listener(this.cachedSettings);
      } catch (err) {
        console.warn('Settings subscriber error:', err);
      }
    }
  }

  /**
   * Resets all settings to default values.
   */
  public async resetSettings(): Promise<UserSettings> {
    await storageRemove(SETTINGS_STORAGE_KEY);
    this.cachedSettings = { ...DEFAULT_SETTINGS };
    this.syncServices(this.cachedSettings);
    this.notify();
    return this.cachedSettings;
  }
}

export const settingsService = new SettingsService();
