// src/services/audioService.ts - Background Music & Action Sound Effects Engine for Rival Card
import { settingsService, UserSettings } from './settingsService';
import { soundService } from './soundService';

let ExpoAudio: any = null;
let AudioModule: any = null;
let createAudioPlayer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoAudio = require('expo-audio');
  if (expoAudio) {
    ExpoAudio = expoAudio;
    AudioModule = expoAudio.AudioModule;
    createAudioPlayer = expoAudio.createAudioPlayer;
  }
} catch {
  ExpoAudio = null;
  AudioModule = null;
  createAudioPlayer = null;
}

export type BgmTrackType = 'none' | 'menu' | 'gameplay';

// ============================================================================
// Asset Loaders with Safe Fallback Protection
// ============================================================================

function safeWarn(message: string, err?: any): void {
  if (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' ||
      process.env?.npm_lifecycle_event?.includes('test') ||
      process.argv?.some((a) => a.includes('test')))
  ) {
    return;
  }
  console.warn(message, err);
}

function getMenuBgmAsset(): any {
  try {
    return require('../../assets/sounds/background.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load menu BGM asset (background.mp3):', err);
    return null;
  }
}

function getGameplayBgmAsset(): any {
  try {
    return require('../../assets/sounds/match-background.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load gameplay BGM asset (match-background.mp3):', err);
    return null;
  }
}

function getRivalShoutAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/rival_shout.mp3');
  } catch {
    try {
      return require('../../assets/sounds/game-sounds/rival-voice.mp3');
    } catch (err) {
      safeWarn('[AudioService] Failed to load rival shout/voice asset:', err);
      return null;
    }
  }
}

function getColorChangeAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/color-change.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load color change asset:', err);
    return null;
  }
}

function getPlusFourAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/plus-four.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load plus four asset:', err);
    return null;
  }
}

function getPlusTwoAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/plus-two.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load plus two asset:', err);
    return null;
  }
}

function getSkipAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/skip.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load skip asset:', err);
    return null;
  }
}

function getReverseAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/reverse.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load reverse asset:', err);
    return null;
  }
}

function getSwapAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/swap.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load swap asset:', err);
    return null;
  }
}

function getMuteAsset(): any {
  try {
    return require('../../assets/sounds/game-sounds/mute.mp3');
  } catch (err) {
    safeWarn('[AudioService] Failed to load mute asset:', err);
    return null;
  }
}

export class AudioService {
  private currentBgmType: BgmTrackType = 'none';
  private currentBgmPlayer: any | null = null;
  private sfxPlayers: Map<string, any> = new Map();
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

  private audioModePromise: Promise<void> | null = null;

  public async ensureAudioMode(): Promise<void> {
    if (this.audioModeConfigured) return;
    if (this.audioModePromise) {
      await this.audioModePromise;
      return;
    }
    this.audioModePromise = (async () => {
      try {
        const modeConfig = {
          playsInSilentMode: true,
          shouldDuckAndroid: true,
          interruptionMode: 'duckOthers',
        };
        if (AudioModule && typeof AudioModule.setAudioModeAsync === 'function') {
          await AudioModule.setAudioModeAsync(modeConfig);
        } else if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
          await ExpoAudio.setAudioModeAsync(modeConfig);
        }
        this.audioModeConfigured = true;
      } catch (err) {
        safeWarn('[AudioService] Failed to configure audio mode:', err);
      } finally {
        this.audioModePromise = null;
      }
    })();
    await this.audioModePromise;
  }

  private safeCreatePlayer(source: any): any | null {
    try {
      if (createAudioPlayer && typeof createAudioPlayer === 'function') {
        return createAudioPlayer(source);
      }
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        return ExpoAudio.createAudioPlayer(source);
      }
      return null;
    } catch (err) {
      safeWarn('[AudioService] Failed to create AudioPlayer safely:', err);
      return null;
    }
  }

  public async initAudio(): Promise<void> {
    await this.ensureAudioMode();
    await this.preloadSfx();
    try {
      await soundService.preloadSounds();
    } catch {}
  }

  /**
   * Preloads dedicated player instances for action sound effects on startup.
   */
  public async preloadSfx(): Promise<void> {
    if (!createAudioPlayer && (!ExpoAudio || typeof ExpoAudio.createAudioPlayer !== 'function')) return;
    try {
      await this.ensureAudioMode();
      const sfxAssets: Array<[string, () => any]> = [
        ['rival_shout', getRivalShoutAsset],
        ['color_change', getColorChangeAsset],
        ['plus_four', getPlusFourAsset],
        ['plus_two', getPlusTwoAsset],
        ['skip', getSkipAsset],
        ['reverse', getReverseAsset],
        ['swap', getSwapAsset],
        ['mute', getMuteAsset],
      ];

      for (const [key, getter] of sfxAssets) {
        if (this.sfxPlayers.has(key)) continue;
        try {
          const asset = getter();
          if (!asset) continue;
          const player = this.safeCreatePlayer(asset);
          if (player) {
            player.volume = 1.0;
            this.sfxPlayers.set(key, player);
          }
        } catch {
          // Gracefully continue
        }
      }
    } catch {
      // Gracefully continue
    }
  }

  public getCurrentBgmType(): BgmTrackType {
    return this.currentBgmType;
  }

  /**
   * Background Music: Menu Loop (plays across HomeScreen, Modals)
   * Loops seamlessly at volume 1.0.
   */
  public async playMenuBgm(): Promise<void> {
    try {
      if (this.currentBgmType === 'menu' && this.currentBgmPlayer) {
        const settings = await settingsService.getSettings();
        if (settings.bgmEnabled) {
          try {
            this.currentBgmPlayer.loop = true;
            this.currentBgmPlayer.volume = 1.0;
            this.currentBgmPlayer.play();
          } catch {}
        }
        return;
      }

      this.currentBgmType = 'menu';
      const settings = await settingsService.getSettings();

      await this.stopBgmSoundOnly();

      const asset = getMenuBgmAsset();
      if (!asset) {
        safeWarn('[AudioService] Cannot play menu BGM: asset unavailable');
        return;
      }

      await this.ensureAudioMode();
      this.isBgmLoading = true;

      const player = this.safeCreatePlayer(asset);
      if (!player) {
        safeWarn('[AudioService] Cannot play menu BGM: AudioPlayer creation failed');
        return;
      }

      try {
        player.loop = true;
        player.volume = 1.0;
      } catch {}

      // If user switched track while loading, release
      if (this.currentBgmType !== 'menu') {
        try {
          player.remove();
        } catch {}
        return;
      }

      this.currentBgmPlayer = player;
      if (settings.bgmEnabled) {
        try {
          player.play();
        } catch (playErr) {
          safeWarn('[AudioService] Error calling player.play() for menu BGM:', playErr);
        }
      }
    } catch (err) {
      safeWarn('[AudioService] Failed to play menu BGM:', err);
    } finally {
      this.isBgmLoading = false;
    }
  }

  /**
   * Background Music: Match Loop (plays during active match on GameScreen)
   * Loops comfortably at volume 1.0.
   */
  public async playGameplayBgm(): Promise<void> {
    try {
      if (this.currentBgmType === 'gameplay' && this.currentBgmPlayer) {
        const settings = await settingsService.getSettings();
        if (settings.bgmEnabled) {
          try {
            this.currentBgmPlayer.loop = true;
            this.currentBgmPlayer.volume = 1.0;
            this.currentBgmPlayer.play();
          } catch {}
        }
        return;
      }

      this.currentBgmType = 'gameplay';
      const settings = await settingsService.getSettings();

      await this.stopBgmSoundOnly();

      const asset = getGameplayBgmAsset();
      if (!asset) {
        safeWarn('[AudioService] Cannot play gameplay BGM: asset unavailable');
        return;
      }

      await this.ensureAudioMode();
      this.isBgmLoading = true;

      const player = this.safeCreatePlayer(asset);
      if (!player) {
        safeWarn('[AudioService] Cannot play gameplay BGM: AudioPlayer creation failed');
        return;
      }

      try {
        player.loop = true;
        player.volume = 1.0;
      } catch {}

      // If user switched track while loading, release
      if (this.currentBgmType !== 'gameplay') {
        try {
          player.remove();
        } catch {}
        return;
      }

      this.currentBgmPlayer = player;
      if (settings.bgmEnabled) {
        try {
          player.play();
        } catch (playErr) {
          safeWarn('[AudioService] Error calling player.play() for gameplay BGM:', playErr);
        }
      }
    } catch (err) {
      safeWarn('[AudioService] Failed to play gameplay BGM:', err);
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
    if (this.currentBgmPlayer) {
      const player = this.currentBgmPlayer;
      this.currentBgmPlayer = null;
      try {
        player.pause();
      } catch {}
      try {
        player.remove();
      } catch {}
    }
  }

  /**
   * Pauses the active BGM track immediately (e.g. when BGM toggled off in settings).
   */
  public async pauseBgm(): Promise<void> {
    try {
      if (this.currentBgmPlayer) {
        try {
          this.currentBgmPlayer.pause();
        } catch {}
        try {
          this.currentBgmPlayer.volume = 0.0;
        } catch {}
      }
    } catch (err) {
      safeWarn('[AudioService] Failed to pause BGM:', err);
    }
  }

  /**
   * Resumes the active BGM track immediately (e.g. when BGM toggled on in settings).
   */
  public async resumeBgm(): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      if (!settings.bgmEnabled) return;

      if (this.currentBgmPlayer) {
        try {
          this.currentBgmPlayer.loop = true;
          this.currentBgmPlayer.volume = 1.0;
          this.currentBgmPlayer.play();
        } catch {}
      } else if (this.currentBgmType === 'menu') {
        await this.playMenuBgm();
      } else if (this.currentBgmType === 'gameplay') {
        await this.playGameplayBgm();
      }
    } catch (err) {
      safeWarn('[AudioService] Failed to resume BGM:', err);
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
  // Reusable Dedicated SFX Player Engine with Seek Rewind
  // ============================================================================

  private async playSfx(
    key: string,
    assetGetter: () => any,
    volume: number = 1.0,
    force: boolean = false
  ): Promise<void> {
    try {
      if (!force) {
        const settings = await settingsService.getSettings();
        if (!settings.sfxEnabled) return;
        if (soundService.getMuted()) return;
      }

      await this.ensureAudioMode();

      let player = this.sfxPlayers.get(key);
      if (!player) {
        const asset = assetGetter();
        if (!asset) {
          safeWarn('[AudioService] SFX asset unavailable or missing for ' + key);
          return;
        }
        player = this.safeCreatePlayer(asset);
        if (player) {
          this.sfxPlayers.set(key, player);
        }
      }

      if (!player) return;

      // Reuse pattern: rewind to 0s and play
      try {
        player.volume = volume;
        if (typeof player.seekTo === 'function') {
          try {
            await player.seekTo(0);
          } catch {}
        }
        player.play();
      } catch (playErr) {
        safeWarn('[AudioService] Error calling player.play() for SFX ' + key + ':', playErr);
      }
    } catch (err) {
      safeWarn('[AudioService] Failed to play SFX ' + key + ':', err);
    }
  }

  // ============================================================================
  // Dedicated Action SFX Methods
  // ============================================================================

  /**
   * SFX: 1-second "RIVAL!" shout triggered when tapping the RIVAL! button.
   */
  public async playRivalShout(): Promise<void> {
    await this.playSfx('rival_shout', getRivalShoutAsset, 1.0);
  }

  /**
   * SFX: Played when choosing a color for a standard Wild card.
   */
  public async playColorChangeSfx(): Promise<void> {
    await this.playSfx('color_change', getColorChangeAsset, 1.0);
  }

  /**
   * SFX: Played when a Wild Draw 4 (+4) card is placed on the discard pile.
   */
  public async playPlusFourSfx(): Promise<void> {
    await this.playSfx('plus_four', getPlusFourAsset, 1.0);
  }

  /**
   * SFX: Played when a Draw Two (+2) card is played.
   */
  public async playPlusTwoSfx(): Promise<void> {
    await this.playSfx('plus_two', getPlusTwoAsset, 1.0);
  }

  /**
   * SFX: Played when a Skip card is played and a player's turn is skipped.
   */
  public async playSkipSfx(): Promise<void> {
    await this.playSfx('skip', getSkipAsset, 1.0);
  }

  /**
   * SFX: Played when a Reverse card is played and turn direction changes.
   */
  public async playReverseSfx(): Promise<void> {
    await this.playSfx('reverse', getReverseAsset, 1.0);
  }

  /**
   * SFX: Played when cards or hands are swapped / passed.
   */
  public async playSwapSfx(): Promise<void> {
    await this.playSfx('swap', getSwapAsset, 1.0);
  }

  /**
   * SFX: Played when toggling mute/audio settings or as an action modifier.
   * Accepts optional `force` flag to give audio confirmation when turning audio off.
   */
  public async playMuteSfx(force: boolean = false): Promise<void> {
    await this.playSfx('mute', getMuteAsset, 1.0, force);
  }

  /**
   * Common SFX Convenience Methods (card play, draw, clicks, win chime)
   */
  public async playCardDraw(): Promise<void> {
    try {
      await soundService.playCardDraw();
    } catch {}
  }

  public async playCardPlay(): Promise<void> {
    try {
      await soundService.playCardSnap();
    } catch {}
  }

  public async playButtonClick(): Promise<void> {
    try {
      await soundService.playCardSnap();
    } catch {}
  }

  public async playTurnAlert(): Promise<void> {
    try {
      await soundService.playRivalCallout();
    } catch {}
  }

  public async playWinChime(): Promise<void> {
    try {
      await soundService.playWinChime();
    } catch {}
  }
}

export const audioService = new AudioService();
