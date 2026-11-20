// src/services/specialCardsService.ts - Special Cards Catalogue data & pagination helpers
export const SPECIAL_CARDS_TOTAL = 4;

export type SpecialCardKey = 'swap' | 'mute' | 'shield' | 'mirror';

export interface SpecialCardRuleDetail {
  label: string;
  description: string;
}

export interface SpecialCardCatalogItem {
  page: number;
  key: SpecialCardKey;
  shortName: string;
  title: string;
  emoji: string;
  categoryBadge: string;
  deckCountLabel: string;
  accentColor: string;
  accentTintBg: string;
  accentBorderColor: string;
  headline: string;
  details: readonly SpecialCardRuleDetail[];
}

export const getSpecialCardIndicatorText = (page: number): string => {
  return `CARD ${page} OF ${SPECIAL_CARDS_TOTAL}`;
};

export const getSpecialCardNextLabel = (page: number): string => {
  return page === SPECIAL_CARDS_TOTAL ? 'Got It! ✓' : 'Next →';
};

export const clampSpecialCardPage = (requested: number): number => {
  return Math.max(1, Math.min(SPECIAL_CARDS_TOTAL, requested));
};

export const SPECIAL_CARDS_CATALOG: readonly SpecialCardCatalogItem[] = [
  {
    page: 1,
    key: 'swap',
    shortName: 'Swap',
    title: 'RIVAL SWAP',
    emoji: '🔄',
    categoryBadge: 'POWER WILD',
    deckCountLabel: '2 per deck',
    accentColor: '#0F766E',
    accentTintBg: '#F0FDFA',
    accentBorderColor: '#99F6E4',
    headline: 'Steal the strongest low-card hand on the table.',
    details: [
      {
        label: 'Playable Anytime',
        description:
          'Play on any card on your turn, pick the new active color, and trade your entire remaining hand with a target opponent.',
      },
      {
        label: 'Smart 3-Tier Targeting',
        description:
          'Automatically targets the opponent with the fewest cards—breaking ties by highest hand strength, then next in turn order.',
      },
      {
        label: 'Auto RIVAL! Shield',
        description:
          'If swapping leaves you with 1 card, RIVAL! is automatically declared so opponents cannot hit you with a +2 penalty.',
      },
      {
        label: 'Counterable',
        description:
          'Opponents holding a Mirror have 3 seconds to reflect the swap attempt back at you.',
      },
    ],
  },
  {
    page: 2,
    key: 'mute',
    shortName: 'Mute',
    title: 'MUTE',
    emoji: '🔇',
    categoryBadge: 'CONTROL WILD',
    deckCountLabel: '2 per deck',
    accentColor: '#B91C1C',
    accentTintBg: '#FEF2F2',
    accentBorderColor: '#FECACA',
    headline: 'Silence your next rival and lock down their turn.',
    details: [
      {
        label: 'Playable Anytime',
        description:
          'Play on any active card during your turn and pick Red, Blue, Green, or Yellow for the table.',
      },
      {
        label: 'Turn Lockdown',
        description:
          'Silences the next player in rotation and forces them to skip their turn (mute lasts 1 round—or 2 rounds when played as an identical pair!).',
      },
      {
        label: '1v1 Duel Tempo',
        description:
          'In 2-player matches, muting your rival skips them cleanly so play returns straight back to you.',
      },
      {
        label: 'Counterable',
        description:
          'A target holding a Mirror card can bounce the Mute penalty back onto you within 3 seconds.',
      },
    ],
  },
  {
    page: 3,
    key: 'shield',
    shortName: 'Shield',
    title: 'SHIELD',
    emoji: '🛡️',
    categoryBadge: 'DEFENSE WILD',
    deckCountLabel: '2 per deck',
    accentColor: '#1D4ED8',
    accentTintBg: '#EFF6FF',
    accentBorderColor: '#BFDBFE',
    headline: 'Defend against +2 / +4 strikes or play as a Wild.',
    details: [
      {
        label: 'Active Play (Your Turn)',
        description:
          'Play directly from your hand like a standard Wild card anytime to choose the active color.',
      },
      {
        label: '3-Second Reactive Block',
        description:
          'When targeted by Draw Two (+2) or Wild Draw 4 (+4)—including escalated stacks like +6 or +8—tap Shield within 3 seconds to block 100% of the penalty.',
      },
      {
        label: 'Clean Resolution',
        description:
          'Your Shield moves onto the discard pile, zero penalty cards are drawn, and play advances cleanly.',
      },
      {
        label: 'Top Tie-Breaker Tier',
        description:
          'If the 3-minute clock expires tied on card count, Shield counts as a Top-Tier Special (10 pts).',
      },
    ],
  },
  {
    page: 4,
    key: 'mirror',
    shortName: 'Mirror',
    title: 'MIRROR',
    emoji: '🪞',
    categoryBadge: 'REFLECT WILD',
    deckCountLabel: '2 per deck',
    accentColor: '#6D28D9',
    accentTintBg: '#F5F3FF',
    accentBorderColor: '#DDD6FE',
    headline: 'Reflect hostile action cards right back at the attacker.',
    details: [
      {
        label: 'Active Play (Your Turn)',
        description:
          'Play directly from your hand like a Wild card on your turn to change the active table color.',
      },
      {
        label: '3-Second Full Reflection',
        description:
          'When targeted by +2, +4, Skip, Mute, or Rival Swap, tap Mirror within 3 seconds to deflect the entire effect back onto the attacker!',
      },
      {
        label: 'Counter-Mirror Rule',
        description:
          'If the original attacker also holds a Mirror, they can Counter-Mirror once to cancel your reflection—returning the penalty to you (both Mirrors are spent).',
      },
      {
        label: 'Top Tie-Breaker Tier',
        description:
          'Counts as a Top-Tier Special (10 pts) when breaking 3-minute timeout ties.',
      },
    ],
  },
] as const;
