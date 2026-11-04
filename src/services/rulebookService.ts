// src/services/rulebookService.ts - Rulebook specification, chapter data, and navigation helpers
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
    title: 'Objective & Basics',
    subtitle: 'Core Goal, Card Matching & Draw Rules',
    topics: [
      'Empty your hand of all cards to win the match',
      'Match by Color (Red, Blue, Green, Yellow)',
      'Match by Number (0 through 9)',
      'Match by Symbol (Skip, Reverse, Draw 2)',
      'Wild cards can be played on any card anytime',
      'Draw 1 card if stuck; play immediately if valid',
    ],
  },
  {
    page: 2,
    badge: '⚡ CHAPTER 2',
    title: 'Action Cards',
    subtitle: 'Skip, Reverse, and Draw Two Mechanics',
    topics: [
      'Skip (⊘): Skips the next player in rotation',
      'Reverse (⇄): Inverts rotation direction (clockwise ↔ counter-clockwise)',
      'Draw Two (+2): Forces next player to draw 2 cards and forfeit their turn',
      '1v1 Skip: Grants you another turn immediately',
      '1v1 Reverse: Functions as a Skip, giving you another turn',
      '1v1 Draw Two: Rival draws 2 cards and turn returns to you',
    ],
  },
  {
    page: 3,
    badge: '🌈 CHAPTER 3',
    title: 'Wilds & Specials',
    subtitle: 'Wild Card, Wild Draw 4, Mute & Rival Swap',
    topics: [
      'Wild Card: Playable on any turn; choose the active color',
      '4 Colors: Red, Blue, Green, Yellow',
      'Wild Draw 4 (+4): Choose color + force next player to draw 4 and skip',
      'Mute: Silences an opponent, skipping their turn',
      'Rival Swap: Swaps your hand with the player holding the fewest cards',
    ],
  },
  {
    page: 4,
    badge: '📣 CHAPTER 4',
    title: 'Rival! Call & Rewards',
    subtitle: '1-Card Announcement, 2.5s Catch Window & Economy',
    topics: [
      'RIVAL! Shout: Announce when down to exactly 1 card in hand',
      'CATCH RIVAL! Penalty: 2.5-second window for opponents to catch you',
      '+2 Penalty Cards: Applied immediately if caught before declaring Rival',
      'Match Completion XP: +120 XP on victory, +50 XP on defeat',
      'Match Completion Coins: +60 Coins on victory, +20 Coins on defeat',
      'Level Up Rewards: +100 Coins & +5 Gems awarded per level threshold',
    ],
  },
] as const;
