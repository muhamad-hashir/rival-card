// src/__tests__/howToPlayModal.test.ts - Unit tests for Streamlined 4-Page Book-Style Rulebook Modal specifications
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULEBOOK_TOTAL_PAGES,
  getPageIndicatorText,
  getNextButtonLabel,
  clampRulebookPage,
  RULEBOOK_CHAPTERS,
} from '../services/rulebookService';

describe('Interactive Book-Style Rulebook Modal Specifications', () => {
  test('Rulebook configuration defines 4 streamlined pages', () => {
    assert.strictEqual(RULEBOOK_TOTAL_PAGES, 4, 'Rulebook must have 4 pages');
    assert.strictEqual(RULEBOOK_CHAPTERS.length, 4, 'Rulebook must contain 4 distinct chapters');
  });

  test('Page indicator pill generates correct labels for all 4 pages', () => {
    assert.strictEqual(getPageIndicatorText(1), 'PAGE 1 OF 4');
    assert.strictEqual(getPageIndicatorText(2), 'PAGE 2 OF 4');
    assert.strictEqual(getPageIndicatorText(3), 'PAGE 3 OF 4');
    assert.strictEqual(getPageIndicatorText(4), 'PAGE 4 OF 4');
  });

  test('Navigation Next button updates label on final page', () => {
    assert.strictEqual(getNextButtonLabel(1), 'Next →');
    assert.strictEqual(getNextButtonLabel(2), 'Next →');
    assert.strictEqual(getNextButtonLabel(3), 'Next →');
    assert.strictEqual(getNextButtonLabel(4), 'Got It! ✓');
  });

  test('Page flip transition bounds clamp within valid page range (1 to 4)', () => {
    assert.strictEqual(clampRulebookPage(0), 1, 'Cannot flip before page 1');
    assert.strictEqual(clampRulebookPage(1), 1);
    assert.strictEqual(clampRulebookPage(3), 3);
    assert.strictEqual(clampRulebookPage(4), 4);
    assert.strictEqual(clampRulebookPage(5), 4, 'Cannot flip past page 4');
  });

  test('Chapter 1 covers Objective, Matching rules, Draw & Pair combos', () => {
    const ch1 = RULEBOOK_CHAPTERS.find((c) => c.page === 1);
    assert.ok(ch1, 'Chapter 1 must exist');
    assert.ok(ch1.topics.some((t) => t.toLowerCase().includes('empty your hand')));
    assert.ok(ch1.topics.some((t) => t.includes('Color')));
    assert.ok(ch1.topics.some((t) => t.includes('Number')));
    assert.ok(ch1.topics.some((t) => t.includes('Symbol')));
    assert.ok(ch1.topics.some((t) => t.includes('Wild')));
    assert.ok(ch1.topics.some((t) => t.toLowerCase().includes('draw 1 card')));
  });

  test('Chapter 2 covers Action Cards (Skip, Reverse, Draw 2) and 1v1 / stacking rules', () => {
    const ch2 = RULEBOOK_CHAPTERS.find((c) => c.page === 2);
    assert.ok(ch2, 'Chapter 2 must exist');
    assert.ok(ch2.topics.some((t) => t.includes('Skip (⊘)')));
    assert.ok(ch2.topics.some((t) => t.includes('Reverse (⇄)')));
    assert.ok(ch2.topics.some((t) => t.includes('Draw Two (+2)')));
    assert.ok(ch2.topics.some((t) => t.includes('1v1')));
  });

  test('Chapter 3 covers Wilds, RIVAL! Shout, and points to Special Cards without rewards clutter', () => {
    const ch3 = RULEBOOK_CHAPTERS.find((c) => c.page === 3);
    assert.ok(ch3, 'Chapter 3 must exist');
    assert.ok(ch3.topics.some((t) => t.includes('Wild Draw 4 (+4)')));
    assert.ok(ch3.topics.some((t) => t.includes('RIVAL! Shout')));
    assert.ok(ch3.topics.some((t) => t.includes('Special Cards')));
    const allTopics = RULEBOOK_CHAPTERS.flatMap((c) => c.topics).join(' ');
    assert.ok(!allTopics.includes('XP'), 'Rulebook should omit rewards/XP clutter');
  });

  test('Chapter 4 covers 3-Minute Match Timer and Tie-Breaker Priority', () => {
    const ch4 = RULEBOOK_CHAPTERS.find((c) => c.page === 4);
    assert.ok(ch4, 'Chapter 4 must exist');
    assert.ok(ch4.topics.some((t) => t.includes('3-Minute Match Timer')));
    assert.ok(ch4.topics.some((t) => t.includes('Tie-Breaker Priority')));
  });
});
