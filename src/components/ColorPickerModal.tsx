// src/components/ColorPickerModal.tsx - Interactive Radial/Diamond 4-Color Selector for Wild Cards
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StandardColor } from '../types';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';

export interface ColorPickerModalProps {
  visible: boolean;
  onSelectColor: (color: StandardColor) => void;
  cardName?: string;
}

interface ColorOption {
  color: StandardColor;
  label: string;
  bg: string;
  edge: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { color: 'red', label: 'RED', bg: '#EF4444', edge: '#DC2626' },
  { color: 'blue', label: 'BLUE', bg: '#3B82F6', edge: '#2563EB' },
  { color: 'green', label: 'GREEN', bg: '#22C55E', edge: '#16A34A' },
  { color: 'yellow', label: 'YELLOW', bg: '#FACC15', edge: '#CA8A04' },
];

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  onSelectColor,
  cardName = 'Wild Card',
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
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header Badge & Title */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⚡ WILD EFFECT</Text>
            </View>
            <Text style={styles.title}>CHOOSE COLOR</Text>
            <Text style={styles.subtitle}>
              Pick the color for following turns
            </Text>
          </View>

          {/* 2x2 Quadrant Grid Layout */}
          <View style={styles.gridContainer}>
            {COLOR_OPTIONS.map((item) => (
              <Pressable
                key={item.color}
                onPress={() => handleSelect(item.color)}
                style={({ pressed }) => [
                  styles.quadrantButton,
                  {
                    backgroundColor: item.bg,
                    borderColor: item.edge,
                  },
                  pressed && styles.quadrantButtonPressed,
                ]}
              >
                <View style={styles.innerQuadrantRing}>
                  <Text style={styles.quadrantLabel}>{item.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FEF6E9', // Warm cream container surface
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  badge: {
    backgroundColor: '#E2D9C8',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    rowGap: 12,
  },
  quadrantButton: {
    width: '48%',
    aspectRatio: 1.25,
    borderRadius: 18,
    borderBottomWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  quadrantButtonPressed: {
    transform: [{ scale: 0.95 }],
    borderBottomWidth: 1,
    marginTop: 3,
  },
  innerQuadrantRing: {
    width: '92%',
    height: '88%',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quadrantLabel: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
});
