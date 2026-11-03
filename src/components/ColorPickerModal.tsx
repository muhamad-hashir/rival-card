// src/components/ColorPickerModal.tsx - Modal for selecting Wild colors
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLOR_HEX, STANDARD_COLORS } from '../types';
import type { StandardColor } from '../types';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';

interface ColorPickerModalProps {
  visible: boolean;
  onSelectColor: (color: StandardColor) => void;
  cardName?: string;
}

const COLOR_NAMES: Record<StandardColor, string> = {
  red: 'RED',
  blue: 'BLUE',
  green: 'GREEN',
  yellow: 'YELLOW',
};

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  onSelectColor,
  cardName = 'Wild Card',
}) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⚡ ACTIVE EFFECT</Text>
            </View>
            <Text style={styles.title}>Select Active Color</Text>
            <Text style={styles.subtitle}>
              You played <Text style={styles.highlightText}>{cardName}</Text>. Pick the color for following turns:
            </Text>
          </View>

          {/* 2x2 Grid of 4 Vibrant Color Buttons */}
          <View style={styles.gridContainer}>
            {STANDARD_COLORS.map((color) => {
              const bg = COLOR_HEX[color];
              return (
                <TouchableOpacity
                  key={color}
                  activeOpacity={0.85}
                  onPress={() => onSelectColor(color)}
                  style={[styles.colorButton, { backgroundColor: bg }]}
                >
                  <View style={styles.innerColorCircle}>
                    <Text style={styles.colorButtonText}>{COLOR_NAMES[color]}</Text>
                  </View>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#475569',
    letterSpacing: 0.8,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  highlightText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  colorButton: {
    width: '47%',
    aspectRatio: 1.25,
    borderRadius: 16,
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  innerColorCircle: {
    width: '92%',
    height: '90%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorButtonText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
