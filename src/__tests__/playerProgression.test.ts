// src/__tests__/playerProgression.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  playerProfileService,
  STORAGE_KEY,
} from '../services/playerProfileService';

describe('Player Progression & Economy System', () => {
  beforeEach(async () => {
    await playerProfileService.resetProfile();
  });

  it('initializes default profile with level 1, 0 XP, 100 XP threshold, 250 coins, and 10 gems', async () => {
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 1, 'Default level must be 1');
    assert.strictEqual(profile.currentXp, 0, 'Default currentXp must be 0');
    assert.strictEqual(profile.xpToNextLevel, 100, 'Default xpToNextLevel must be 100 (level 1 * 100)');
    assert.strictEqual(profile.coins, 250, 'Default coins must be 250');
    assert.strictEqual(profile.gems, 10, 'Default gems must be 10');
  });

  it('awards defeat match rewards: +50 XP and +20 coins without leveling up', async () => {
    const rewards = await playerProfileService.awardMatchRewards(false, 10);
    assert.strictEqual(rewards.earnedXp, 50);
    assert.strictEqual(rewards.earnedCoins, 20);
    assert.strictEqual(rewards.leveledUp, false);
    assert.strictEqual(rewards.newLevel, 1);
    assert.strictEqual(rewards.bonusCoins, 0);
    assert.strictEqual(rewards.bonusGems, 0);
    assert.strictEqual(rewards.currentXp, 50);
    assert.strictEqual(rewards.xpToNextLevel, 100);

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 270, 'Coins should increase from 250 to 270 (+20)');
    assert.strictEqual(profile.gems, 10, 'Gems remain 10');
    assert.strictEqual(profile.currentXp, 50);
    assert.strictEqual(profile.level, 1);
  });

  it('awards victory match rewards and triggers level-up when crossing 100 XP', async () => {
    // Victory awards +120 XP and +60 coins.
    // Starting at 0 XP, +120 XP >= 100 threshold triggers level up to 2.
    // Remainder XP = 120 - 100 = 20.
    // Next threshold = 2 * 100 = 200.
    // Level-Up Bonus: +100 coins and +5 gems.
    // Total coins = 250 (start) + 60 (match) + 100 (bonus) = 410.
    // Total gems = 10 (start) + 5 (bonus) = 15.
    const rewards = await playerProfileService.awardMatchRewards(true, 12);
    assert.strictEqual(rewards.earnedXp, 120);
    assert.strictEqual(rewards.earnedCoins, 60);
    assert.strictEqual(rewards.leveledUp, true);
    assert.strictEqual(rewards.newLevel, 2);
    assert.strictEqual(rewards.bonusCoins, 100);
    assert.strictEqual(rewards.bonusGems, 5);
    assert.strictEqual(rewards.currentXp, 20, 'Carried over XP should be 20');
    assert.strictEqual(rewards.xpToNextLevel, 200, 'Level 2 threshold should be 200');

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 2);
    assert.strictEqual(profile.currentXp, 20);
    assert.strictEqual(profile.xpToNextLevel, 200);
    assert.strictEqual(profile.coins, 410);
    assert.strictEqual(profile.gems, 15);
  });

  it('handles multi-match progression across multiple levels', async () => {
    // 1st victory: 0 + 120 XP -> Level 2, 20/200 XP
    await playerProfileService.awardMatchRewards(true, 8);
    let profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 2);
    assert.strictEqual(profile.currentXp, 20);
    assert.strictEqual(profile.xpToNextLevel, 200);

    // 2nd match (defeat): 20 + 50 = 70/200 XP, level remains 2
    let res = await playerProfileService.awardMatchRewards(false, 15);
    assert.strictEqual(res.leveledUp, false);
    assert.strictEqual(res.newLevel, 2);
    assert.strictEqual(res.currentXp, 70);

    // 3rd match (victory): 70 + 120 = 190/200 XP, level remains 2
    res = await playerProfileService.awardMatchRewards(true, 9);
    assert.strictEqual(res.leveledUp, false);
    assert.strictEqual(res.newLevel, 2);
    assert.strictEqual(res.currentXp, 190);

    // 4th match (victory): 190 + 120 = 310 XP >= 200!
    // Level up to 3! Remainder = 310 - 200 = 110 XP.
    // Next threshold = 3 * 100 = 300 XP.
    res = await playerProfileService.awardMatchRewards(true, 11);
    assert.strictEqual(res.leveledUp, true);
    assert.strictEqual(res.newLevel, 3);
    assert.strictEqual(res.currentXp, 110);
    assert.strictEqual(res.xpToNextLevel, 300);
    assert.strictEqual(res.bonusCoins, 100);
    assert.strictEqual(res.bonusGems, 5);

    profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 3);
    assert.strictEqual(profile.currentXp, 110);
    assert.strictEqual(profile.xpToNextLevel, 300);
  });

  it('addCurrency correctly increases coins and gems balances', async () => {
    const updated = await playerProfileService.addCurrency(150, 20);
    assert.strictEqual(updated.coins, 250 + 150);
    assert.strictEqual(updated.gems, 10 + 20);

    const refetched = await playerProfileService.getProfile();
    assert.strictEqual(refetched.coins, 400);
    assert.strictEqual(refetched.gems, 30);
  });

  it('deductCurrency subtracts coins and gems when sufficient funds exist', async () => {
    const success = await playerProfileService.deductCurrency(100, 5);
    assert.strictEqual(success, true);

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 150);
    assert.strictEqual(profile.gems, 5);
  });

  it('deductCurrency rejects transaction and returns false when insufficient funds', async () => {
    // Current: 250 coins, 10 gems. Try to deduct 500 coins.
    const failedCoins = await playerProfileService.deductCurrency(500, 0);
    assert.strictEqual(failedCoins, false);

    // Try to deduct 50 gems
    const failedGems = await playerProfileService.deductCurrency(0, 50);
    assert.strictEqual(failedGems, false);

    // Profile remains unchanged
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 250);
    assert.strictEqual(profile.gems, 10);
  });

  it('persists progression data automatically using STORAGE_KEY', async () => {
    assert.strictEqual(STORAGE_KEY, '@rivalcard:player_profile');
    await playerProfileService.awardMatchRewards(true, 5);

    // Force refresh from storage
    const fresh = await playerProfileService.getProfile(true);
    assert.strictEqual(fresh.level, 2);
    assert.strictEqual(fresh.currentXp, 20);
    assert.strictEqual(fresh.coins, 410);
    assert.strictEqual(fresh.gems, 15);
  });
});
