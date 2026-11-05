// src/__tests__/settingsService.test.ts - Unit tests for Settings Persistence, Toggles, and Account Management
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  settingsService,
  DEFAULT_SETTINGS,
  UserSettings,
} from '../services/settingsService';
import { playerProfileService } from '../services/playerProfileService';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';

describe('Settings Service & Account Management', () => {
  beforeEach(async () => {
    await settingsService.resetSettings();
    await playerProfileService.resetProfile();
  });

  test('DEFAULT_SETTINGS contains all required toggles with correct default values', () => {
    assert.strictEqual(DEFAULT_SETTINGS.sfxEnabled, true);
    assert.strictEqual(DEFAULT_SETTINGS.bgmEnabled, true);
    assert.strictEqual(DEFAULT_SETTINGS.hapticsEnabled, true);
    assert.strictEqual(DEFAULT_SETTINGS.fastBots, false);
    assert.strictEqual(DEFAULT_SETTINGS.autoPass, true);
  });

  test('getSettings returns default settings when no preferences are saved', async () => {
    const settings = await settingsService.getSettings(true);
    assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
  });

  test('updateSetting toggles and persists single settings properly', async () => {
    // 1. Toggle SFX off
    const s1 = await settingsService.updateSetting('sfxEnabled', false);
    assert.strictEqual(s1.sfxEnabled, false);
    assert.strictEqual(soundService.getMuted(), true);

    // 2. Toggle fastBots on
    const s2 = await settingsService.updateSetting('fastBots', true);
    assert.strictEqual(s2.fastBots, true);

    // 3. Toggle autoPass off
    const s3 = await settingsService.updateSetting('autoPass', false);
    assert.strictEqual(s3.autoPass, false);

    // 4. Force reload from storage to ensure persistence
    const reloaded = await settingsService.getSettings(true);
    assert.strictEqual(reloaded.sfxEnabled, false);
    assert.strictEqual(reloaded.fastBots, true);
    assert.strictEqual(reloaded.autoPass, false);
    assert.strictEqual(reloaded.bgmEnabled, true);
    assert.strictEqual(reloaded.hapticsEnabled, true);
  });

  test('settingsService notifies subscribers when a setting changes', async () => {
    let callCount = 0;
    let lastReceived: UserSettings | null = null;

    const unsubscribe = settingsService.subscribe((updated) => {
      callCount += 1;
      lastReceived = updated;
    });

    await settingsService.updateSetting('bgmEnabled', false);
    assert.strictEqual(callCount, 1);
    assert.ok(lastReceived);
    assert.strictEqual((lastReceived as UserSettings).bgmEnabled, false);

    // After unsubscribe, further updates should not notify
    unsubscribe();
    await settingsService.updateSetting('bgmEnabled', true);
    assert.strictEqual(callCount, 1);
  });

  test('resetSettings restores all settings to default and syncs audio/haptics', async () => {
    await settingsService.updateSetting('sfxEnabled', false);
    await settingsService.updateSetting('fastBots', true);
    assert.strictEqual(soundService.getMuted(), true);

    const reset = await settingsService.resetSettings();
    assert.deepStrictEqual(reset, DEFAULT_SETTINGS);
    assert.strictEqual(soundService.getMuted(), false);
  });

  test('authService.signOut resets local profile to clean Guest state', async () => {
    // Customize profile first
    await playerProfileService.updateNickname('ChampionX');
    await playerProfileService.updateAvatar('avatar_3');
    await playerProfileService.awardMatchRewards(true, 10);

    const currentProfile = await playerProfileService.getProfile();
    assert.strictEqual(currentProfile.nickname, 'ChampionX');
    assert.ok(currentProfile.coins > 250);

    // Perform sign out
    const cleanGuest = await authService.signOut();
    assert.strictEqual(cleanGuest.nickname, 'Player');
    assert.strictEqual(cleanGuest.avatarId, 'avatar_1');
    assert.strictEqual(cleanGuest.level, 1);
    assert.strictEqual(cleanGuest.coins, 250);
    assert.strictEqual(cleanGuest.gems, 10);
    assert.strictEqual(cleanGuest.stats.gamesPlayed, 0);

    // Verify persisted profile is clean guest
    const fetched = await playerProfileService.getProfile(true);
    assert.strictEqual(fetched.nickname, 'Player');
    assert.strictEqual(fetched.coins, 250);
  });

  test('authService.deleteAccount wipes profile, resets settings, and restores clean Guest', async () => {
    // Modify profile and settings
    await playerProfileService.updateNickname('ToWipe');
    await settingsService.updateSetting('fastBots', true);

    // Perform account deletion
    const freshGuest = await authService.deleteAccount();
    await settingsService.resetSettings();

    assert.strictEqual(freshGuest.nickname, 'Player');
    assert.strictEqual(freshGuest.avatarId, 'avatar_1');
    assert.strictEqual(freshGuest.level, 1);
    assert.strictEqual(freshGuest.coins, 250);
    assert.strictEqual(freshGuest.gems, 10);

    const reloadedSettings = await settingsService.getSettings(true);
    assert.strictEqual(reloadedSettings.fastBots, false);
  });
});
