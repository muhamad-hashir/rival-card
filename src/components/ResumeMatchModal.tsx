// src/components/ResumeMatchModal.tsx - Warm Cartoon Modal prompting user to resume an unexpired active online match
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActiveMatchSession } from '../services/multiplayerService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';

export interface ResumeMatchModalProps {
  visible: boolean;
  session: ActiveMatchSession | null;
  isRejoining?: boolean;
  onRejoin: () => void;
  onAbandon: () => void;
}

export const ResumeMatchModal: React.FC<ResumeMatchModalProps> = ({
  visible,
  session,
  isRejoining = false,
  onRejoin,
  onAbandon,
}) => {
  if (!session) return null;

  const minutesAgo = Math.max(1, Math.round((Date.now() - session.timestamp) / 60000));

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onAbandon}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Top Emblem Icon */}
          <View style={styles.emblemCircle}>
            <Text style={styles.emblemEmoji}>⚡</Text>
          </View>

          {/* Modal Title */}
          <Text style={styles.title}>Resume Match?</Text>

          {/* Description */}
          <Text style={styles.subtitle}>
            You have an active online match in room #{session.roomId} from {minutesAgo}m ago.
            Would you like to jump back in?
          </Text>

          {/* Action Buttons */}
          {isRejoining ? (
            <View style={styles.rejoiningNotice}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.rejoiningText}>Rejoining room #{session.roomId}...</Text>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.rejoinBtn}
                onPress={onRejoin}
                activeOpacity={0.85}
              >
                <Text style={styles.rejoinBtnText}>Rejoin Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.abandonBtn}
                onPress={onAbandon}
                activeOpacity={0.85}
              >
                <Text style={styles.abandonBtnText}>Abandon</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    backgroundColor: '#FEF6E9', // Warm cream container surface
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  emblemCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    borderWidth: 3,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emblemEmoji: {
    fontSize: 30,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
  },
  rejoinBtn: {
    width: '100%',
    backgroundColor: '#10B981', // Modern vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  rejoinBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  abandonBtn: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonBtnText: {
    ...FONT_CARTOON_BOLD,
    color: '#DC2626',
    fontSize: 15,
  },
  rejoiningNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  rejoiningText: {
    ...FONT_CARTOON_BOLD,
    color: '#15803D',
    fontSize: 14,
  },
});
