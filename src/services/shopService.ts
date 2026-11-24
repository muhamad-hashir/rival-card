// src/services/shopService.ts - Cosmetics catalog, currency packs, inventory tracking, and purchasing service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playerProfileService } from './playerProfileService';
import {
  AVATAR_CATALOG,
  DEFAULT_AVATAR_ID,
  VIP_AVATAR_CATALOG,
} from '../constants/avatars';

export type ShopCategory = 'card_backs' | 'avatars' | 'emotes' | 'currency';

export type ShopUnlockType = 'coins' | 'gems' | 'level_coins' | 'iap';

export interface ShopItemPrice {
  currency: 'coins' | 'gems' | 'usd';
  amount: number;
}

export interface ShopItemPreviewStyle {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  borderColor?: string;
  emoji?: string;
  text?: string;
  gradient?: string[];
}

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: ShopItemPrice;
  usdPrice?: string;
  packType?: 'coins' | 'gems';
  packAmount?: number;
  googlePlayProductId?: string;
  isDefault?: boolean;
  isLocked?: boolean;
  purchasesUnavailable?: boolean;
  unlockType?: ShopUnlockType;
  isRealMoneyExclusive?: boolean;
  comingSoon?: boolean;
  requiredLevel?: number;
  avatarKey?: string;
  image?: any;
  previewStyle: ShopItemPreviewStyle;
  description?: string;
}

function safePngRequire(loader: () => any): any {
  try {
    return loader();
  } catch {
    // Node `tsx --test` does not parse binary PNG imports; Metro bundler still indexes static require literals.
    return null;
  }
}

export const STORE_ITEM_IMAGES: Readonly<Record<string, any>> = {
  card_back_classic: safePngRequire(() => require('../../assets/store/card_backs/classic_back.png')),
  card_back_crimson: safePngRequire(() => require('../../assets/store/card_backs/crimson_flame.png')),
  card_back_golden: safePngRequire(() => require('../../assets/store/card_backs/golden_rim.png')),
  card_back_cyber: safePngRequire(() => require('../../assets/store/card_backs/cyber_neon.png')),
};

export function getShopItemImageSource(itemId: string): any {
  return STORE_ITEM_IMAGES[itemId] ?? null;
}

export interface CategoryMeta {
  key: ShopCategory;
  label: string;
  icon: string;
}

export const SHOP_CATEGORIES: readonly CategoryMeta[] = [
  { key: 'card_backs', label: 'Card Backs', icon: '🎴' },
  { key: 'avatars', label: 'Avatars', icon: '👤' },
  { key: 'emotes', label: 'Emotes', icon: '💬' },
  { key: 'currency', label: 'Coins & Gems', icon: '💰' },
] as const;

export const SHOP_CATALOG: readonly ShopItem[] = [
  // --- CARD BACKS ---
  {
    id: 'card_back_classic',
    name: 'Classic Slate',
    category: 'card_backs',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
    image: STORE_ITEM_IMAGES.card_back_classic,
    previewStyle: {
      primaryColor: '#1E293B',
      secondaryColor: '#334155',
      borderColor: '#475569',
    },
    description: 'The standard slate navy card back for seasoned card rivals.',
  },
  {
    id: 'card_back_crimson',
    name: 'Crimson Flame',
    category: 'card_backs',
    price: { currency: 'coins', amount: 8000 },
    image: STORE_ITEM_IMAGES.card_back_crimson,
    previewStyle: {
      primaryColor: '#DC2626',
      secondaryColor: '#EF4444',
      borderColor: '#B91C1C',
    },
    description: 'Blazing red finish that radiates confidence and heat.',
  },
  {
    id: 'card_back_golden',
    name: 'Golden Rim',
    category: 'card_backs',
    price: { currency: 'coins', amount: 12000 },
    image: STORE_ITEM_IMAGES.card_back_golden,
    previewStyle: {
      primaryColor: '#CA8A04',
      secondaryColor: '#FACC15',
      borderColor: '#EAB308',
    },
    description: 'Luxurious brushed gold trim fit for champions.',
  },
  {
    id: 'card_back_cyber',
    name: 'Cyber Neon',
    category: 'card_backs',
    price: { currency: 'gems', amount: 50 },
    image: STORE_ITEM_IMAGES.card_back_cyber,
    previewStyle: {
      primaryColor: '#06B6D4',
      secondaryColor: '#22D3EE',
      borderColor: '#0891B2',
    },
    description: 'Electric cyan glow pulled straight from cyberspace.',
  },

  // --- AVATARS (EXCLUDES STARTER 'fox' & 'bot'; VIP STORE EXCLUSIVES + LEVEL/COIN UNLOCKABLES) ---
  ...VIP_AVATAR_CATALOG.map(
    (vip): ShopItem => ({
      id: vip.shopId,
      avatarKey: vip.id,
      name: vip.label,
      category: 'avatars',
      price: { currency: 'gems', amount: 0 },
      unlockType: 'iap',
      isRealMoneyExclusive: true,
      comingSoon: true,
      isLocked: true,
      purchasesUnavailable: true,
      previewStyle: {
        primaryColor: vip.bgColor,
        accentColor: vip.accentColor,
        borderColor: vip.borderColor,
        emoji: vip.emoji,
      },
      description: vip.description,
    })
  ),
  ...AVATAR_CATALOG.filter((avatar) => avatar.coinCost > 0).map(
    (avatar): ShopItem => ({
      id: avatar.id,
      avatarKey: avatar.id,
      name: avatar.label,
      category: 'avatars',
      price: { currency: 'coins', amount: avatar.coinCost },
      unlockType: 'level_coins',
      requiredLevel: avatar.requiredLevel,
      previewStyle: {
        primaryColor: avatar.bgColor,
        accentColor: avatar.accentColor,
        borderColor: avatar.accentColor,
        emoji: avatar.emoji,
      },
      description: `Unlocks at Level ${avatar.requiredLevel} for ${avatar.coinCost.toLocaleString()} Coins.`,
    })
  ),

  // --- EMOTES / QUICK CHAT (CLEAN STANDARD QUICK-CHAT BUBBLES) ---
  {
    id: 'emote_thinking',
    name: 'Thinking...',
    category: 'emotes',
    price: { currency: 'coins', amount: 1200 },
    previewStyle: {
      primaryColor: '#3B82F6',
      borderColor: '#1D4ED8',
      emoji: '🤔',
      text: 'Thinking...',
    },
    description: 'Signal to opponents that you are plotting a 4-move mastermind turn.',
  },
  {
    id: 'emote_oops',
    name: 'Oops!',
    category: 'emotes',
    price: { currency: 'coins', amount: 2000 },
    previewStyle: {
      primaryColor: '#EF4444',
      borderColor: '#B91C1C',
      emoji: '😅',
      text: 'Oops!',
    },
    description: 'Playful mistake confession when plans go sideways.',
  },
  {
    id: 'emote_gg',
    name: 'GG!',
    category: 'emotes',
    price: { currency: 'coins', amount: 3200 },
    previewStyle: {
      primaryColor: '#22C55E',
      borderColor: '#15803D',
      emoji: '🤝',
      text: 'GG!',
    },
    description: 'Good Game! Show ultimate respect to worthy rivals.',
  },
  {
    id: 'emote_nice_try',
    name: 'Nice Try!',
    category: 'emotes',
    price: { currency: 'coins', amount: 4500 },
    previewStyle: {
      primaryColor: '#F59E0B',
      borderColor: '#D97706',
      emoji: '😏',
      text: 'Nice Try!',
    },
    description: 'Cheeky reaction after surviving a Wild Draw 4 attack.',
  },

  // --- COINS & GEMS PACKS (GOOGLE PLAY BILLING READY - COMING SOON v1.2.0) ---
  {
    id: 'pack_coins_starter',
    name: 'Starter Pouch',
    category: 'currency',
    price: { currency: 'usd', amount: 0.99 },
    usdPrice: '$0.99 USD',
    packType: 'coins',
    packAmount: 1500,
    googlePlayProductId: 'com.hashir.rivalcard.coins_1500',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#FEF3C7',
      secondaryColor: '#F59E0B',
      borderColor: '#D97706',
      emoji: '🪙',
      text: '1,500 Coins',
    },
    description: '1,500 Coins to kickstart your Rival collection.',
  },
  {
    id: 'pack_coins_stash',
    name: 'Rival Stash',
    category: 'currency',
    price: { currency: 'usd', amount: 1.99 },
    usdPrice: '$1.99 USD',
    packType: 'coins',
    packAmount: 3500,
    googlePlayProductId: 'com.hashir.rivalcard.coins_3500',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#FDE68A',
      secondaryColor: '#F59E0B',
      borderColor: '#B45309',
      emoji: '💰',
      text: '3,500 Coins',
    },
    description: '3,500 Coins with bonus value for regular challengers.',
  },
  {
    id: 'pack_coins_vault',
    name: 'Champion Vault',
    category: 'currency',
    price: { currency: 'usd', amount: 2.99 },
    usdPrice: '$2.99 USD',
    packType: 'coins',
    packAmount: 6000,
    googlePlayProductId: 'com.hashir.rivalcard.coins_6000',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#FCD34D',
      secondaryColor: '#D97706',
      borderColor: '#92400E',
      emoji: '🏆',
      text: '6,000 Coins',
    },
    description: '6,000 Coins — best coin value for high-stakes rivals.',
  },
  {
    id: 'pack_gems_handful',
    name: 'Handful of Gems',
    category: 'currency',
    price: { currency: 'usd', amount: 0.99 },
    usdPrice: '$0.99 USD',
    packType: 'gems',
    packAmount: 30,
    googlePlayProductId: 'com.hashir.rivalcard.gems_30',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#E0F2FE',
      secondaryColor: '#0EA5E9',
      borderColor: '#0284C7',
      emoji: '💎',
      text: '30 Gems',
    },
    description: '30 Gems for premium card backs and future drops.',
  },
  {
    id: 'pack_gems_satchel',
    name: 'Gem Satchel',
    category: 'currency',
    price: { currency: 'usd', amount: 1.99 },
    usdPrice: '$1.99 USD',
    packType: 'gems',
    packAmount: 75,
    googlePlayProductId: 'com.hashir.rivalcard.gems_75',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#BAE6FD',
      secondaryColor: '#0284C7',
      borderColor: '#0369A1',
      emoji: '💠',
      text: '75 Gems',
    },
    description: '75 Gems packed for Cyber Neon & upcoming exclusives.',
  },
  {
    id: 'pack_gems_chest',
    name: 'Royal Gem Chest',
    category: 'currency',
    price: { currency: 'usd', amount: 2.99 },
    usdPrice: '$2.99 USD',
    packType: 'gems',
    packAmount: 130,
    googlePlayProductId: 'com.hashir.rivalcard.gems_130',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#7DD3FC',
      secondaryColor: '#0369A1',
      borderColor: '#075985',
      emoji: '👑',
      text: '130 Gems',
    },
    description: '130 Gems — maximum gem haul for grandmasters.',
  },
] as const;

export interface PlayerInventory {
  ownedItemIds: string[];
  equippedItems: Record<ShopCategory, string>;
}

export const INVENTORY_STORAGE_KEY = '@rivalcard:inventory';

export const IAP_UNAVAILABLE_MESSAGE =
  'In-app purchases will unlock once Rival Card goes live on Google Play!';

const memoryStorage: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
    const val = await AsyncStorage.getItem(key);
    if (val !== null) return val;
    return memoryStorage[key] || null;
  } catch {
    return memoryStorage[key] || null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  memoryStorage[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

async function storageRemove(key: string): Promise<void> {
  delete memoryStorage[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const DEFAULT_INVENTORY: PlayerInventory = {
  ownedItemIds: SHOP_CATALOG.filter((i) => i.isDefault).map((i) => i.id),
  equippedItems: {
    card_backs: 'card_back_classic',
    avatars: DEFAULT_AVATAR_ID,
    emotes: '',
    currency: '',
  },
};

type InventorySubscriber = (inventory: PlayerInventory) => void;

class ShopService {
  private cachedInventory: PlayerInventory | null = null;
  private subscribers: Set<InventorySubscriber> = new Set();

  /**
   * Returns all items for a given category.
   */
  public getItemsByCategory(category: ShopCategory): ShopItem[] {
    return SHOP_CATALOG.filter((item) => item.category === category);
  }

  /**
   * Finds a shop item by its ID.
   */
  public getItemById(id: string): ShopItem | undefined {
    return SHOP_CATALOG.find((item) => item.id === id);
  }

  /**
   * Loads and caches the player's inventory.
   */
  public async getInventory(forceReload = false): Promise<PlayerInventory> {
    if (this.cachedInventory && !forceReload) {
      return this.cachedInventory;
    }

    try {
      const raw = await storageGet(INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validIds = new Set(SHOP_CATALOG.map((item) => item.id));
        const persistedOwned = Array.isArray(parsed.ownedItemIds)
          ? parsed.ownedItemIds.filter((id: string) => validIds.has(id))
          : [];
        const ownedSet = new Set<string>([
          ...DEFAULT_INVENTORY.ownedItemIds,
          ...persistedOwned,
        ]);

        const rawEquipped = parsed.equippedItems || {};
        const equippedCardBack =
          typeof rawEquipped.card_backs === 'string' && this.getItemById(rawEquipped.card_backs)
            ? rawEquipped.card_backs
            : DEFAULT_INVENTORY.equippedItems.card_backs;

        const inventory: PlayerInventory = {
          ownedItemIds: Array.from(ownedSet),
          equippedItems: {
            card_backs: equippedCardBack,
            avatars:
              typeof rawEquipped.avatars === 'string' && rawEquipped.avatars
                ? rawEquipped.avatars
                : DEFAULT_INVENTORY.equippedItems.avatars,
            emotes:
              typeof rawEquipped.emotes === 'string' && this.getItemById(rawEquipped.emotes)
                ? rawEquipped.emotes
                : '',
            currency: '',
          },
        };

        this.cachedInventory = inventory;
        return inventory;
      }
    } catch (err) {
      console.warn('Failed to load shop inventory from storage:', err);
    }

    this.cachedInventory = {
      ownedItemIds: [...DEFAULT_INVENTORY.ownedItemIds],
      equippedItems: { ...DEFAULT_INVENTORY.equippedItems },
    };
    await storageSet(INVENTORY_STORAGE_KEY, JSON.stringify(this.cachedInventory));
    return this.cachedInventory;
  }

  /**
   * Purchase an item from the shop.
   * Gates IAP / currency packs until Google Play Billing is enabled.
   * Deducts currency and equips the newly bought item.
   */
  public async buyItem(
    itemId: string
  ): Promise<{ success: boolean; error?: string; inventory?: PlayerInventory }> {
    const item = this.getItemById(itemId);
    if (!item) {
      return { success: false, error: 'Item not found in catalog' };
    }

    if (item.category === 'currency') {
      return {
        success: false,
        error: IAP_UNAVAILABLE_MESSAGE,
      };
    }

    if (item.isRealMoneyExclusive || item.comingSoon || item.unlockType === 'iap') {
      return {
        success: false,
        error: 'Real-money Store & VIP packs coming in the next update!',
      };
    }

    if (item.purchasesUnavailable || item.isLocked) {
      return {
        success: false,
        error: 'Store testing mode: Premium unlocks will be available at global launch!',
      };
    }

    if (item.unlockType === 'level_coins' && item.avatarKey) {
      const unlockRes = await playerProfileService.unlockAvatar(item.avatarKey);
      if (!unlockRes.success) {
        return {
          success: false,
          error: unlockRes.error || 'Unable to unlock avatar.',
        };
      }
      const inventory = await this.getInventory();
      return { success: true, inventory };
    }

    const inventory = await this.getInventory();

    // Already owned
    if (inventory.ownedItemIds.includes(itemId)) {
      if (inventory.equippedItems[item.category] !== itemId) {
        await this.equipItem(item.category, itemId);
      }
      return { success: true, inventory: this.cachedInventory || inventory };
    }

    // Currency deduction
    const coinsNeeded = item.price.currency === 'coins' ? item.price.amount : 0;
    const gemsNeeded = item.price.currency === 'gems' ? item.price.amount : 0;

    const deducted = await playerProfileService.deductCurrency(coinsNeeded, gemsNeeded);
    if (!deducted) {
      const currencyLabel = item.price.currency === 'coins' ? 'coins' : 'gems';
      return { success: false, error: `Not enough ${currencyLabel}!` };
    }

    // Add to owned list and auto-equip
    const updatedOwned = Array.from(new Set([...inventory.ownedItemIds, itemId]));
    const updatedEquipped = {
      ...inventory.equippedItems,
      [item.category]: itemId,
    };

    const updated: PlayerInventory = {
      ownedItemIds: updatedOwned,
      equippedItems: updatedEquipped,
    };

    this.cachedInventory = updated;
    await storageSet(INVENTORY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();

    return { success: true, inventory: updated };
  }

  /**
   * Equips an owned item.
   */
  public async equipItem(category: ShopCategory, itemId: string): Promise<PlayerInventory> {
    const inventory = await this.getInventory();

    if (!inventory.ownedItemIds.includes(itemId)) {
      throw new Error(`Cannot equip unowned item: ${itemId}`);
    }

    const updated: PlayerInventory = {
      ...inventory,
      equippedItems: {
        ...inventory.equippedItems,
        [category]: itemId,
      },
    };

    this.cachedInventory = updated;
    await storageSet(INVENTORY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();

    return updated;
  }

  /**
   * Returns the currently equipped ShopItem for a given category.
   */
  public async getEquippedItem(category: ShopCategory): Promise<ShopItem> {
    const inventory = await this.getInventory();
    const equippedId = inventory.equippedItems[category] || DEFAULT_INVENTORY.equippedItems[category];
    const item = this.getItemById(equippedId);
    if (item) return item;

    // Fallback to default item for this category
    const defaultItem = SHOP_CATALOG.find((i) => i.category === category && i.isDefault);
    return defaultItem || SHOP_CATALOG[0];
  }

  /**
   * Merges remote item IDs into local inventory, preserving all existing items.
   */
  public async mergeInventory(remoteItemIds: string[]): Promise<PlayerInventory> {
    if (!remoteItemIds || !Array.isArray(remoteItemIds) || remoteItemIds.length === 0) {
      return this.getInventory();
    }
    const validIds = new Set(SHOP_CATALOG.map((item) => item.id));
    const filteredRemote = remoteItemIds.filter((id) => validIds.has(id));
    const current = await this.getInventory();
    const mergedOwned = Array.from(new Set([...current.ownedItemIds, ...filteredRemote]));
    const updated: PlayerInventory = {
      ...current,
      ownedItemIds: mergedOwned,
    };
    this.cachedInventory = updated;
    await storageSet(INVENTORY_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  /**
   * Subscribes to inventory mutations.
   */
  public subscribe(listener: InventorySubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    if (!this.cachedInventory) return;
    for (const listener of this.subscribers) {
      try {
        listener(this.cachedInventory);
      } catch (err) {
        console.warn('Shop subscriber error:', err);
      }
    }
  }

  /**
   * Resets inventory to defaults (for tests or guest reset).
   */
  public async resetInventory(): Promise<PlayerInventory> {
    await storageRemove(INVENTORY_STORAGE_KEY);
    this.cachedInventory = {
      ownedItemIds: [...DEFAULT_INVENTORY.ownedItemIds],
      equippedItems: { ...DEFAULT_INVENTORY.equippedItems },
    };
    this.notify();
    return this.cachedInventory;
  }
}

export const shopService = new ShopService();
