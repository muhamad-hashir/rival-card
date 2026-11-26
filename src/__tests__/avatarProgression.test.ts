// src/__tests__/avatarProgression.test.ts - Unit tests for 12-Avatar Level + Coin Unlock Progression & Legacy Preservation
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AVATAR_CATALOG,
  AVATAR_IMAGES,
  VIP_AVATAR_CATALOG,
  DEFAULT_UNLOCKED_AVATARS,
  getAvatarConfig,
  isAvatarUnlocked,
  normalizeAnyAvatarKey,
  normalizeAvatarKey,
  normalizeUnlockedAvatars,
} from '../constants/avatars';
import {
  ALT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  playerProfileService,
} from '../services/playerProfileService';
import { supabase } from '../services/supabase';

describe('12-Avatar Level + Coin Progression System', () => {
  const originalFrom = supabase.from;
  const originalWindow = (globalThis as any).window;
  let mockStore: Record<string, string> = {};

  function seedStoredProfile(obj: Record<string, any>) {
    const raw = JSON.stringify(obj);
    mockStore[STORAGE_KEY] = raw;
    mockStore[ALT_STORAGE_KEY] = raw;
    mockStore[LEGACY_STORAGE_KEY] = raw;
  }

  beforeEach(async () => {
    mockStore = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStore[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStore[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStore[k];
        },
      },
    };
    await playerProfileService.resetProfile();
  });

  afterEach(() => {
    (supabase as any).from = originalFrom;
    (globalThis as any).window = originalWindow;
  });

  test('Catalog defines all 12 avatars with exact Level + Coin + Gem unlock progression ladder', () => {
    assert.strictEqual(AVATAR_CATALOG.length, 12);

    const expected: Array<[string, string, number, number, number]> = [
      ['fox', 'Fox', 1, 0, 0],
      ['bot', 'Bot', 1, 0, 0],
      ['panda', 'Panda', 3, 500, 0],
      ['shield', 'Shield', 7, 900, 0],
      ['tiger', 'Tiger', 10, 2000, 0],
      ['wolf', 'Wolf', 15, 3200, 0],
      ['rival', 'Rival', 20, 4500, 0],
      ['ninja', 'Ninja', 25, 6000, 0],
      ['jester', 'Jester', 30, 7500, 5],
      ['flame', 'Flame', 35, 9000, 10],
      ['champ', 'Champ', 38, 11000, 15],
      ['dragon', 'Dragon', 40, 13500, 20],
    ];

    expected.forEach(([id, label, requiredLevel, coinCost, gemCost], idx) => {
      const item = AVATAR_CATALOG[idx];
      assert.strictEqual(item.id, id);
      assert.strictEqual(item.label, label);
      assert.strictEqual(item.requiredLevel, requiredLevel);
      assert.strictEqual(item.coinCost, coinCost);
      assert.strictEqual(item.gemCost, gemCost);
    });

    assert.deepStrictEqual([...DEFAULT_UNLOCKED_AVATARS], ['fox', 'bot']);
  });

  test('Default profile unlocks only fox and bot while panda, shield, dragon, etc. remain locked', async () => {
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.avatarId, 'fox');
    assert.deepStrictEqual(profile.unlockedAvatars, ['fox', 'bot']);
    assert.strictEqual(isAvatarUnlocked(profile.unlockedAvatars, 'fox'), true);
    assert.strictEqual(isAvatarUnlocked(profile.unlockedAvatars, 'bot'), true);
    assert.strictEqual(isAvatarUnlocked(profile.unlockedAvatars, 'panda'), false);
    assert.strictEqual(isAvatarUnlocked(profile.unlockedAvatars, 'dragon'), false);

    // Equipping unlocked starter 'bot' works immediately
    const withBot = await playerProfileService.updateAvatar('bot');
    assert.strictEqual(withBot.avatarId, 'bot');

    // Trying to equip locked 'panda' directly is ignored without changing equipped avatar
    const blocked = await playerProfileService.updateAvatar('panda');
    assert.strictEqual(blocked.avatarId, 'bot');
  });

  test('unlockAvatar blocks unlock when player level is too low or coins are insufficient', async () => {
    // Give plenty of coins, but stay Level 1 -> Panda requires Level 3
    await playerProfileService.addCurrency(2000, 0);
    const lowLevelRes = await playerProfileService.unlockAvatar('panda');
    assert.strictEqual(lowLevelRes.success, false);
    assert.strictEqual(lowLevelRes.reason, 'level_too_low');
    assert.match(lowLevelRes.error || '', /Level 3/);
    assert.strictEqual(lowLevelRes.profile.coins, 2250);
    assert.strictEqual(isAvatarUnlocked(lowLevelRes.profile.unlockedAvatars, 'panda'), false);

    // Seed a Level 3 profile with only 300 coins (Panda costs 500 coins)
    seedStoredProfile({
      ...(await playerProfileService.getProfile()),
      level: 3,
      coins: 300,
    });
    await playerProfileService.getProfile(true);

    const poorRes = await playerProfileService.unlockAvatar('panda');
    assert.strictEqual(poorRes.success, false);
    assert.strictEqual(poorRes.reason, 'insufficient_coins');
    assert.strictEqual(poorRes.profile.coins, 300);
    assert.strictEqual(isAvatarUnlocked(poorRes.profile.unlockedAvatars, 'panda'), false);

    // Seed a Level 40 profile with enough coins for Dragon (13,500) but only 5 Gems (needs 20)
    seedStoredProfile({
      ...(await playerProfileService.getProfile()),
      level: 40,
      coins: 15000,
      gems: 5,
    });
    await playerProfileService.getProfile(true);

    const lowGemsRes = await playerProfileService.unlockAvatar('dragon');
    assert.strictEqual(lowGemsRes.success, false);
    assert.strictEqual(lowGemsRes.reason, 'insufficient_gems');
    assert.strictEqual(lowGemsRes.profile.coins, 15000);
    assert.strictEqual(lowGemsRes.profile.gems, 5);
    assert.strictEqual(isAvatarUnlocked(lowGemsRes.profile.unlockedAvatars, 'dragon'), false);
  });

  test('unlockAvatar deducts coins and gems atomically, permanently unlocks, equips, and persists', async () => {
    seedStoredProfile({
      ...(await playerProfileService.getProfile()),
      level: 40,
      coins: 15000,
      gems: 30,
    });
    await playerProfileService.getProfile(true);

    // Unlock Panda (Lv. 3 / 500 coins, 0 gems)
    const pandaUnlock = await playerProfileService.unlockAvatar('panda');
    assert.strictEqual(pandaUnlock.success, true);
    assert.strictEqual(pandaUnlock.profile.coins, 14500);
    assert.strictEqual(pandaUnlock.profile.gems, 30);
    assert.strictEqual(pandaUnlock.profile.avatarId, 'panda');
    assert.ok(pandaUnlock.profile.unlockedAvatars.includes('panda'));

    // Unlock Dragon (Lv. 40 / 13500 coins + 20 gems)
    const dragonUnlock = await playerProfileService.unlockAvatar('dragon');
    assert.strictEqual(dragonUnlock.success, true);
    assert.strictEqual(dragonUnlock.profile.coins, 1000);
    assert.strictEqual(dragonUnlock.profile.gems, 10);
    assert.strictEqual(dragonUnlock.profile.avatarId, 'dragon');
    assert.ok(dragonUnlock.profile.unlockedAvatars.includes('dragon'));

    // Re-attempting unlock on an already-unlocked avatar fails safely without double-charging
    const duplicateUnlock = await playerProfileService.unlockAvatar('dragon');
    assert.strictEqual(duplicateUnlock.success, false);
    assert.strictEqual(duplicateUnlock.reason, 'already_unlocked');
    assert.strictEqual(duplicateUnlock.profile.coins, 1000);
    assert.strictEqual(duplicateUnlock.profile.gems, 10);

    // Reload from persistent storage -> unlocks, coins & gems persist cleanly
    const reloaded = await playerProfileService.getProfile(true);
    assert.strictEqual(reloaded.avatarId, 'dragon');
    assert.strictEqual(reloaded.coins, 1000);
    assert.strictEqual(reloaded.gems, 10);
    assert.ok(reloaded.unlockedAvatars.includes('panda'));
    assert.ok(reloaded.unlockedAvatars.includes('dragon'));
  });

  test('Legacy equipped avatar preservation automatically unlocks previously-free equipped avatars on load', async () => {
    // Simulate existing Level-1 player upgrading from older app version wearing 'avatar_6' (Champ)
    seedStoredProfile({
      id: 'legacy_player_01',
      nickname: 'OldTimer',
      avatarId: 'avatar_6',
      level: 1,
      currentXp: 40,
      xpToNextLevel: 100,
      coins: 250,
      gems: 10,
      stats: { gamesPlayed: 2, wins: 1, winStreak: 1 },
      isGuest: true,
    });

    const loaded = await playerProfileService.getProfile(true);
    assert.strictEqual(loaded.avatarId, 'champ');
    assert.ok(loaded.unlockedAvatars.includes('fox'));
    assert.ok(loaded.unlockedAvatars.includes('bot'));
    assert.ok(
      loaded.unlockedAvatars.includes('champ'),
      'Legacy equipped avatar (champ / avatar_6) must remain unlocked'
    );

    // Legacy ID mapping helpers resolve both legacy & canonical IDs cleanly
    assert.strictEqual(normalizeAvatarKey('avatar_3'), 'tiger');
    assert.strictEqual(normalizeAvatarKey('avatar_4'), 'panda');
    assert.strictEqual(normalizeAvatarKey('avatar_5'), 'rival');
    assert.strictEqual(getAvatarConfig('avatar_6').id, 'champ');
    assert.deepStrictEqual(normalizeUnlockedAvatars(undefined, 'avatar_3'), ['fox', 'bot', 'tiger']);
  });

  test('Supabase cloud sync gracefully falls back if unlocked_avatars column is not yet migrated', async () => {
    const upsertPayloads: Array<Record<string, any>> = [];
    let attempt = 0;

    (supabase as any).from = () => ({
      upsert: async (row: Record<string, any>) => {
        attempt += 1;
        upsertPayloads.push(row);
        if (attempt === 1) {
          return {
            error: {
              code: '42703',
              message: 'column profiles.unlocked_avatars does not exist',
            },
          };
        }
        return { error: null };
      },
    });

    const profile = await playerProfileService.getProfile();
    await playerProfileService.syncProfileToCloud({
      ...profile,
      isGuest: false,
      email: 'fallback@rivalcard.com',
    });

    assert.strictEqual(upsertPayloads.length, 2);
    assert.ok('unlocked_avatars' in upsertPayloads[0]);
    assert.strictEqual('unlocked_avatars' in upsertPayloads[1], false);
  });

  test('All 4 VIP Store Exclusives resolve cleanly via getAvatarConfig while remaining excluded from starter/coin ladder', () => {
    assert.strictEqual(VIP_AVATAR_CATALOG.length, 4);

    const expectedVip: Array<[string, string]> = [
      ['robo_king', 'Robo King'],
      ['golden_phoenix', 'Golden Phoenix'],
      ['grand_maester', 'Grand Maester'],
      ['cyber_samurai', 'Cyber Samurai'],
    ];

    for (const [key, label] of expectedVip) {
      assert.strictEqual(normalizeAnyAvatarKey(`avatar_${key}`), key as any);
      assert.strictEqual(normalizeAvatarKey(key), null, 'VIP avatars must stay separate from coin ladder');
      const cfg = getAvatarConfig(key);
      assert.strictEqual(cfg.id, key);
      assert.strictEqual(cfg.label, label);
      assert.strictEqual(cfg.isVipExclusive, true);
      assert.ok(cfg.bgColor.startsWith('#'));
    }
  });

  test('All 16 256x256 PNG avatar assets exist on disk in assets/avatars/ and are mapped in AVATAR_IMAGES', () => {
    const expectedKeys = [
      ...AVATAR_CATALOG.map((a) => a.id),
      ...VIP_AVATAR_CATALOG.map((v) => v.id),
    ];
    assert.strictEqual(expectedKeys.length, 16);
    assert.strictEqual(Object.keys(AVATAR_IMAGES).length, 16);

    const avatarsDir = path.resolve(__dirname, '../../assets/avatars');
    for (const key of expectedKeys) {
      assert.ok(key in AVATAR_IMAGES, `AVATAR_IMAGES missing ${key}`);
      const pngPath = path.join(avatarsDir, `${key}.png`);
      assert.ok(fs.existsSync(pngPath), `Missing PNG asset: assets/avatars/${key}.png`);

      // Parse PNG IHDR width/height bytes (offsets 16..24) to verify 256x256 dimensions
      const buf = fs.readFileSync(pngPath);
      assert.strictEqual(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${key}.png invalid PNG header`);
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.strictEqual(width, 256, `${key}.png width must be 256`);
      assert.strictEqual(height, 256, `${key}.png height must be 256`);
    }
  });
});
