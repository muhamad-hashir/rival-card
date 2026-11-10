// src/utils/contentFilter.ts - Username Validation & Lightweight Profanity Filter

/**
 * Standard list of inherently offensive terms that are forbidden as substrings.
 */
const FORBIDDEN_SUBSTRINGS = [
  'fuck',
  'fck',
  'fuk',
  'shit',
  'bitch',
  'btch',
  'cunt',
  'dick',
  'pussy',
  'cock',
  'faggot',
  'nigger',
  'nigga',
  'whore',
  'slut',
  'retard',
  'nazi',
  'hitler',
  'pedophil',
  'blowjob',
  'penis',
  'vagina',
  'porno',
  'porn',
  'bastard',
  'asshole',
  'jackass',
  'dumbass',
  'dipshit',
  'bullshit',
];

/**
 * Words that are forbidden as standalone tokens or whole words,
 * but allowed inside benign words (e.g. 'classic', 'pass', 'assistant').
 */
const FORBIDDEN_EXACT_TOKENS = [
  'ass',
  'tit',
  'tits',
  'cum',
  'fag',
  'sex',
  'anal',
  'dildo',
];

/**
 * Normalizes leetspeak substitutions to standard Latin characters.
 * E.g., '@' -> 'a', '0' -> 'o', '1' -> 'i', '$' -> 's', '3' -> 'e', '7' -> 't', '8' -> 'b', '4' -> 'a'
 */
export function normalizeLeetspeak(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/\^/g, 'a')
    .replace(/8/g, 'b')
    .replace(/3/g, 'e')
    .replace(/€/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't');
}

/**
 * Checks if a string contains prohibited profanity, slurs, or inappropriate content.
 */
export function hasProfanity(text: string): boolean {
  if (!text) return false;

  const normalized = normalizeLeetspeak(text);

  // 1. Strip non-alphanumeric noise to defeat masking like "f.u.c.k", "s_h_i_t", "b-i-t-c-h"
  const stripped = normalized.replace(/[^a-z0-9]/g, '');

  // 2. Collapse consecutive duplicate letters (3+ into 1, e.g. "fuuuuck" -> "fuck")
  const collapsed = stripped.replace(/(.)\1{2,}/g, '$1');

  // Check forbidden substrings on both stripped and collapsed forms
  for (const word of FORBIDDEN_SUBSTRINGS) {
    if (stripped.includes(word) || collapsed.includes(word)) {
      return true;
    }
  }

  // 3. Tokenize on word boundaries/spaces/delimiters for words like 'ass', 'sex', 'cum'
  const tokens = normalized.split(/[^a-z0-9]+/);
  for (const token of tokens) {
    if (FORBIDDEN_EXACT_TOKENS.includes(token)) {
      return true;
    }
  }

  // Check whole stripped word for exact match on isolated tokens
  if (FORBIDDEN_EXACT_TOKENS.includes(stripped) || FORBIDDEN_EXACT_TOKENS.includes(collapsed)) {
    return true;
  }

  return false;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a candidate username against length, character, and profanity rules.
 * - Minimum length: 3 characters
 * - Maximum length: 16 characters
 * - Profanity check: blocked terms and leetspeak substitutions
 */
export function validateUsername(name: string): ValidationResult {
  const trimmed = name ? name.trim() : '';

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Name must be at least 3 characters',
    };
  }

  if (trimmed.length > 16) {
    return {
      isValid: false,
      error: 'Name cannot exceed 16 characters',
    };
  }

  // Ensure username contains at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid username',
    };
  }

  if (hasProfanity(trimmed)) {
    return {
      isValid: false,
      error: 'Inappropriate name not allowed!',
    };
  }

  return { isValid: true };
}
