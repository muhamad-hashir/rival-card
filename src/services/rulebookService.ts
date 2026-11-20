// src/services/rulebookService.ts - Streamlined 4-page Rulebook specification (Special Cards live in SpecialCardsModal)
export const RULEBOOK_TOTAL_PAGES = 4;

export const getPageIndicatorText = (page: number): string => {
  return `PAGE ${page} OF ${RULEBOOK_TOTAL_PAGES}`;
};

export const getNextButtonLabel = (page: number): string => {
  return page === RULEBOOK_TOTAL_PAGES ? 'Got It! ✓' : 'Next →';
};

export const clampRulebookPage = (requested: number): number => {
  return Math.max(1, Math.min(RULEBOOK_TOTAL_PAGES, requested));
};

export interface RulebookChapter {
  page: number;
  badge: string;
  title: string;
  subtitle: string;
  topics: string[];
}

export const RULEBOOK_CHAPTERS: readonly RulebookChapter[] = [
  {
    page: 1,
    badge: '🎯 CHAPTER 1',
    title: 'Basics & Objective',
    subtitle: 'Core Goal, Card Matching & Combos',
    topics: [
      'Empty your hand of all cards to win the match',
      'Match by Color (Red, Blue, Green, Yellow), Number (0–9), Symbol, or Wilds',
      'Draw 1 card if stuck; play immediately if valid',
      'Play identical duplicate cards together as a pair combo',
    ],
  },
  {
    page: 2,
    badge: '⚡ CHAPTER 2',
    title: 'Action Cards',
    subtitle: 'Skip, Reverse, and Draw Two Stacking',
    topics: [
      'Skip (⊘): Skips the next player (1v1 gives you another turn)',
      'Reverse (⇄): Flips turn direction (1v1 acts as a Skip)',
      'Draw Two (+2): Next player draws 2 cards or stacks another +2 (+2 → +4 → +6)',
    ],
  },
  {
    page: 3,
    badge: '📣 CHAPTER 3',
    title: 'Wilds & RIVAL! Rules',
    subtitle: 'Wild, +4, RIVAL! Shout & Penalties',
    topics: [
      'Wild Card & Wild Draw 4 (+4): Change active color anytime (+4 is stackable)',
      'RIVAL! Shout: Tap RIVAL! when down to 1 card (2.5s CATCH RIVAL! +2 penalty if missed)',
      'Special Cards Catalogue: Check Special Cards on Home Screen for Swap, Mute, Shield & Mirror',
    ],
  },
  {
    page: 4,
    badge: '⏱️ CHAPTER 4',
    title: '3-Minute Clock & Tie-Breaker',
    subtitle: 'Match Timer & Tie-Breaker Priority',
    topics: [
      '3-Minute Match Timer: Every match runs on a 3:00 clock; at 00:00, fewest cards wins',
      'Tie-Breaker Priority: Specials & Wilds (10 pts) > Actions (Skip, Reverse, +2 = 5 pts) > Numbers (0–9 = 1 pt)',
    ],
  },
] as const;
