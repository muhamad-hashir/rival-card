// src/__tests__/shopService.test.ts - Unit tests for Streamlined Shop Catalog, Card Backs, Emotes & Currency Packs
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatShopEmoteTauntText,
  getUnlockedShopEmotes,
  shopService,
  SHOP_CATEGORIES,
  SHOP_CATALOG,
  IAP_UNAVAILABLE_MESSAGE,
  ShopCategory,
} from '../services/shopService';
import { playerProfileService } from '../services/playerProfileService';

describe('Streamlined Shop Catalog, Card Backs, Emotes & Currency Packs', () => {
  beforeEach(async () => {
    await shopService.resetInventory();
    await playerProfileService.resetProfile();
  });

  test('Shop categories define exactly the 4 streamlined categories with no sceneries or card face themes', () => {
    const expectedKeys: ShopCategory[] = ['card_backs', 'avatars', 'emotes', 'currency'];
    assert.strictEqual(SHOP_CATEGORIES.length, 4);
    assert.deepStrictEqual(
      SHOP_CATEGORIES.map((c) => c.key),
      expectedKeys
    );
    for (const cat of SHOP_CATEGORIES) {
      assert.ok(cat.label.length > 0);
      assert.ok(cat.icon.length > 0);
    }
    assert.strictEqual(
      SHOP_CATALOG.some((item) => (item.category as string) === 'sceneries' || (item.category as string) === 'cards'),
      false,
      'Sceneries and Card Face Themes must be completely removed'
    );
  });

  test('All 4 Card Back PNGs exist on disk and are statically required in shopService.ts', () => {
    const cardBacks = shopService.getItemsByCategory('card_backs');
    assert.strictEqual(cardBacks.length, 4);

    const expectedPaths: Record<string, string> = {
      card_back_classic: 'assets/store/card_backs/classic_back.png',
      card_back_crimson: 'assets/store/card_backs/crimson_flame.png',
      card_back_golden: 'assets/store/card_backs/golden_rim.png',
      card_back_cyber: 'assets/store/card_backs/cyber_neon.png',
    };

    const shopSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/shopService.ts'),
      'utf8'
    );

    for (const cardBack of cardBacks) {
      const relPath = expectedPaths[cardBack.id];
      assert.ok(relPath, `Expected card back asset path for ${cardBack.id}`);
      const absPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(absPath), `Expected card back PNG at ${relPath}`);

      const staticRequireTarget = `../../${relPath}`;
      assert.ok(
        shopSource.includes(staticRequireTarget),
        `shopService.ts must statically require('${staticRequireTarget}')`
      );
    }

    // Ensure no leftover references to deleted assets/card_back.png remain
    const filesToCheck = [
      'App.tsx',
      'src/components/CardView.tsx',
      'src/components/FlyingCard.tsx',
      'src/screens/GameScreen.tsx',
    ];
    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
      assert.strictEqual(
        content.includes("assets/card_back.png"),
        false,
        `${filePath} must not reference deleted assets/card_back.png`
      );
    }
  });

  test('Emotes category contains 4 Coin emotes and 5 Gem-priced emotes without PNG sticker images', () => {
    const emotes = shopService.getItemsByCategory('emotes');
    assert.strictEqual(emotes.length, 9, 'Must have 4 Coin emotes + 5 Gem emotes');

    const expectedEmotes: Array<{
      id: string;
      name: string;
      currency: 'coins' | 'gems';
      amount: number;
    }> = [
      { id: 'emote_thinking', name: 'Thinking...', currency: 'coins', amount: 1200 },
      { id: 'emote_oops', name: 'Oops!', currency: 'coins', amount: 2000 },
      { id: 'emote_gg', name: 'GG!', currency: 'coins', amount: 3200 },
      { id: 'emote_nice_try', name: 'Nice Try!', currency: 'coins', amount: 4500 },
      { id: 'emote_close_one', name: 'Close One!', currency: 'gems', amount: 15 },
      { id: 'emote_too_slow', name: 'Too Slow!', currency: 'gems', amount: 15 },
      { id: 'emote_unlucky', name: 'Unlucky!', currency: 'gems', amount: 15 },
      { id: 'emote_rematch', name: 'Rematch?', currency: 'gems', amount: 20 },
      { id: 'emote_no_mercy', name: 'No Mercy!', currency: 'gems', amount: 20 },
    ];

    for (const expected of expectedEmotes) {
      const found = emotes.find((e) => e.id === expected.id);
      assert.ok(found, `Missing emote ${expected.id}`);
      assert.strictEqual(found.name, expected.name);
      assert.strictEqual(found.price.currency, expected.currency);
      assert.strictEqual(found.price.amount, expected.amount);
      assert.strictEqual(Boolean(found.purchasesUnavailable), false);
      assert.strictEqual(found.image, undefined);
      assert.ok(found.previewStyle.emoji, `Emote ${expected.id} should define a standard emoji`);
      assert.strictEqual(found.previewStyle.text, expected.name);
    }
  });

  test('Default inventory initializes with Classic Slate card back owned and equipped', async () => {
    const inventory = await shopService.getInventory(true);
    assert.ok(inventory.ownedItemIds.includes('card_back_classic'));
    assert.strictEqual(inventory.equippedItems.card_backs, 'card_back_classic');

    const equipped = await shopService.getEquippedItem('card_backs');
    assert.strictEqual(equipped.id, 'card_back_classic');
    assert.strictEqual(equipped.name, 'Classic Slate');
  });

  test('Card Backs reflect rebalanced pricing and can be purchased with Coins/Gems and equipped for gameplay', async () => {
    assert.strictEqual(shopService.getItemById('card_back_crimson')?.price.amount, 8000);
    assert.strictEqual(shopService.getItemById('card_back_golden')?.price.amount, 12000);
    assert.strictEqual(shopService.getItemById('card_back_cyber')?.price.amount, 50);

    await playerProfileService.addCurrency(15000, 60);

    const crimsonRes = await shopService.buyItem('card_back_crimson');
    assert.strictEqual(crimsonRes.success, true);
    assert.strictEqual(crimsonRes.inventory?.equippedItems.card_backs, 'card_back_crimson');

    const cyberRes = await shopService.buyItem('card_back_cyber');
    assert.strictEqual(cyberRes.success, true);
    assert.strictEqual(cyberRes.inventory?.equippedItems.card_backs, 'card_back_cyber');

    const equipped = await shopService.getEquippedItem('card_backs');
    assert.strictEqual(equipped.id, 'card_back_cyber');

    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.coins, 7250); // 250 + 15000 - 8000
    assert.strictEqual(profileAfter.gems, 20); // 10 + 60 - 50
  });

  test('Purchasing an emote fails if player has insufficient coins', async () => {
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 250);

    const res = await shopService.buyItem('emote_thinking');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Not enough coins!');
  });

  test('Purchasing high-stakes emote succeeds when sufficient coins accumulated and auto-equips', async () => {
    await playerProfileService.addCurrency(2000, 0);

    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.coins, 2250);

    const res = await shopService.buyItem('emote_thinking');
    assert.strictEqual(res.success, true);
    assert.ok(res.inventory?.ownedItemIds.includes('emote_thinking'));
    assert.strictEqual(res.inventory?.equippedItems.emotes, 'emote_thinking');

    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.coins, 1050);
  });

  test('Equipping an owned item updates equipped state and rejects unowned items', async () => {
    await playerProfileService.addCurrency(4500, 0);
    await shopService.buyItem('emote_thinking');
    await shopService.buyItem('emote_gg');

    const updated = await shopService.equipItem('emotes', 'emote_thinking');
    assert.strictEqual(updated.equippedItems.emotes, 'emote_thinking');

    const reEquipped = await shopService.equipItem('emotes', 'emote_gg');
    assert.strictEqual(reEquipped.equippedItems.emotes, 'emote_gg');

    await assert.rejects(
      async () => {
        await shopService.equipItem('emotes', 'emote_nice_try');
      },
      { message: /Cannot equip unowned item/ }
    );
  });

  test('Coins & Gems currency category defines 3 Coin packs and 3 Gem packs at $0.99, $1.99, $2.99 USD', async () => {
    const currencyPacks = shopService.getItemsByCategory('currency');
    assert.strictEqual(currencyPacks.length, 6);

    const expectedPacks = [
      { id: 'pack_coins_starter', name: 'Starter Pouch', packType: 'coins', packAmount: 1500, usdPrice: '$0.99 USD' },
      { id: 'pack_coins_stash', name: 'Rival Stash', packType: 'coins', packAmount: 3500, usdPrice: '$1.99 USD' },
      { id: 'pack_coins_vault', name: 'Champion Vault', packType: 'coins', packAmount: 6000, usdPrice: '$2.99 USD' },
      { id: 'pack_gems_handful', name: 'Handful of Gems', packType: 'gems', packAmount: 30, usdPrice: '$0.99 USD' },
      { id: 'pack_gems_satchel', name: 'Gem Satchel', packType: 'gems', packAmount: 75, usdPrice: '$1.99 USD' },
      { id: 'pack_gems_chest', name: 'Royal Gem Chest', packType: 'gems', packAmount: 130, usdPrice: '$2.99 USD' },
    ];

    for (const expected of expectedPacks) {
      const pack = currencyPacks.find((p) => p.id === expected.id);
      assert.ok(pack, `Missing currency pack ${expected.id}`);
      assert.strictEqual(pack.name, expected.name);
      assert.strictEqual(pack.packType, expected.packType);
      assert.strictEqual(pack.packAmount, expected.packAmount);
      assert.strictEqual(pack.usdPrice, expected.usdPrice);
      assert.strictEqual(pack.unlockType, 'iap');
      assert.strictEqual(pack.comingSoon, true);

      // Tapping any IAP pack gracefully returns the Google Play launch notice
      const res = await shopService.buyItem(pack.id);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, IAP_UNAVAILABLE_MESSAGE);
    }

    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.coins, 250);
    assert.strictEqual(profileAfter.gems, 10);
  });

  test('Shop avatar list excludes Guest Fox and Guest Bot starters while keeping 10 progression + 4 VIP exclusives', () => {
    const shopAvatars = shopService.getItemsByCategory('avatars');
    assert.strictEqual(shopAvatars.length, 14);
    assert.strictEqual(
      shopAvatars.some((a) => ['fox', 'bot', 'avatar_1', 'avatar_2'].includes(a.id)),
      false,
      'Guest Fox & Guest Bot must be excluded from Shop avatars'
    );

    const vipIds = [
      'avatar_robo_king',
      'avatar_golden_phoenix',
      'avatar_grand_maester',
      'avatar_cyber_samurai',
    ];
    for (const id of vipIds) {
      const vip = shopService.getItemById(id);
      assert.ok(vip, `${id} must exist in Shop catalog`);
      assert.strictEqual(vip.unlockType, 'iap');
      assert.strictEqual(vip.isRealMoneyExclusive, true);
      assert.strictEqual(vip.comingSoon, true);
      assert.strictEqual(vip.purchasesUnavailable, true);
    }
  });

  test('VIP Store Exclusive avatars cannot be purchased with coins or unlocked via level progression', async () => {
    await playerProfileService.addCurrency(50000, 500);

    const vipShopIds = [
      'avatar_robo_king',
      'avatar_golden_phoenix',
      'avatar_grand_maester',
      'avatar_cyber_samurai',
    ];
    for (const id of vipShopIds) {
      const res = await shopService.buyItem(id);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'Real-money Store & VIP packs coming in the next update!');
    }

    for (const key of ['robo_king', 'golden_phoenix', 'grand_maester', 'cyber_samurai']) {
      const unlockAttempt = await playerProfileService.unlockAvatar(key);
      assert.strictEqual(unlockAttempt.success, false);
      assert.strictEqual(unlockAttempt.reason, 'invalid_avatar');
    }

    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.coins, 50250);
    assert.strictEqual(profileAfter.gems, 510);
  });

  test('Gem-priced emotes validate gems, appear in unlocked in-match picker list, and merge from cloud inventory', async () => {
    // Starter guest has 10 Gems -> cannot buy 15-Gem emote
    const failRes = await shopService.buyItem('emote_close_one');
    assert.strictEqual(failRes.success, false);
    assert.strictEqual(failRes.error, 'Not enough gems!');

    // Add 30 Gems (total 40) -> buy Close One! (15 Gems) & No Mercy! (20 Gems)
    await playerProfileService.addCurrency(0, 30);

    const buyCloseOne = await shopService.buyItem('emote_close_one');
    assert.strictEqual(buyCloseOne.success, true);
    assert.ok(buyCloseOne.inventory?.ownedItemIds.includes('emote_close_one'));

    const buyNoMercy = await shopService.buyItem('emote_no_mercy');
    assert.strictEqual(buyNoMercy.success, true);
    assert.ok(buyNoMercy.inventory?.ownedItemIds.includes('emote_no_mercy'));

    const profileAfter = await playerProfileService.getProfile();
    assert.strictEqual(profileAfter.gems, 5); // 10 + 30 - 15 - 20

    const unlocked = getUnlockedShopEmotes(buyNoMercy.inventory?.ownedItemIds || []);
    assert.deepStrictEqual(
      unlocked.map((e) => e.id),
      ['emote_close_one', 'emote_no_mercy']
    );
    assert.strictEqual(formatShopEmoteTauntText(unlocked[0]), '😬 Close One!');
    assert.strictEqual(formatShopEmoteTauntText(unlocked[1]), '🔥 No Mercy!');

    // Remote cloud merge accepts new Gem emotes
    const merged = await shopService.mergeInventory(['emote_rematch']);
    assert.ok(merged.ownedItemIds.includes('emote_rematch'));

    const tauntBarSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TauntBar.tsx'),
      'utf8'
    );
    assert.ok(tauntBarSrc.includes('getUnlockedShopEmotes'));
    assert.ok(tauntBarSrc.includes('formatShopEmoteTauntText'));
  });

  test('High-level Shop avatars expose dual Coins + Gems requirements and enforce both currencies', async () => {
    const expectedDual: Array<[string, number, number]> = [
      ['jester', 7500, 5],
      ['flame', 9000, 10],
      ['champ', 11000, 15],
      ['dragon', 13500, 20],
    ];
    for (const [id, coinCost, gemCost] of expectedDual) {
      const item = shopService.getItemById(id);
      assert.ok(item, `Expected Shop avatar ${id}`);
      assert.strictEqual(item.price.currency, 'coins');
      assert.strictEqual(item.price.amount, coinCost);
      assert.strictEqual(item.gemCost, gemCost);
    }

    const shopModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ShopModal.tsx'),
      'utf8'
    );
    const profileModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ProfileModal.tsx'),
      'utf8'
    );
    assert.ok(shopModalSrc.includes('dualGemBadge'));
    assert.ok(shopModalSrc.includes('currentGems >= gemCost'));
    assert.ok(profileModalSrc.includes('pendingUnlockAvatar.gemCost'));
    assert.ok(profileModalSrc.includes('missingGems'));
  });
});
