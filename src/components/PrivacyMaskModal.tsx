// src/components/PrivacyMaskModal.tsx - Pass-and-Play privacy screen masking
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';

interface PrivacyMaskModalProps {
  visible: boolean;
  targetPlayerName: string;
  onDismiss: () => void;
}

export const PrivacyMaskModal: React.FC<PrivacyMaskModalProps> = ({
  visible,
  targetPlayerName,
  onDismiss,
}) => {
  const handleReveal = () => {
    hapticsService.cardSnap();
    soundService.playCardDraw();
    onDismiss();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.cardContainer}>
          {/* Clean Pass & Play Badge */}
          <View style={styles.passBadge}>
            <Text style={styles.passBadgeText}>PASS & PLAY</Text>
          </View>

          <Text style={styles.mainTitle}>Pass Device To</Text>
          <Text style={styles.playerName}>{targetPlayerName}</Text>

          {/* Clean Alert Warning Banner (without lock icon or eye emoji) */}
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Keep the screen hidden from opponents to protect your hand!
            </Text>
          </View>

          {/* Punchy Emerald Green Pill Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleReveal}
            style={styles.readyButton}
          >
            <Text style={styles.readyButtonText}>
              I am {targetPlayerName} — Reveal Hand
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerBrand}>RIVAL CARD • LOCAL MULTIPLAYER</Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  passBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  passBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
    letterSpacing: 1.2,
  },
  mainTitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 15,
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  playerName: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 28,
    color: '#0F172A',
    marginBottom: 18,
    textAlign: 'center',
  },
  warningBox: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12.5,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
  readyButton: {
    width: '100%',
    backgroundColor: '#10B981', // Modern vibrant emerald green
    borderRadius: 14,
    borderBottomWidth: 4,
    borderColor: '#059669', // Tactile edge
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  readyButtonText: {
    ...FONT_CARTOON_BOLD,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  footerBrand: {
    position: 'absolute',
    bottom: 24,
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
});
