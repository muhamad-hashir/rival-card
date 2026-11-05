// src/services/audioService.ts - Background Music & Speech/SFX Engine for Rival Card
import { settingsService, UserSettings } from './settingsService';

let ExpoAudio: typeof import('expo-av').Audio | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAv = require('expo-av');
  if (expoAv && expoAv.Audio) {
    ExpoAudio = expoAv.Audio;
  }
} catch {
  ExpoAudio = null;
}

export type BgmTrackType = 'none' | 'menu' | 'gameplay';

function getMenuBgmAsset(): any {
  try {
    return require('../../assets/sounds/background.mp3');
  } catch {
    return null;
  }
}

function getGameplayBgmAsset(): any {
  try {
    return require('../../assets/sounds/match-background.mp3');
  } catch {
    return null;
  }
}

function getRivalShoutAsset(): any {
  try {
    return require('../../assets/sounds/rival-voice.mp3');
  } catch {
    return null;
  }
}

export class AudioService {
  private currentBgmType: BgmTrackType = 'none';
  private currentBgmSound: any | null = null;
  private audioModeConfigured: boolean = false;
  private isBgmLoading: boolean = false;

  constructor() {
    this.initSettingsSubscription();
  }

  private initSettingsSubscription(): void {
    try {
      settingsService.subscribe((settings: UserSettings) => {
        this.handleSettingsChange(settings);
      });
    } catch {
      // Ignore in test environments
    }
  }

  private async ensureAudioMode(): Promise<void> {
    if (this.audioModeConfigured) return;
    try {
      if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
      this.audioModeConfigured = true;
    } catch {
      // Ignore if not supported in environment
    }
  }

  public getCurrentBgmType(): BgmTrackType {
    return this.currentBgmType;
  }

  /**
   * Background Music: Menu Loop (plays across HomeScreen, Modals)
   * Loops seamlessly at volume ~0.35.
   */
  public async playMenuBgm(): Promise<void> {
    try {
      if (this.currentBgmType === 'menu' && this.currentBgmSound) {
        const settings = await settingsService.getSettings();
        if (settings.bgmEnabled) {
          const status = await this.currentBgmSound.getStatusAsync().catch(() => null);
          if (status && status.isLoaded && !status.isPlaying) {
            await this.currentBgmSound.playAsync().catch(() => {});
          }
        }
        return;
      }

      this.currentBgmType = 'menu';
      const settings = await settingsService.getSettings();

      await this.stopBgmSoundOnly();

      const asset = getMenuBgmAsset();
      if (!asset || !ExpoAudio) return;

      await this.ensureAudioMode();
      this.isBgmLoading = true;

      const { sound } = await ExpoAudio.Sound.createAsync(
        asset,
        {
          isLooping: true,
          volume: 0.35,
          shouldPlay: settings.bgmEnabled,
        }
      );

      // If user switched track while loading, unload
      if (this.currentBgmType !== 'menu') {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      this.currentBgmSound = sound;
    } catch (err) {
      console.warn('Failed to play menu BGM:', err);
    } finally {
      this.isBgmLoading = false;
    }
  }

  /**
   * Background Music: Match Loop (plays during active match on GameScreen)
   * Loops comfortably at volume ~0.30.
   */
  public async playGameplayBgm(): Promise<void> {
    try {
      if (this.currentBgmType === 'gameplay' && this.currentBgmSound) {
        const settings = await settingsService.getSettings();
        if (settings.bgmEnabled) {
          const status = await this.currentBgmSound.getStatusAsync().catch(() => null);
          if (status && status.isLoaded && !status.isPlaying) {
            await this.currentBgmSound.playAsync().catch(() => {});
          }
        }
        return;
      }

      this.currentBgmType = 'gameplay';
      const settings = await settingsService.getSettings();

      await this.stopBgmSoundOnly();

      const asset = getGameplayBgmAsset();
      if (!asset || !ExpoAudio) return;

      await this.ensureAudioMode();
      this.isBgmLoading = true;

      const { sound } = await ExpoAudio.Sound.createAsync(
        asset,
        {
          isLooping: true,
          volume: 0.30,
          shouldPlay: settings.bgmEnabled,
        }
      );

      // If user switched track while loading, unload
      if (this.currentBgmType !== 'gameplay') {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      this.currentBgmSound = sound;
    } catch (err) {
      console.warn('Failed to play gameplay BGM:', err);
    } finally {
      this.isBgmLoading = false;
    }
  }

  /**
   * Unloads current BGM track cleanly on unmounts.
   */
  public async stopBgm(): Promise<void> {
    this.currentBgmType = 'none';
    await this.stopBgmSoundOnly();
  }

  private async stopBgmSoundOnly(): Promise<void> {
    if (this.currentBgmSound) {
      const sound = this.currentBgmSound;
      this.currentBgmSound = null;
      try {
        await sound.stopAsync();
      } catch {}
      try {
        await sound.unloadAsync();
      } catch {}
    }
  }

  /**
   * Pauses the active BGM track immediately (e.g. when BGM toggled off in settings).
   */
  public async pauseBgm(): Promise<void> {
    try {
      if (this.currentBgmSound) {
        await this.currentBgmSound.pauseAsync();
      }
    } catch (err) {
      console.warn('Failed to pause BGM:', err);
    }
  }

  /**
   * Resumes the active BGM track immediately (e.g. when BGM toggled on in settings).
   */
  public async resumeBgm(): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      if (!settings.bgmEnabled) return;

      if (this.currentBgmSound) {
        await this.currentBgmSound.playAsync();
      } else if (this.currentBgmType === 'menu') {
        await this.playMenuBgm();
      } else if (this.currentBgmType === 'gameplay') {
        await this.playGameplayBgm();
      }
    } catch (err) {
      console.warn('Failed to resume BGM:', err);
    }
  }

  /**
   * Reacts to settings changes (pausing or resuming active track).
   */
  public async handleSettingsChange(settings: UserSettings): Promise<void> {
    try {
      if (!settings.bgmEnabled) {
        await this.pauseBgm();
      } else {
        await this.resumeBgm();
      }
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * SFX: 1-second "RIVAL!" shout triggered when tapping the RIVAL! button.
   * Checks sfxEnabled, plays instantly, and unloads on finish to prevent memory leaks.
   */
  public async playRivalShout(): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      if (!settings.sfxEnabled) return;

      const asset = getRivalShoutAsset();
      if (!asset || !ExpoAudio) return;

      await this.ensureAudioMode();

      const { sound } = await ExpoAudio.Sound.createAsync(
        asset,
        { shouldPlay: true, volume: 1.0 }
      );

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (err) {
      console.warn('Failed to play rival shout:', err);
    }
  }
}

export const audioService = new AudioService();
