// src/__tests__/specialCardsModal.test.ts - Unit tests for 4-Portion Special Cards Catalogue Modal
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIAL_CARDS_CATALOG,
  SPECIAL_CARDS_TOTAL,
  clampSpecialCardPage,
  getSpecialCardIndicatorText,
  getSpecialCardNextLabel,
} from '../services/specialCardsService';

describe('Special Cards 4-Portion Catalogue Modal', () => {
  test('Catalog defines exactly 4 special card portions in showcase order', () => {
    assert.strictEqual(SPECIAL_CARDS_TOTAL, 4);
    assert.strictEqual(SPECIAL_CARDS_CATALOG.length, 4);
    assert.deepStrictEqual(
      SPECIAL_CARDS_CATALOG.map((c) => c.key),
      ['swap', 'mute', 'shield', 'mirror']
    );
  });

  test('Indicator and NEXT! button labels advance across portions 1 to 4', () => {
    assert.strictEqual(getSpecialCardIndicatorText(1), 'CARD 1 OF 4');
    assert.strictEqual(getSpecialCardIndicatorText(4), 'CARD 4 OF 4');

    assert.strictEqual(getSpecialCardNextLabel(1), 'Next →');
    assert.strictEqual(getSpecialCardNextLabel(2), 'Next →');
    assert.strictEqual(getSpecialCardNextLabel(3), 'Next →');
    assert.strictEqual(getSpecialCardNextLabel(4), 'Got It! ✓');

    assert.strictEqual(clampSpecialCardPage(0), 1);
    assert.strictEqual(clampSpecialCardPage(5), 4);
  });

  test('Each special card includes clear, detailed rules explaining how it works', () => {
    for (const card of SPECIAL_CARDS_CATALOG) {
      assert.ok(card.headline.length > 15, `${card.key} must have a descriptive headline`);
      assert.ok(card.details.length >= 4, `${card.key} must have detailed breakdown sections`);
      for (const detail of card.details) {
        assert.ok(detail.label.length > 0 && detail.description.length > 20);
      }
    }

    const swap = SPECIAL_CARDS_CATALOG.find((c) => c.key === 'swap')!;
    assert.ok(swap.details.some((d) => d.description.includes('fewest cards')));
    assert.ok(swap.details.some((d) => d.description.includes('RIVAL!')));

    const mute = SPECIAL_CARDS_CATALOG.find((c) => c.key === 'mute')!;
    assert.ok(mute.details.some((d) => d.description.includes('skip')));

    const shield = SPECIAL_CARDS_CATALOG.find((c) => c.key === 'shield')!;
    assert.ok(shield.details.some((d) => d.description.includes('3 seconds')));

    const mirror = SPECIAL_CARDS_CATALOG.find((c) => c.key === 'mirror')!;
    assert.ok(mirror.details.some((d) => d.description.includes('Counter-Mirror')));
  });
});
