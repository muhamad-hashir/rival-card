// src/services/shopService.ts - Cosmetics catalog, inventory tracking, and purchasing service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playerProfileService } from './playerProfileService';

export type ShopCategory = 'card_backs' | 'sceneries' | 'avatars' | 'cards' | 'emotes';

export interface ShopItemPrice {
  currency: 'coins' | 'gems';
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
  isDefault?: boolean;
  isLocked?: boolean;
  purchasesUnavailable?: boolean;
  previewStyle: ShopItemPreviewStyle;
  description?: string;
}

export interface CategoryMeta {
  key: ShopCategory;
  label: string;
  icon: string;
}

export const SHOP_CATEGORIES: readonly CategoryMeta[] = [
  { key: 'card_backs', label: 'Card Backs', icon: '🎴' },
  { key: 'sceneries', label: 'Sceneries', icon: '🏞️' },
  { key: 'avatars', label: 'Avatars', icon: '👤' },
  { key: 'cards', label: 'Cards', icon: '🃏' },
  { key: 'emotes', label: 'Emotes', icon: '💬' },
] as const;

export const SHOP_CATALOG: readonly ShopItem[] = [
  // --- CARD BACKS ---
  {
    id: 'card_back_classic',
    name: 'Classic Slate',
    category: 'card_backs',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
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
    price: { currency: 'coins', amount: 5000 },
    isLocked: true,
    purchasesUnavailable: true,
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
    price: { currency: 'coins', amount: 7500 },
    isLocked: true,
    purchasesUnavailable: true,
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
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#06B6D4',
      secondaryColor: '#22D3EE',
      borderColor: '#0891B2',
    },
    description: 'Electric cyan glow pulled straight from cyberspace.',
  },

  // --- SCENERIES (TABLE FELT) ---
  {
    id: 'scenery_meadow',
    name: 'Meadow Green',
    category: 'sceneries',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
    previewStyle: {
      primaryColor: '#15803D',
      secondaryColor: '#16A34A',
      borderColor: '#14532D',
    },
    description: 'Fresh emerald meadow felt for classic card matches.',
  },
  {
    id: 'scenery_midnight',
    name: 'Midnight Table',
    category: 'sceneries',
    price: { currency: 'coins', amount: 5000 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#0F172A',
      secondaryColor: '#1E293B',
      borderColor: '#334155',
    },
    description: 'Deep starlit table felt for late night rival showdowns.',
  },
  {
    id: 'scenery_royal',
    name: 'Royal Velvet',
    category: 'sceneries',
    price: { currency: 'gems', amount: 50 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#581C87',
      secondaryColor: '#7E22CE',
      borderColor: '#3B0764',
    },
    description: 'Velvety imperial purple table reserved for grandmasters.',
  },

  // --- AVATARS ---
  {
    id: 'avatar_1',
    name: 'Guest Fox',
    category: 'avatars',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
    previewStyle: {
      primaryColor: '#FED7AA',
      emoji: '🦊',
      borderColor: '#FB923C',
    },
    description: 'Swift and clever fox avatar.',
  },
  {
    id: 'avatar_2',
    name: 'Guest Bot',
    category: 'avatars',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
    previewStyle: {
      primaryColor: '#BAE6FD',
      emoji: '🤖',
      borderColor: '#38BDF8',
    },
    description: 'Calculated algorithmic automaton.',
  },
  {
    id: 'avatar_robo_king',
    name: 'Robo King',
    category: 'avatars',
    price: { currency: 'coins', amount: 6000 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#3B82F6',
      emoji: '👑🤖',
      borderColor: '#1D4ED8',
    },
    description: 'Crowned sovereign of mechanical logic.',
  },
  {
    id: 'avatar_golden_phoenix',
    name: 'Golden Phoenix',
    category: 'avatars',
    price: { currency: 'gems', amount: 60 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#F59E0B',
      emoji: '🦅✨',
      borderColor: '#D97706',
    },
    description: 'Legendary radiant bird born from golden ashes.',
  },

  // --- CARDS (CARD FACE THEMES) ---
  {
    id: 'cards_standard',
    name: 'Classic',
    category: 'cards',
    price: { currency: 'coins', amount: 0 },
    isDefault: true,
    previewStyle: {
      primaryColor: '#FFFDF7',
      secondaryColor: '#FEF6E9',
      borderColor: '#E2D9C8',
    },
    description: 'Crisp warm cartoon face deck styling.',
  },
  {
    id: 'cards_minimalist',
    name: 'Minimalist Flat',
    category: 'cards',
    price: { currency: 'coins', amount: 5000 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#F8FAFC',
      secondaryColor: '#E2E8F0',
      borderColor: '#94A3B8',
    },
    description: 'Clean modern aesthetic with muted slate accents.',
  },
  {
    id: 'cards_retro',
    name: 'Retro Comic',
    category: 'cards',
    price: { currency: 'gems', amount: 50 },
    isLocked: true,
    purchasesUnavailable: true,
    previewStyle: {
      primaryColor: '#FEF08A',
      secondaryColor: '#FDE047',
      borderColor: '#F59E0B',
    },
    description: 'Vibrant pop-art halftone paper inspired by vintage comics.',
  },

  // --- EMOTES / QUICK CHAT (HIGH-STAKES COIN SINKS) ---
  {
    id: 'emote_thinking',
    name: 'Thinking...',
    category: 'emotes',
    price: { currency: 'coins', amount: 1200 },
    previewStyle: {
      primaryColor: '#3B82F6',
      text: 'Thinking...',
      borderColor: '#1D4ED8',
    },
    description: 'Signal to opponents that you are plotting a 4-move mastermind turn.',
  },
  {
    id: 'emote_oops',
    name: 'Oops!',
    category: 'emotes',
    price: { currency: 'coins', amount: 1500 },
    previewStyle: {
      primaryColor: '#EF4444',
      text: 'Oops!',
      borderColor: '#B91C1C',
    },
    description: 'Playful mistake confession when plans go sideways.',
  },
  {
    id: 'emote_gg',
    name: 'GG!',
    category: 'emotes',
    price: { currency: 'coins', amount: 2000 },
    previewStyle: {
      primaryColor: '#22C55E',
      text: 'GG!',
      borderColor: '#15803D',
    },
    description: 'Good Game! Show ultimate respect to worthy rivals.',
  },
  {
    id: 'emote_nice_try',
    name: 'Nice Try!',
    category: 'emotes',
    price: { currency: 'coins', amount: 2500 },
    previewStyle: {
      primaryColor: '#F59E0B',
      text: 'Nice Try!',
      borderColor: '#D97706',
    },
    description: 'Cheeky reaction after surviving a Wild Draw 4 attack.',
  },
] as const;

export interface PlayerInventory {
  ownedItemIds: string[];
  equippedItems: Record<ShopCategory, string>;
}

export const INVENTORY_STORAGE_KEY = '@rivalcard:inventory';

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
    sceneries: 'scenery_meadow',
    avatars: 'avatar_1',
    cards: 'cards_standard',
    emotes: '',
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
        // Ensure defaults are present in owned item list
        const ownedSet = new Set<string>([
          ...DEFAULT_INVENTORY.ownedItemIds,
          ...(parsed.ownedItemIds || []),
        ]);

        const inventory: PlayerInventory = {
          ownedItemIds: Array.from(ownedSet),
          equippedItems: {
            ...DEFAULT_INVENTORY.equippedItems,
            ...(parsed.equippedItems || {}),
          },
        };

        this.cachedInventory = inventory;
        return inventory;
      }
    } catch (err) {
      console.warn('Failed to load shop inventory from storage:', err);
    }

    this.cachedInventory = { ...DEFAULT_INVENTORY };
    await storageSet(INVENTORY_STORAGE_KEY, JSON.stringify(this.cachedInventory));
    return this.cachedInventory;
  }

  /**
   * Purchase an item from the shop.
   * If item is locked or purchases unavailable, rejects with global launch notice.
   * Deducts currency and equips the newly bought item.
   */
  public async buyItem(
    itemId: string
  ): Promise<{ success: boolean; error?: string; inventory?: PlayerInventory }> {
    const item = this.getItemById(itemId);
    if (!item) {
      return { success: false, error: 'Item not found in catalog' };
    }

    if (item.purchasesUnavailable || item.isLocked) {
      return {
        success: false,
        error: 'Store testing mode: Premium unlocks will be available at global launch!',
      };
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
    const current = await this.getInventory();
    const mergedOwned = Array.from(new Set([...current.ownedItemIds, ...remoteItemIds]));
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
    this.cachedInventory = { ...DEFAULT_INVENTORY };
    this.notify();
    return this.cachedInventory;
  }
}

export const shopService = new ShopService();
