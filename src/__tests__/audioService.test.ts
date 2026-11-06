// src/__tests__/audioService.test.ts - Unit tests for Audio & Music Engine (BGM and SFX)
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { audioService } from '../services/audioService';
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
});
