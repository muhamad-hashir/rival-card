// src/services/audioService.ts - Background Music & Action Sound Effects Engine for Rival Card
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

// ============================================================================
// Asset Loaders with Safe Fallback Protection
// ============================================================================

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
    return require('../../assets/sounds/game-sounds/rival_shout.mp3');
  } catch {
    try {
      return require('../../assets/sounds/game-sounds/rival-voice.mp3');
    } catch {
      return null;
    }
  }
}

function getColorChangeAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/color-change.mp3');
  } catch {
    return null;
  }
}

function getPlusFourAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/plus-four.mp3');
  } catch {
    return null;
  }
}

function getPlusTwoAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/plus-two.mp3');
  } catch {
    return null;
  }
}

function getSkipAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/skip.mp3');
  } catch {
    return null;
  }
}

function getReverseAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/reverse.mp3');
  } catch {
    return null;
  }
}

function getSwapAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/swap.mp3');
  } catch {
    return null;
  }
}

function getMuteAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/mute.mp3');
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

  public async ensureAudioMode(): Promise<void> {
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

  public async initAudio(): Promise<void> {
    await this.ensureAudioMode();
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

  // ============================================================================
  // Generic Safe SFX Helper with Lifecycle Unloading
  // ============================================================================

  private async playSfx(
    assetGetter: () => any,
    volume: number = 1.0,
    force: boolean = false
  ): Promise<void> {
    try {
      if (!force) {
        const settings = await settingsService.getSettings();
        if (!settings.sfxEnabled) return;
      }

      const asset = assetGetter();
      if (!asset || !ExpoAudio) return;

      await this.ensureAudioMode();

      const { sound } = await ExpoAudio.Sound.createAsync(
        asset,
        { shouldPlay: true, volume }
      );

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (err) {
      console.warn('Failed to play SFX:', err);
    }
  }

  // ============================================================================
  // Dedicated Action SFX Methods
  // ============================================================================

  /**
   * SFX: 1-second "RIVAL!" shout triggered when tapping the RIVAL! button.
   */
  public async playRivalShout(): Promise<void> {
    await this.playSfx(getRivalShoutAsset, 1.0);
  }

  /**
   * SFX: Played when choosing a color for a standard Wild card.
   */
  public async playColorChangeSfx(): Promise<void> {
    await this.playSfx(getColorChangeAsset, 1.0);
  }

  /**
   * SFX: Played when a Wild Draw 4 (+4) card is placed on the discard pile.
   */
  public async playPlusFourSfx(): Promise<void> {
    await this.playSfx(getPlusFourAsset, 1.0);
  }

  /**
   * SFX: Played when a Draw Two (+2) card is played.
   */
  public async playPlusTwoSfx(): Promise<void> {
    await this.playSfx(getPlusTwoAsset, 1.0);
  }

  /**
   * SFX: Played when a Skip card is played and a player's turn is skipped.
   */
  public async playSkipSfx(): Promise<void> {
    await this.playSfx(getSkipAsset, 1.0);
  }

  /**
   * SFX: Played when a Reverse card is played and turn direction changes.
   */
  public async playReverseSfx(): Promise<void> {
    await this.playSfx(getReverseAsset, 1.0);
  }

  /**
   * SFX: Played when cards or hands are swapped / passed.
   */
  public async playSwapSfx(): Promise<void> {
    await this.playSfx(getSwapAsset, 1.0);
  }

  /**
   * SFX: Played when toggling mute/audio settings or as an action modifier.
   * Accepts optional `force` flag to give audio confirmation when turning audio off.
   */
  public async playMuteSfx(force: boolean = false): Promise<void> {
    await this.playSfx(getMuteAsset, 1.0, force);
  }
}

export const audioService = new AudioService();
