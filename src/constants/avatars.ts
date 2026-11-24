// src/constants/avatars.ts - Central 12-Avatar Catalog & Level + Coin Unlock Progression Ladder

export type AvatarKey =
  | 'fox'
  | 'bot'
  | 'panda'
  | 'shield'
  | 'tiger'
  | 'wolf'
  | 'rival'
  | 'ninja'
  | 'jester'
  | 'flame'
  | 'champ'
  | 'dragon';

export type VipAvatarKey =
  | 'robo_king'
  | 'golden_phoenix'
  | 'grand_maester'
  | 'cyber_samurai';

export type AnyAvatarKey = AvatarKey | VipAvatarKey;

export interface AvatarOption {
  id: AvatarKey;
  legacyId: string;
  emoji: string;
  label: string;
  bgColor: string;
  accentColor: string;
  requiredLevel: number;
  coinCost: number;
}

export interface VipAvatarOption {
  id: VipAvatarKey;
  shopId: string;
  emoji: string;
  label: string;
  bgColor: string;
  accentColor: string;
  borderColor: string;
  unlockType: 'iap';
  isRealMoneyExclusive: true;
  comingSoon: true;
  description: string;
}

export interface ResolvedAvatarOption {
  id: AnyAvatarKey;
  emoji: string;
  label: string;
  bgColor: string;
  accentColor: string;
  image: any;
  requiredLevel?: number;
  coinCost?: number;
  isVipExclusive?: boolean;
}

function safePngRequire(loader: () => any): any {
  try {
    return loader();
  } catch {
    // Node `tsx --test` does not parse binary PNG imports; Metro bundler still indexes static require literals.
    return null;
  }
}

export const AVATAR_IMAGES: Readonly<Record<AnyAvatarKey, any>> = {
  fox: safePngRequire(() => require('../../assets/avatars/fox.png')),
  bot: safePngRequire(() => require('../../assets/avatars/bot.png')),
  panda: safePngRequire(() => require('../../assets/avatars/panda.png')),
  shield: safePngRequire(() => require('../../assets/avatars/shield.png')),
  tiger: safePngRequire(() => require('../../assets/avatars/tiger.png')),
  wolf: safePngRequire(() => require('../../assets/avatars/wolf.png')),
  rival: safePngRequire(() => require('../../assets/avatars/rival.png')),
  ninja: safePngRequire(() => require('../../assets/avatars/ninja.png')),
  jester: safePngRequire(() => require('../../assets/avatars/jester.png')),
  flame: safePngRequire(() => require('../../assets/avatars/flame.png')),
  champ: safePngRequire(() => require('../../assets/avatars/champ.png')),
  dragon: safePngRequire(() => require('../../assets/avatars/dragon.png')),
  robo_king: safePngRequire(() => require('../../assets/avatars/robo_king.png')),
  golden_phoenix: safePngRequire(() => require('../../assets/avatars/golden_phoenix.png')),
  grand_maester: safePngRequire(() => require('../../assets/avatars/grand_maester.png')),
  cyber_samurai: safePngRequire(() => require('../../assets/avatars/cyber_samurai.png')),
};

export const AVATAR_ASSET_LIST: readonly any[] = Object.values(AVATAR_IMAGES).filter(Boolean);

export const DEFAULT_AVATAR_ID: AvatarKey = 'fox';
export const DEFAULT_UNLOCKED_AVATARS: readonly AvatarKey[] = ['fox', 'bot'] as const;

export const LEGACY_AVATAR_ID_MAP: Readonly<Record<string, AvatarKey>> = {
  avatar_1: 'fox',
  avatar_2: 'bot',
  avatar_3: 'tiger',
  avatar_4: 'panda',
  avatar_5: 'rival',
  avatar_6: 'champ',
  avatar_7: 'shield',
  avatar_8: 'wolf',
  avatar_9: 'ninja',
  avatar_10: 'jester',
  avatar_11: 'flame',
  avatar_12: 'dragon',
};

export const AVATAR_CATALOG: readonly AvatarOption[] = [
  // Free Starter Avatars (Level 1 • 0 Coins)
  {
    id: 'fox',
    legacyId: 'avatar_1',
    emoji: '🦊',
    label: 'Fox',
    bgColor: '#FED7AA',
    accentColor: '#EA580C',
    requiredLevel: 1,
    coinCost: 0,
  },
  {
    id: 'bot',
    legacyId: 'avatar_2',
    emoji: '🤖',
    label: 'Bot',
    bgColor: '#BAE6FD',
    accentColor: '#0284C7',
    requiredLevel: 1,
    coinCost: 0,
  },
  // Level + Coin Unlockable Ladder (Early starters below Lv. 10, stretched up to Level 40)
  {
    id: 'panda',
    legacyId: 'avatar_4',
    emoji: '🐼',
    label: 'Panda',
    bgColor: '#E2E8F0',
    accentColor: '#334155',
    requiredLevel: 3,
    coinCost: 500,
  },
  {
    id: 'shield',
    legacyId: 'avatar_7',
    emoji: '🛡️',
    label: 'Shield',
    bgColor: '#CFFAFE',
    accentColor: '#0891B2',
    requiredLevel: 7,
    coinCost: 900,
  },
  {
    id: 'tiger',
    legacyId: 'avatar_3',
    emoji: '🐯',
    label: 'Tiger',
    bgColor: '#FEF08A',
    accentColor: '#D97706',
    requiredLevel: 10,
    coinCost: 2000,
  },
  {
    id: 'wolf',
    legacyId: 'avatar_8',
    emoji: '🐺',
    label: 'Wolf',
    bgColor: '#CBD5E1',
    accentColor: '#475569',
    requiredLevel: 15,
    coinCost: 3200,
  },
  {
    id: 'rival',
    legacyId: 'avatar_5',
    emoji: '⚡',
    label: 'Rival',
    bgColor: '#DDD6FE',
    accentColor: '#7C3AED',
    requiredLevel: 20,
    coinCost: 4500,
  },
  {
    id: 'ninja',
    legacyId: 'avatar_9',
    emoji: '🥷',
    label: 'Ninja',
    bgColor: '#FECACA',
    accentColor: '#DC2626',
    requiredLevel: 25,
    coinCost: 6000,
  },
  {
    id: 'jester',
    legacyId: 'avatar_10',
    emoji: '🃏',
    label: 'Jester',
    bgColor: '#FDE68A',
    accentColor: '#B91C1C',
    requiredLevel: 30,
    coinCost: 7500,
  },
  {
    id: 'flame',
    legacyId: 'avatar_11',
    emoji: '🔥',
    label: 'Flame',
    bgColor: '#FFEDD5',
    accentColor: '#EA580C',
    requiredLevel: 35,
    coinCost: 9000,
  },
  {
    id: 'champ',
    legacyId: 'avatar_6',
    emoji: '👑',
    label: 'Champ',
    bgColor: '#FEF3C7',
    accentColor: '#D97706',
    requiredLevel: 38,
    coinCost: 11000,
  },
  {
    id: 'dragon',
    legacyId: 'avatar_12',
    emoji: '🐉',
    label: 'Dragon',
    bgColor: '#FCE7F3',
    accentColor: '#BE123C',
    requiredLevel: 40,
    coinCost: 13500,
  },
] as const;

export const VIP_AVATAR_ALIAS_MAP: Readonly<Record<string, VipAvatarKey>> = {
  robo_king: 'robo_king',
  avatar_robo_king: 'robo_king',
  golden_phoenix: 'golden_phoenix',
  avatar_golden_phoenix: 'golden_phoenix',
  grand_maester: 'grand_maester',
  avatar_grand_maester: 'grand_maester',
  cyber_samurai: 'cyber_samurai',
  avatar_cyber_samurai: 'cyber_samurai',
};

export const VIP_AVATAR_CATALOG: readonly VipAvatarOption[] = [
  {
    id: 'robo_king',
    shopId: 'avatar_robo_king',
    emoji: '🤖👑',
    label: 'Robo King',
    bgColor: '#DBEAFE',
    accentColor: '#1D4ED8',
    borderColor: '#1D4ED8',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    description: 'Crowned sovereign forged in brushed titanium and royal gold.',
  },
  {
    id: 'golden_phoenix',
    shopId: 'avatar_golden_phoenix',
    emoji: '🦅🔥',
    label: 'Golden Phoenix',
    bgColor: '#FEF3C7',
    accentColor: '#D97706',
    borderColor: '#D97706',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    description: 'Radiant firebird rising with layered golden-crimson plumage.',
  },
  {
    id: 'grand_maester',
    shopId: 'avatar_grand_maester',
    emoji: '🧙‍♂️✨',
    label: 'Grand Maester',
    bgColor: '#E0E7FF',
    accentColor: '#4338CA',
    borderColor: '#4338CA',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    description: 'Arcane card-master draped in an indigo & gold-trimmed mantle.',
  },
  {
    id: 'cyber_samurai',
    shopId: 'avatar_cyber_samurai',
    emoji: '🥷⚡',
    label: 'Cyber Samurai',
    bgColor: '#FFE4E6',
    accentColor: '#BE123C',
    borderColor: '#BE123C',
    unlockType: 'iap',
    isRealMoneyExclusive: true,
    comingSoon: true,
    description: 'Armored neon duelists wearing a horned crimson kabuto crest.',
  },
] as const;

const AVATAR_BY_KEY: Readonly<Record<AvatarKey, AvatarOption>> = AVATAR_CATALOG.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AvatarKey, AvatarOption>
);

const VIP_AVATAR_BY_KEY: Readonly<Record<VipAvatarKey, VipAvatarOption>> =
  VIP_AVATAR_CATALOG.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<VipAvatarKey, VipAvatarOption>
  );

/**
 * Normalizes either a canonical AvatarKey ('fox', 'dragon') or a legacy ID ('avatar_1'..'avatar_12')
 * into a canonical AvatarKey, or returns null if unrecognized (excludes VIP IAP exclusives).
 */
export function normalizeAvatarKey(avatarId?: string | null): AvatarKey | null {
  if (!avatarId || typeof avatarId !== 'string') return null;
  const cleaned = avatarId.trim().toLowerCase();
  if (cleaned in AVATAR_BY_KEY) {
    return cleaned as AvatarKey;
  }
  if (cleaned in LEGACY_AVATAR_ID_MAP) {
    return LEGACY_AVATAR_ID_MAP[cleaned];
  }
  return null;
}

/**
 * Normalizes any progression AvatarKey, legacy ID, or VIP Store avatar key/shop ID.
 */
export function normalizeAnyAvatarKey(avatarId?: string | null): AnyAvatarKey | null {
  const standard = normalizeAvatarKey(avatarId);
  if (standard) return standard;
  if (!avatarId || typeof avatarId !== 'string') return null;
  const cleaned = avatarId.trim().toLowerCase();
  if (cleaned in VIP_AVATAR_ALIAS_MAP) {
    return VIP_AVATAR_ALIAS_MAP[cleaned];
  }
  return null;
}

/**
 * Returns the strict progression AvatarOption for an unlocked/unlockable AvatarKey.
 */
export function getProgressionAvatarConfig(key: AvatarKey): AvatarOption {
  return AVATAR_BY_KEY[key] || AVATAR_BY_KEY[DEFAULT_AVATAR_ID];
}

/**
 * Returns the strict PNG asset source for any canonical key, legacy ID ('avatar_1'..'avatar_12'),
 * or VIP shop ID, falling back cleanly to 'fox'.
 */
export function getAvatarImageSource(avatarId?: string | null): any {
  const key = normalizeAnyAvatarKey(avatarId);
  if (key && AVATAR_IMAGES[key]) {
    return AVATAR_IMAGES[key];
  }
  return AVATAR_IMAGES[DEFAULT_AVATAR_ID];
}

/**
 * Resolves avatar metadata for any progression avatar, legacy ID, or VIP Store avatar,
 * falling back cleanly to 'fox'.
 */
export function getAvatarConfig(avatarId?: string | null): ResolvedAvatarOption {
  const key = normalizeAnyAvatarKey(avatarId);
  if (key && key in AVATAR_BY_KEY) {
    const base = AVATAR_BY_KEY[key as AvatarKey];
    return {
      ...base,
      image: AVATAR_IMAGES[base.id],
    };
  }
  if (key && key in VIP_AVATAR_BY_KEY) {
    const vip = VIP_AVATAR_BY_KEY[key as VipAvatarKey];
    return {
      id: vip.id,
      emoji: vip.emoji,
      label: vip.label,
      bgColor: vip.bgColor,
      accentColor: vip.accentColor,
      image: AVATAR_IMAGES[vip.id],
      isVipExclusive: true,
    };
  }
  const fallback = AVATAR_BY_KEY[DEFAULT_AVATAR_ID];
  return {
    ...fallback,
    image: AVATAR_IMAGES[fallback.id],
  };
}

/**
 * Normalizes an array of unlocked avatars, always guaranteeing free starters ('fox', 'bot')
 * and preserving any legacy equipped avatar so existing players are never locked out.
 */
export function normalizeUnlockedAvatars(
  rawUnlocked?: unknown,
  equippedAvatarId?: string | null
): AvatarKey[] {
  const unlockedSet = new Set<AvatarKey>(DEFAULT_UNLOCKED_AVATARS);

  if (Array.isArray(rawUnlocked)) {
    for (const item of rawUnlocked) {
      if (typeof item === 'string') {
        const key = normalizeAvatarKey(item);
        if (key) unlockedSet.add(key);
      }
    }
  }

  // Legacy safety: always preserve the currently equipped avatar if valid
  const equippedKey = normalizeAvatarKey(equippedAvatarId);
  if (equippedKey) {
    unlockedSet.add(equippedKey);
  }

  // Keep deterministic catalog order
  return AVATAR_CATALOG.filter((a) => unlockedSet.has(a.id)).map((a) => a.id);
}

export function isAvatarUnlocked(
  unlockedAvatars: readonly string[] | undefined,
  avatarId: string
): boolean {
  const key = normalizeAvatarKey(avatarId);
  if (!key) return false;
  if (DEFAULT_UNLOCKED_AVATARS.includes(key)) return true;
  if (!Array.isArray(unlockedAvatars)) return false;
  return unlockedAvatars.some((entry) => normalizeAvatarKey(entry) === key);
}
