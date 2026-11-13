// src/__tests__/boardLayout.test.ts - Unit tests for responsive hand overlap & centering layout math
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCardOverlapMargin,
  getHandSpanWidth,
  HAND_CARD_WIDTH,
  HAND_HORIZONTAL_PADDING,
} from '../utils/boardLayout';

describe('Player Hand Responsive Overlap & Centering', () => {
  test('Overlap tightens cleanly for 8+ cards across standard mobile widths', () => {
    const overlap7 = getCardOverlapMargin(7, 800);
    const overlap8 = getCardOverlapMargin(8, 800);
    const overlap12 = getCardOverlapMargin(12, 667);

    assert.strictEqual(overlap7, -37);
    assert.ok(overlap8 <= -39, `Expected tighter overlap for 8 cards, got ${overlap8}`);
    assert.ok(overlap12 <= overlap8, `Expected 12-card narrow width overlap <= 8-card overlap`);
    assert.ok(HAND_CARD_WIDTH + overlap12 >= 13, 'Each card must retain at least a 13px readable corner strip');
  });

  test('Hands of 8 to 14 cards fit within standard landscape mobile viewport usable space', () => {
    const screenWidth = 800;
    const usableWidth = screenWidth - HAND_HORIZONTAL_PADDING * 2;

    for (let count = 8; count <= 14; count++) {
      const margin = getCardOverlapMargin(count, screenWidth);
      const totalWidth = getHandSpanWidth(count, margin);
      assert.ok(
        totalWidth <= usableWidth,
        `Expected ${count} cards (${totalWidth}px) to fit cleanly within ${usableWidth}px centered area`
      );
    }
  });
});
