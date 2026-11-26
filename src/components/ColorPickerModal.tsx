// src/components/ColorPickerModal.tsx - Compact Floating 4-Color Selector for Wild Cards (keeps bottom hand visible)
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StandardColor } from '../types';
import type { HandColorCounts } from '../utils/boardLayout';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
} from '../styles/typography';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';

export interface ColorPickerModalProps {
  visible: boolean;
  onSelectColor: (color: StandardColor) => void;
  cardName?: string;
  handColorCounts?: HandColorCounts;
}

interface ColorOption {
  color: StandardColor;
  label: string;
  bg: string;
  edge: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { color: 'red', label: 'RED', bg: '#EF4444', edge: '#B91C1C' },
  { color: 'blue', label: 'BLUE', bg: '#3B82F6', edge: '#1D4ED8' },
  { color: 'green', label: 'GREEN', bg: '#22C55E', edge: '#15803D' },
  { color: 'yellow', label: 'YELLOW', bg: '#EAB308', edge: '#A16207' },
];

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  onSelectColor,
  cardName = 'Wild Card',
  handColorCounts,
}) => {
  const handleSelect = (color: StandardColor) => {
    soundService.playCardSnap();
    hapticsService.cardSnap();
    onSelectColor(color);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Lightly dimmed upper-table backdrop leaving bottom player hand clearly visible */}
      <View style={styles.backdrop} testID="color-picker-backdrop">
        <View style={styles.dialogCard} testID="color-picker-panel">
          <View style={styles.header}>
            <Text style={styles.badgeText}>⚡ {cardName.replace(/_/g, ' ').toUpperCase()}</Text>
            <Text style={styles.title}>CHOOSE COLOR</Text>
          </View>

          {/* Compact 4-Color Horizontal Arcade Row */}
          <View style={styles.rowContainer}>
            {COLOR_OPTIONS.map((item) => {
              const cardCount = handColorCounts ? handColorCounts[item.color] : null;
              const hasCards = typeof cardCount === 'number' && cardCount > 0;

              return (
                <Pressable
                  key={item.color}
                  onPress={() => handleSelect(item.color)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.label}${
                    typeof cardCount === 'number' ? ` (${cardCount} in hand)` : ''
                  }`}
                  testID={`color-picker-btn-${item.color}`}
                  style={({ pressed }) => [
                    styles.colorButton,
                    {
                      backgroundColor: item.bg,
                      borderColor: item.edge,
                    },
                    pressed && styles.colorButtonPressed,
                  ]}
                >
                  {typeof cardCount === 'number' && (
                    <View
                      style={[
                        styles.countBadge,
                        hasCards ? styles.countBadgeActive : styles.countBadgeEmpty,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countBadgeText,
                          hasCards ? styles.countBadgeTextActive : styles.countBadgeTextEmpty,
                        ]}
                      >
                        {cardCount}
                      </Text>
                    </View>
                  )}
                  <View style={styles.innerColorRing}>
                    <Text style={styles.colorLabel}>{item.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 28, 0.28)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 356,
    backgroundColor: '#1E163D',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FEF6E9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#090B1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  badgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#1E163D',
    backgroundColor: '#FEF6E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    letterSpacing: 0.6,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
    color: '#FEF6E9',
    letterSpacing: 0.6,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  colorButton: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  colorButtonPressed: {
    transform: [{ scale: 0.94 }],
    borderBottomWidth: 2,
    marginTop: 2,
  },
  innerColorRing: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorLabel: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 0.7,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    zIndex: 5,
  },
  countBadgeActive: {
    backgroundColor: '#FEF6E9',
    borderColor: '#1E163D',
  },
  countBadgeEmpty: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(254, 246, 233, 0.4)',
  },
  countBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    lineHeight: 12,
  },
  countBadgeTextActive: {
    color: '#1E163D',
  },
  countBadgeTextEmpty: {
    color: '#CBD5E1',
  },
});
