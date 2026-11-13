// src/utils/boardLayout.ts - Pure layout helpers for GameScreen card hand centering & responsive overlap

export const HAND_CARD_WIDTH = 62;
export const HAND_HORIZONTAL_PADDING = 96;

/**
 * Computes responsive horizontal negative overlap margin between cards in the local player's hand.
 * Tightens automatically when holding 8+ cards so the fan fits comfortably centered across screen widths.
 */
export function getCardOverlapMargin(cardCount: number, containerWidth: number = 800): number {
  if (cardCount <= 1) return 0;
  if (cardCount === 2) return -22;
  if (cardCount === 3) return -27;
  if (cardCount === 4) return -31;
  if (cardCount === 5) return -34;
  if (cardCount <= 7) return -37;

  // For 8+ cards, dynamically tighten overlap based on available inner tray width
  const usableWidth = Math.max(160, containerWidth - HAND_HORIZONTAL_PADDING * 2);
  const idealStep = Math.floor((usableWidth - HAND_CARD_WIDTH) / (cardCount - 1));
  const dynamicMargin = idealStep - HAND_CARD_WIDTH;
  return Math.min(-39, Math.max(-49, dynamicMargin));
}

/**
 * Computes the total visual width of a hand with the given overlap margin.
 */
export function getHandSpanWidth(cardCount: number, overlapMargin: number): number {
  if (cardCount <= 0) return 0;
  if (cardCount === 1) return HAND_CARD_WIDTH;
  return HAND_CARD_WIDTH + (cardCount - 1) * (HAND_CARD_WIDTH + overlapMargin);
}
