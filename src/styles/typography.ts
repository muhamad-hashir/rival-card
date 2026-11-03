// src/styles/typography.ts - Cartoon typography helpers for Rival Card
import { Platform, TextStyle } from 'react-native';

export const FONT_CARTOON_BOLD: TextStyle = {
  fontFamily: Platform.select({
    web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
    default: 'Fredoka_700Bold',
  }),
  fontWeight: '800',
};

export const FONT_CARTOON_HEAVY: TextStyle = {
  fontFamily: Platform.select({
    web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
    default: 'Fredoka_700Bold',
  }),
  fontWeight: '900',
};

export const FONT_CARTOON_SEMIBOLD: TextStyle = {
  fontFamily: Platform.select({
    web: '"Fredoka_600SemiBold", "Fredoka", system-ui, -apple-system, sans-serif',
    default: 'Fredoka_600SemiBold',
  }),
  fontWeight: '700',
};

export const FONT_CARTOON_REGULAR: TextStyle = {
  fontFamily: Platform.select({
    web: '"Fredoka_500Medium", "Fredoka", system-ui, -apple-system, sans-serif',
    default: 'Fredoka_500Medium',
  }),
  fontWeight: '600',
};
