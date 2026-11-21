// src/__tests__/audioService.test.ts - Unit tests for Audio & Music Engine (BGM and SFX)
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioService,
  BASE_GAMEPLAY_BGM_VOLUME,
  ESCALATED_BGM_PLAYBACK_RATE,
  ESCALATED_GAMEPLAY_BGM_VOLUME,
  NORMAL_BGM_PLAYBACK_RATE,
  shouldEscalateGameplayBgm,
} from '../services/audioService';
import { settingsService } from '../services/settingsService';

describe('Audio & Music Engine (BGM & SFX)', () => {
  beforeEach(async () => {
    await settingsService.resetSettings();
    await audioService.stopBgm();
  });

  test('audioService initializes with none track type', () => {
    assert.strictEqual(audioService.getCurrentBgmType(), 'none');
  });

  test('playMenuBgm transitions currentBgmType to menu', async () => {
    await audioService.playMenuBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'menu');
  });

  test('playGameplayBgm transitions currentBgmType to gameplay', async () => {
    await audioService.playGameplayBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'gameplay');
  });

  test('stopBgm transitions currentBgmType back to none', async () => {
    await audioService.playMenuBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'menu');

    await audioService.stopBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'none');
  });

  test('playRivalShout executes safely when sfxEnabled is true or false', async () => {
    // 1. With sfxEnabled: true (default)
    await assert.doesNotReject(async () => {
      await audioService.playRivalShout();
    });

    // 2. With sfxEnabled: false
    await settingsService.updateSetting('sfxEnabled', false);
    await assert.doesNotReject(async () => {
      await audioService.playRivalShout();
    });
  });

  test('action SFX methods execute safely when sfxEnabled is true or false', async () => {
    const sfxMethods = [
      () => audioService.playColorChangeSfx(),
      () => audioService.playPlusFourSfx(),
      () => audioService.playPlusTwoSfx(),
      () => audioService.playSkipSfx(),
      () => audioService.playReverseSfx(),
      () => audioService.playSwapSfx(),
      () => audioService.playMuteSfx(),
      () => audioService.playMuteSfx(true),
      () => audioService.playShieldBlockSfx(),
      () => audioService.playMirrorReflectSfx(),
    ];

    // 1. When sfxEnabled is true
    for (const sfx of sfxMethods) {
      await assert.doesNotReject(async () => {
        await sfx();
      });
    }

    // 2. When sfxEnabled is false
    await settingsService.updateSetting('sfxEnabled', false);
    for (const sfx of sfxMethods) {
      await assert.doesNotReject(async () => {
        await sfx();
      });
    }
  });

  test('handleSettingsChange reacts to bgmEnabled toggle', async () => {
    await audioService.playMenuBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'menu');

    // Toggle BGM off
    await assert.doesNotReject(async () => {
      await audioService.handleSettingsChange({
        sfxEnabled: true,
        bgmEnabled: false,
        hapticsEnabled: true,
        fastBots: false,
        autoPass: true,
      });
    });

    // Toggle BGM back on
    await assert.doesNotReject(async () => {
      await audioService.handleSettingsChange({
        sfxEnabled: true,
        bgmEnabled: true,
        hapticsEnabled: true,
        fastBots: false,
        autoPass: true,
      });
    });
  });

  test('seamless transition between Menu BGM and Gameplay BGM', async () => {
    // 1. Enter HomeScreen
    await audioService.playMenuBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'menu');

    // 2. Start Game match
    await audioService.playGameplayBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'gameplay');

    // 3. Return Home
    await audioService.playMenuBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'menu');

    // 4. Leave/unmount
    await audioService.stopBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'none');
  });

  test('concurrent menu-to-gameplay BGM calls converge cleanly on gameplay track', async () => {
    await Promise.all([
      audioService.playMenuBgm(),
      audioService.playGameplayBgm(),
    ]);
    assert.strictEqual(audioService.getCurrentBgmType(), 'gameplay');

    await assert.doesNotReject(async () => {
      await audioService.ensureAudioMode(true);
      await audioService.pauseBgm();
      await audioService.resumeBgm();
    });

    await audioService.stopBgm();
    assert.strictEqual(audioService.getCurrentBgmType(), 'none');
  });

  test('shouldEscalateGameplayBgm triggers strictly for active matches in final 20 seconds', () => {
    assert.strictEqual(shouldEscalateGameplayBgm(180, true), false);
    assert.strictEqual(shouldEscalateGameplayBgm(21, true), false);
    assert.strictEqual(shouldEscalateGameplayBgm(20, true), true);
    assert.strictEqual(shouldEscalateGameplayBgm(1, true), true);
    assert.strictEqual(shouldEscalateGameplayBgm(0, true), false);
    assert.strictEqual(shouldEscalateGameplayBgm(-1, true), false);
    assert.strictEqual(shouldEscalateGameplayBgm(15, false), false);
  });

  test('final 20 seconds escalation ramps playbackRate cleanly once and resets on match end or rematch', () => {
    const rateCalls: Array<{ rate: number; quality?: string }> = [];
    const mockPlayer = {
      loop: false,
      muted: false,
      volume: 1.0,
      playbackRate: 1.0,
      shouldCorrectPitch: false,
      setPlaybackRate(rate: number, quality?: string) {
        this.playbackRate = rate;
        rateCalls.push({ rate, quality });
      },
      play() {},
      pause() {},
      remove() {},
    };

    audioService.setActiveBgmPlayerForTesting(mockPlayer, 'gameplay');

    // Above 20s stays at normal 1.0x rate and base volume
    audioService.updateGameplayBgmIntensity(45, true, { immediate: true });
    let state = audioService.getGameplayIntensityState();
    assert.strictEqual(state.isEscalated, false);
    assert.strictEqual(state.currentRate, NORMAL_BGM_PLAYBACK_RATE);
    assert.strictEqual(state.currentVolume, BASE_GAMEPLAY_BGM_VOLUME);
    assert.strictEqual(mockPlayer.playbackRate, NORMAL_BGM_PLAYBACK_RATE);
    assert.strictEqual(mockPlayer.volume, BASE_GAMEPLAY_BGM_VOLUME);

    // Entering final 20s escalates rate to 1.18x with pitch correction and +15% volume boost
    const callsBeforeEscalate = rateCalls.length;
    audioService.updateGameplayBgmIntensity(20, true, { immediate: true });
    state = audioService.getGameplayIntensityState();
    assert.strictEqual(state.isEscalated, true);
    assert.strictEqual(state.currentRate, ESCALATED_BGM_PLAYBACK_RATE);
    assert.strictEqual(state.currentVolume, ESCALATED_GAMEPLAY_BGM_VOLUME);
    assert.strictEqual(state.shouldCorrectPitch, true);
    assert.strictEqual(mockPlayer.shouldCorrectPitch, true);
    assert.strictEqual(mockPlayer.playbackRate, ESCALATED_BGM_PLAYBACK_RATE);
    assert.strictEqual(mockPlayer.volume, ESCALATED_GAMEPLAY_BGM_VOLUME);
    assert.strictEqual(rateCalls.length, callsBeforeEscalate + 1);
    assert.strictEqual(rateCalls[rateCalls.length - 1]?.quality, 'high');

    // Consecutive countdown ticks (19..1) do not re-trigger escalation
    audioService.updateGameplayBgmIntensity(19, true, { immediate: true });
    audioService.updateGameplayBgmIntensity(10, true, { immediate: true });
    audioService.updateGameplayBgmIntensity(1, true, { immediate: true });
    assert.strictEqual(rateCalls.length, callsBeforeEscalate + 1);

    // Match end (isMatchActive = false) resets immediately back to 1.0x and base volume
    audioService.updateGameplayBgmIntensity(1, false);
    state = audioService.getGameplayIntensityState();
    assert.strictEqual(state.isEscalated, false);
    assert.strictEqual(state.currentRate, NORMAL_BGM_PLAYBACK_RATE);
    assert.strictEqual(state.currentVolume, BASE_GAMEPLAY_BGM_VOLUME);
    assert.strictEqual(mockPlayer.playbackRate, NORMAL_BGM_PLAYBACK_RATE);
    assert.strictEqual(mockPlayer.volume, BASE_GAMEPLAY_BGM_VOLUME);

    // Re-entering <= 20s then resetting via resetGameplayBgmIntensity (rematch) restores 1.0x
    audioService.updateGameplayBgmIntensity(12, true, { immediate: true });
    assert.strictEqual(audioService.getGameplayIntensityState().isEscalated, true);
    audioService.resetGameplayBgmIntensity();
    state = audioService.getGameplayIntensityState();
    assert.strictEqual(state.isEscalated, false);
    assert.strictEqual(state.currentRate, NORMAL_BGM_PLAYBACK_RATE);
    assert.strictEqual(mockPlayer.playbackRate, NORMAL_BGM_PLAYBACK_RATE);

    audioService.setActiveBgmPlayerForTesting(null, 'none');
  });

  test('paused or muted BGM does not unmute during final 20 seconds', async () => {
    const mockPlayer = {
      loop: false,
      muted: false,
      volume: 0.85,
      playbackRate: 1.0,
      shouldCorrectPitch: true,
      setPlaybackRate(rate: number) {
        this.playbackRate = rate;
      },
      play() {},
      pause() {},
      remove() {},
    };

    audioService.setActiveBgmPlayerForTesting(mockPlayer, 'gameplay');
    await audioService.pauseBgm();
    assert.strictEqual(mockPlayer.volume, 0.0);

    // While paused, countdown entering <= 20s must not unmute or escalate
    audioService.updateGameplayBgmIntensity(15, true, { immediate: true });
    assert.strictEqual(mockPlayer.volume, 0.0);
    assert.strictEqual(audioService.getGameplayIntensityState().isEscalated, false);

    await audioService.stopBgm();
  });
});
