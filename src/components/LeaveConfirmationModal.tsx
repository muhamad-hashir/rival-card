// src/components/LeaveConfirmationModal.tsx - Stylized in-game leave confirmation modal
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';

export interface LeaveConfirmationModalProps {
  visible: boolean;
  isOnlineMode: boolean;
  onCancel: () => void;
  onConfirmLeave: () => void;
}

export const LeaveConfirmationModal: React.FC<LeaveConfirmationModalProps> = ({
  visible,
  isOnlineMode,
  onCancel,
  onConfirmLeave,
}) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.dialogCard}>
            {/* Top Emblem Circle */}
            <View
              style={[
                styles.emblemCircle,
                isOnlineMode ? styles.emblemCircleOnline : styles.emblemCircleLocal,
              ]}
            >
              <Text style={styles.emblemEmoji}>{isOnlineMode ? '⚠️' : '🚪'}</Text>
            </View>

            {/* Modal Title */}
            <Text style={styles.title}>Leave Game?</Text>

            {/* Body Description Text */}
            {isOnlineMode ? (
              <View style={styles.bodyContainer}>
                <Text style={styles.bodyText}>
                  Are you sure you want to leave the room?
                </Text>
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ You will forfeit and lose the game.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.bodyContainer}>
                <Text style={styles.bodyText}>
                  Are you sure you want to return to the home screen? Your current game progress will be lost.
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            {/* Primary Action: Cancel / Stay */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCancel}
              style={styles.stayBtn}
            >
              <Text style={styles.stayBtnText}>Stay & Play</Text>
            </TouchableOpacity>

            {/* Secondary Action: Confirm Leave */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onConfirmLeave}
              style={styles.leaveBtn}
            >
              <Text style={styles.leaveBtnText}>Leave Match</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    padding: 16,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FEF6E9', // Warm cream matching HomeScreen & room creation palette
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  emblemCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
  },
  emblemCircleLocal: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  emblemCircleOnline: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  emblemEmoji: {
    fontSize: 30,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  bodyContainer: {
    width: '100%',
    marginBottom: 18,
  },
  bodyText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  warningText: {
    ...FONT_CARTOON_BOLD,
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  stayBtn: {
    width: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stayBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  leaveBtn: {
    width: '100%',
    backgroundColor: '#FEE2E2', // Soft slate-red
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#DC2626',
    fontSize: 15,
    letterSpacing: 0.4,
  },
});
