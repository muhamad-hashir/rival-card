// src/__tests__/contentFilter.test.ts - Unit Tests for Content Filter & Username Validation
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLeetspeak,
  hasProfanity,
  validateUsername,
} from '../utils/contentFilter';

describe('Username Validation & Profanity Filter', () => {
  describe('normalizeLeetspeak', () => {
    it('normalizes common leetspeak substitutions', () => {
      assert.strictEqual(normalizeLeetspeak('H3LL0'), 'hello');
      assert.strictEqual(normalizeLeetspeak('@c3R1v@l'), 'acerival');
      assert.strictEqual(normalizeLeetspeak('b!tch'), 'bitch');
      assert.strictEqual(normalizeLeetspeak('sh1t'), 'shit');
      assert.strictEqual(normalizeLeetspeak('a$$hole'), 'asshole');
      assert.strictEqual(normalizeLeetspeak('p0rn'), 'porn');
    });
  });

  describe('hasProfanity', () => {
    it('detects plain forbidden words', () => {
      assert.strictEqual(hasProfanity('fuck'), true);
      assert.strictEqual(hasProfanity('bitch'), true);
      assert.strictEqual(hasProfanity('cunt'), true);
      assert.strictEqual(hasProfanity('asshole'), true);
    });

    it('detects masked profanity with spaces, dots, or underscores', () => {
      assert.strictEqual(hasProfanity('f u c k'), true);
      assert.strictEqual(hasProfanity('f.u.c.k'), true);
      assert.strictEqual(hasProfanity('s_h_i_t'), true);
      assert.strictEqual(hasProfanity('b-i-t-c-h'), true);
    });

    it('detects repeated letter variations', () => {
      assert.strictEqual(hasProfanity('fuuuuck'), true);
      assert.strictEqual(hasProfanity('shiiiit'), true);
      assert.strictEqual(hasProfanity('biiiitch'), true);
    });

    it('detects leetspeak masked profanity', () => {
      assert.strictEqual(hasProfanity('f*ck'), true);
      assert.strictEqual(hasProfanity('b1tch'), true);
      assert.strictEqual(hasProfanity('a$$hole'), true);
      assert.strictEqual(hasProfanity('sh!t'), true);
      assert.strictEqual(hasProfanity('d1ck'), true);
      assert.strictEqual(hasProfanity('n@z1'), true);
      assert.strictEqual(hasProfanity('p0rn'), true);
    });

    it('detects isolated exact forbidden tokens', () => {
      assert.strictEqual(hasProfanity('ass'), true);
      assert.strictEqual(hasProfanity('bad ass'), true);
      assert.strictEqual(hasProfanity('big_ass'), true);
    });

    it('does NOT flag benign words containing substrings like "ass"', () => {
      assert.strictEqual(hasProfanity('Classic'), false);
      assert.strictEqual(hasProfanity('PassPlay'), false);
      assert.strictEqual(hasProfanity('Cassandra'), false);
      assert.strictEqual(hasProfanity('Assistant'), false);
    });

    it('does NOT flag clean gaming usernames', () => {
      assert.strictEqual(hasProfanity('NovaBot'), false);
      assert.strictEqual(hasProfanity('AceRival'), false);
      assert.strictEqual(hasProfanity('PixelKing'), false);
      assert.strictEqual(hasProfanity('Player_1'), false);
    });
  });

  describe('validateUsername', () => {
    it('rejects names shorter than 3 characters', () => {
      const empty = validateUsername('');
      assert.strictEqual(empty.isValid, false);
      assert.strictEqual(empty.error, 'Name must be at least 3 characters');

      const oneChar = validateUsername('A');
      assert.strictEqual(oneChar.isValid, false);
      assert.strictEqual(oneChar.error, 'Name must be at least 3 characters');

      const twoChars = validateUsername('Yo');
      assert.strictEqual(twoChars.isValid, false);
      assert.strictEqual(twoChars.error, 'Name must be at least 3 characters');

      const whitespaceOnly = validateUsername('   ');
      assert.strictEqual(whitespaceOnly.isValid, false);
      assert.strictEqual(whitespaceOnly.error, 'Name must be at least 3 characters');
    });

    it('rejects names longer than 16 characters', () => {
      const seventeen = validateUsername('SuperUltraChampion'); // 18 chars
      assert.strictEqual(seventeen.isValid, false);
      assert.strictEqual(seventeen.error, 'Name cannot exceed 16 characters');

      const seventeenExact = validateUsername('12345678901234567'); // 17 chars
      assert.strictEqual(seventeenExact.isValid, false);
      assert.strictEqual(seventeenExact.error, 'Name cannot exceed 16 characters');
    });

    it('accepts names with exactly 3 to 16 characters', () => {
      const minValid = validateUsername('Bob');
      assert.strictEqual(minValid.isValid, true);
      assert.strictEqual(minValid.error, undefined);

      const maxValid = validateUsername('1234567890123456'); // 16 chars
      assert.strictEqual(maxValid.isValid, true);

      const standard = validateUsername('NovaStriker');
      assert.strictEqual(standard.isValid, true);

      const withSpaces = validateUsername('  Ace_99  ');
      assert.strictEqual(withSpaces.isValid, true);
    });

    it('rejects names with only punctuation and no letters or numbers', () => {
      const onlySymbols = validateUsername('---');
      assert.strictEqual(onlySymbols.isValid, false);
      assert.strictEqual(onlySymbols.error, 'Please enter a valid username');

      const dots = validateUsername('.....');
      assert.strictEqual(dots.isValid, false);
      assert.strictEqual(dots.error, 'Please enter a valid username');
    });

    it('rejects inappropriate names and returns designated error message', () => {
      const profanity = validateUsername('fuck');
      assert.strictEqual(profanity.isValid, false);
      assert.strictEqual(profanity.error, 'Inappropriate name not allowed!');

      const leet = validateUsername('b1tch99');
      assert.strictEqual(leet.isValid, false);
      assert.strictEqual(leet.error, 'Inappropriate name not allowed!');

      const masked = validateUsername('f_u_c_k_1');
      assert.strictEqual(masked.isValid, false);
      assert.strictEqual(masked.error, 'Inappropriate name not allowed!');
    });
  });
});
