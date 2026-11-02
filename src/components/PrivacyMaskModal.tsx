// src/components/PrivacyMaskModal.tsx - Pass-and-Play privacy screen masking
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  return (
    <Modal
      transparent={false}
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Decorative Top Accent Bar */}
        <View style={styles.topAccentBar} />

        <View style={styles.cardContainer}>
          {/* Privacy Shield Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.shieldIcon}>🔒</Text>
          </View>

          <View style={styles.passBadge}>
            <Text style={styles.passBadgeText}>PASS & PLAY MODE</Text>
          </View>

          <Text style={styles.mainTitle}>Pass Device To</Text>
          <Text style={styles.playerName}>{targetPlayerName}</Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>👁️</Text>
            <Text style={styles.warningText}>
              Keep the screen hidden from opponents to protect your hand!
            </Text>
          </View>

          {/* Unlock / Ready Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onDismiss}
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
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#3B82F6',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  shieldIcon: {
    fontSize: 34,
  },
  passBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  passBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 18,
  },
  readyButton: {
    width: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerBrand: {
    position: 'absolute',
    bottom: 24,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
});
