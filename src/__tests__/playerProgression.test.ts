// src/__tests__/playerProgression.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  playerProfileService,
  STORAGE_KEY,
  DAILY_BOT_STORAGE_KEY,
  DAILY_BOT_COIN_CAP,
} from '../services/playerProfileService';

describe('Player Progression & Economy System', () => {
  beforeEach(async () => {
    await playerProfileService.resetProfile();
    await playerProfileService.resetDailyBotEarnings();
  });

  it('initializes default profile with level 1, 0 XP, 100 XP threshold, 250 coins, and 10 gems', async () => {
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 1, 'Default level must be 1');
    assert.strictEqual(profile.currentXp, 0, 'Default currentXp must be 0');
    assert.strictEqual(profile.xpToNextLevel, 100, 'Default xpToNextLevel must be 100 (level 1 * 100)');
    assert.strictEqual(profile.coins, 250, 'Default coins must be 250');
    assert.strictEqual(profile.gems, 10, 'Default gems must be 10');
  });

  it('awards online defeat match rewards: +25 XP and +10 coins without leveling up', async () => {
    const rewards = await playerProfileService.awardMatchRewards(false, 10, 'online_ranked');
    assert.strictEqual(rewards.earnedXp, 25);
    assert.strictEqual(rewards.earnedCoins, 10);
    assert.strictEqual(rewards.leveledUp, false);
    assert.strictEqual(rewards.newLevel, 1);
    assert.strictEqual(rewards.bonusCoins, 0);
    assert.strictEqual(rewards.bonusGems, 0);
    assert.strictEqual(rewards.currentXp, 25);
    assert.strictEqual(rewards.xpToNextLevel, 100);

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 260, 'Coins should increase from 250 to 260 (+10)');
    assert.strictEqual(profile.gems, 10, 'Gems remain 10');
    assert.strictEqual(profile.currentXp, 25);
    assert.strictEqual(profile.level, 1);
  });

  it('awards online victory match rewards and triggers level-up when crossing 100 XP', async () => {
    // Online Victory awards +100 XP and +50 coins.
    // Starting at 0 XP, +100 XP >= 100 threshold triggers level up to 2.
    // Remainder XP = 100 - 100 = 0.
    // Next threshold = 2 * 100 = 200.
    // Level-Up Bonus: +100 coins and +5 gems.
    // Total coins = 250 (start) + 50 (match) + 100 (bonus) = 400.
    // Total gems = 10 (start) + 5 (bonus) = 15.
    const rewards = await playerProfileService.awardMatchRewards(true, 12, 'online_ranked');
    assert.strictEqual(rewards.earnedXp, 100);
    assert.strictEqual(rewards.earnedCoins, 50);
    assert.strictEqual(rewards.leveledUp, true);
    assert.strictEqual(rewards.newLevel, 2);
    assert.strictEqual(rewards.bonusCoins, 100);
    assert.strictEqual(rewards.bonusGems, 5);
    assert.strictEqual(rewards.currentXp, 0, 'Carried over XP should be 0');
    assert.strictEqual(rewards.xpToNextLevel, 200, 'Level 2 threshold should be 200');

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 2);
    assert.strictEqual(profile.currentXp, 0);
    assert.strictEqual(profile.xpToNextLevel, 200);
    assert.strictEqual(profile.coins, 400);
    assert.strictEqual(profile.gems, 15);
  });

  it('handles multi-match progression across multiple levels', async () => {
    // 1st victory: 0 + 100 XP -> Level 2, 0/200 XP
    await playerProfileService.awardMatchRewards(true, 8, 'online_ranked');
    let profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 2);
    assert.strictEqual(profile.currentXp, 0);
    assert.strictEqual(profile.xpToNextLevel, 200);

    // 2nd match (defeat): 0 + 25 = 25/200 XP, level remains 2
    let res = await playerProfileService.awardMatchRewards(false, 15, 'online_ranked');
    assert.strictEqual(res.leveledUp, false);
    assert.strictEqual(res.newLevel, 2);
    assert.strictEqual(res.currentXp, 25);

    // 3rd match (victory): 25 + 100 = 125/200 XP, level remains 2
    res = await playerProfileService.awardMatchRewards(true, 9, 'online_ranked');
    assert.strictEqual(res.leveledUp, false);
    assert.strictEqual(res.newLevel, 2);
    assert.strictEqual(res.currentXp, 125);

    // 4th match (victory): 125 + 100 = 225 XP >= 200!
    // Level up to 3! Remainder = 225 - 200 = 25 XP.
    // Next threshold = 3 * 100 = 300 XP.
    res = await playerProfileService.awardMatchRewards(true, 11, 'online_ranked');
    assert.strictEqual(res.leveledUp, true);
    assert.strictEqual(res.newLevel, 3);
    assert.strictEqual(res.currentXp, 25);
    assert.strictEqual(res.xpToNextLevel, 300);
    assert.strictEqual(res.bonusCoins, 100);
    assert.strictEqual(res.bonusGems, 5);

    profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.level, 3);
    assert.strictEqual(profile.currentXp, 25);
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
    await playerProfileService.awardMatchRewards(true, 5, 'online_ranked');

    // Force refresh from storage
    const fresh = await playerProfileService.getProfile(true);
    assert.strictEqual(fresh.level, 2);
    assert.strictEqual(fresh.currentXp, 0);
    assert.strictEqual(fresh.coins, 400);
    assert.strictEqual(fresh.gems, 15);
  });

  it('Game Economy: Bot matches award rebalanced rewards (Win = 20 XP + 10 Coins, Loss = 5 XP + 2 Coins)', async () => {
    // Bot win: 20 XP, 10 coins
    const winRewards = await playerProfileService.awardMatchRewards(true, 8, 'bot');
    assert.strictEqual(winRewards.earnedXp, 20);
    assert.strictEqual(winRewards.earnedCoins, 10);

    // Bot loss: 5 XP, 2 coins
    const lossRewards = await playerProfileService.awardMatchRewards(false, 10, 'bot');
    assert.strictEqual(lossRewards.earnedXp, 5);
    assert.strictEqual(lossRewards.earnedCoins, 2);
  });

  it('Game Economy: Enforces daily bot earnings soft cap (max 100 coins/day)', async () => {
    assert.strictEqual(DAILY_BOT_STORAGE_KEY, '@rivalcard:daily_bot_earnings');
    assert.strictEqual(DAILY_BOT_COIN_CAP, 100);

    // Initial check: 0 coins earned today
    const initialEarnings = await playerProfileService.getDailyBotEarnings();
    assert.strictEqual(initialEarnings.coinsEarned, 0);

    // Win 9 bot matches -> 9 * 10 = 90 coins earned
    for (let i = 0; i < 9; i++) {
      const res = await playerProfileService.awardMatchRewards(true, 5, 'bot');
      assert.strictEqual(res.earnedCoins, 10);
    }

    let daily = await playerProfileService.getDailyBotEarnings();
    assert.strictEqual(daily.coinsEarned, 90);

    // 10th bot win -> earns 10 coins, reaching exactly 100 coins cap
    const tenthWin = await playerProfileService.awardMatchRewards(true, 5, 'bot');
    assert.strictEqual(tenthWin.earnedCoins, 10);

    daily = await playerProfileService.getDailyBotEarnings();
    assert.strictEqual(daily.coinsEarned, 100);

    // 11th bot win -> soft cap reached: earns 0 coins, but still earns 20 XP
    const eleventhWin = await playerProfileService.awardMatchRewards(true, 5, 'bot');
    assert.strictEqual(eleventhWin.earnedCoins, 0, 'Must earn 0 coins after reaching 100 coin cap');
    assert.strictEqual(eleventhWin.earnedXp, 20, 'Must still earn 20 XP even when coin cap is reached');

    // Bot loss when cap reached -> earns 0 coins, 5 XP
    const cappedLoss = await playerProfileService.awardMatchRewards(false, 5, 'bot');
    assert.strictEqual(cappedLoss.earnedCoins, 0);
    assert.strictEqual(cappedLoss.earnedXp, 5);

    // Reset daily earnings -> player can earn coins again
    await playerProfileService.resetDailyBotEarnings();
    const afterReset = await playerProfileService.awardMatchRewards(true, 5, 'bot');
    assert.strictEqual(afterReset.earnedCoins, 10);
  });

  it('Game Economy: Pass & Play and Custom Private Rooms award 0 XP and 0 Coins', async () => {
    const passPlayWin = await playerProfileService.awardMatchRewards(true, 5, 'pass_and_play');
    assert.strictEqual(passPlayWin.earnedXp, 0);
    assert.strictEqual(passPlayWin.earnedCoins, 0);

    const privateRoomLoss = await playerProfileService.awardMatchRewards(false, 7, 'custom_private');
    assert.strictEqual(privateRoomLoss.earnedXp, 0);
    assert.strictEqual(privateRoomLoss.earnedCoins, 0);
  });
});
