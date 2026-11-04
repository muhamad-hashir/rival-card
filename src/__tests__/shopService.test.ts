// src/__tests__/shopService.test.ts - Unit tests for Shop Catalog, High-Stakes Pricing & Locked Previews
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  shopService,
  SHOP_CATEGORIES,
  SHOP_CATALOG,
  DEFAULT_INVENTORY,
  ShopCategory,
} from '../services/shopService';
import { playerProfileService } from '../services/playerProfileService';

describe('Shop Catalog, High-Stakes Pricing & Locked Previews', () => {
  beforeEach(async () => {
    await shopService.resetInventory();
    await playerProfileService.resetProfile();
  });

  test('Shop categories define exactly the 5 required categories with icons', () => {
    const expectedKeys: ShopCategory[] = ['card_backs', 'sceneries', 'avatars', 'cards', 'emotes'];
    assert.strictEqual(SHOP_CATEGORIES.length, 5);
    for (const key of expectedKeys) {
      const found = SHOP_CATEGORIES.find((c) => c.key === key);
      assert.ok(found, `Category ${key} must exist in SHOP_CATEGORIES`);
      assert.ok(found.label.length > 0);
      assert.ok(found.icon.length > 0);
    }
  });

  test('Emotes category contains all 4 high-stakes grinding coin sinks', () => {
    const emotes = shopService.getItemsByCategory('emotes');
    assert.strictEqual(emotes.length, 4, 'Must have exactly 4 high-stakes emotes');

    const thinking = emotes.find((e) => e.name === 'Thinking...');
    assert.ok(thinking);
    assert.strictEqual(thinking.price.currency, 'coins');
    assert.strictEqual(thinking.price.amount, 1200);
    assert.strictEqual(Boolean(thinking.purchasesUnavailable), false);

    const oops = emotes.find((e) => e.name === 'Oops!');
    assert.ok(oops);
    assert.strictEqual(oops.price.currency, 'coins');
    assert.strictEqual(oops.price.amount, 1500);

    const gg = emotes.find((e) => e.name === 'GG!');
    assert.ok(gg);
    assert.strictEqual(gg.price.currency, 'coins');
    assert.strictEqual(gg.price.amount, 2000);

    const niceTry = emotes.find((e) => e.name === 'Nice Try!');
    assert.ok(niceTry);
    assert.strictEqual(niceTry.price.currency, 'coins');
    assert.strictEqual(niceTry.price.amount, 2500);
  });

  test('Premium items in Card Backs, Sceneries, Avatars, and Cards are locked and unavailable', () => {
    const lockedIds = [
      'card_back_crimson',
      'card_back_golden',
      'card_back_cyber',
      'scenery_midnight',
      'scenery_royal',
      'avatar_robo_king',
      'avatar_golden_phoenix',
      'cards_minimalist',
      'cards_retro',
    ];

    for (const id of lockedIds) {
      const item = shopService.getItemById(id);
      assert.ok(item, `Item ${id} must exist in catalog`);
      assert.strictEqual(
        item.purchasesUnavailable,
        true,
        `Item ${id} must be flagged as purchasesUnavailable`
      );
    }
  });

  test('Attempting to purchase a locked premium item is blocked with testing mode error', async () => {
    // Attempting to buy locked Crimson Flame
    const res = await shopService.buyItem('card_back_crimson');
    assert.strictEqual(res.success, false);
    assert.strictEqual(
      res.error,
      'Store testing mode: Premium unlocks will be available at global launch!'
    );

    // Attempting to buy locked Royal Velvet
    const royalRes = await shopService.buyItem('scenery_royal');
    assert.strictEqual(royalRes.success, false);
    assert.strictEqual(
      royalRes.error,
      'Store testing mode: Premium unlocks will be available at global launch!'
    );

    // Player currency remains completely untouched
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 250);
    assert.strictEqual(profile.gems, 10);
  });

  test('Default inventory initializes with starter items owned and equipped', async () => {
    const inventory = await shopService.getInventory(true);
    assert.ok(inventory.ownedItemIds.includes('card_back_classic'));
    assert.ok(inventory.ownedItemIds.includes('scenery_meadow'));
    assert.ok(inventory.ownedItemIds.includes('cards_standard'));
    assert.strictEqual(inventory.equippedItems.card_backs, 'card_back_classic');
    assert.strictEqual(inventory.equippedItems.sceneries, 'scenery_meadow');
    assert.strictEqual(inventory.equippedItems.cards, 'cards_standard');
  });

  test('Purchasing an emote fails if player has insufficient coins', async () => {
    // New guest starts with 250 coins
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 250);

    // Thinking costs 1,200 coins -> should fail
    const res = await shopService.buyItem('emote_thinking');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Not enough coins!');
  });

  test('Purchasing high-stakes emote succeeds when sufficient coins accumulated and auto-equips', async () => {
    // Award coins to player (e.g. grinding matches): 250 + 2,000 = 2,250
    await playerProfileService.addCurrency(2000, 0);

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 2250);

    // Buy Thinking... (1,200 coins)
    const res = await shopService.buyItem('emote_thinking');
    assert.strictEqual(res.success, true);
    assert.ok(res.inventory?.ownedItemIds.includes('emote_thinking'));
    assert.strictEqual(res.inventory?.equippedItems.emotes, 'emote_thinking');

    // Balance deducted: 2,250 - 1,200 = 1,050 coins
    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.coins, 1050);
  });

  test('Equipping an owned item updates equipped state and rejects unowned items', async () => {
    // Add coins and buy GG! emote (2,000 coins)
    await playerProfileService.addCurrency(3000, 0);
    await shopService.buyItem('emote_thinking');
    await shopService.buyItem('emote_gg');

    // Switch equipped emote back to Thinking
    const updated = await shopService.equipItem('emotes', 'emote_thinking');
    assert.strictEqual(updated.equippedItems.emotes, 'emote_thinking');

    // Switch to GG
    const reEquipped = await shopService.equipItem('emotes', 'emote_gg');
    assert.strictEqual(reEquipped.equippedItems.emotes, 'emote_gg');

    // Attempting to equip Nice Try! (unowned) throws
    await assert.rejects(
      async () => {
        await shopService.equipItem('emotes', 'emote_nice_try');
      },
      { message: /Cannot equip unowned item/ }
    );
  });

  test('getEquippedItem returns the full ShopItem with preview styling', async () => {
    const cardBack = await shopService.getEquippedItem('card_backs');
    assert.strictEqual(cardBack.id, 'card_back_classic');
    assert.strictEqual(cardBack.name, 'Classic Slate');
    assert.strictEqual(cardBack.previewStyle.primaryColor, '#1E293B');

    const scenery = await shopService.getEquippedItem('sceneries');
    assert.strictEqual(scenery.id, 'scenery_meadow');
    assert.strictEqual(scenery.name, 'Meadow Green');
    assert.strictEqual(scenery.previewStyle.primaryColor, '#15803D');
  });
});
