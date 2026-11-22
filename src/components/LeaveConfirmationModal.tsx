// src/components/LeaveConfirmationModal.tsx - Compact Single-Screen Interactive Leave Confirmation Modal
import React, { useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
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
  const stayScale = useRef(new Animated.Value(1)).current;
  const leaveScale = useRef(new Animated.Value(1)).current;

  const animatePress = (target: Animated.Value, toValue: number) => {
    Animated.spring(target, {
      toValue,
      friction: 6,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  const handleStay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onCancel();
  };

  const handleLeave = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    onConfirmLeave();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      supportedOrientations={['landscape', 'portrait']}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Compact Horizontal Header Row (Emblem + Title) so everything fits one screen */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.emblemCircle,
                isOnlineMode ? styles.emblemCircleOnline : styles.emblemCircleLocal,
              ]}
            >
              <Text style={styles.emblemEmoji}>{isOnlineMode ? '⚠️' : '🚪'}</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Leave Game?</Text>
              <Text style={styles.subtitle}>
                {isOnlineMode ? 'Ranked / Room Match' : 'Active Match'}
              </Text>
            </View>
          </View>

          {/* Concise Body & Online Forfeit Warning */}
          {isOnlineMode ? (
            <View style={styles.bodyContainer}>
              <Text style={styles.bodyText}>
                Are you sure you want to leave the room right now?
              </Text>
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Leaving forfeits the match & counts as a loss.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.bodyContainer}>
              <Text style={styles.bodyText}>
                Return to the home screen? Current match progress will be lost.
              </Text>
            </View>
          )}

          {/* Side-by-Side Interactive Tactile Action Row (Zero scrolling needed on any screen) */}
          <View style={styles.actionsRow}>
            <Animated.View style={[styles.actionCol, { transform: [{ scale: stayScale }] }]}>
              <Pressable
                onPress={handleStay}
                onPressIn={() => animatePress(stayScale, 0.94)}
                onPressOut={() => animatePress(stayScale, 1)}
                accessibilityRole="button"
                accessibilityLabel="Stay and Play"
                style={({ pressed }) => [
                  styles.stayBtn,
                  pressed && styles.stayBtnPressed,
                ]}
              >
                <Text style={styles.stayBtnText} numberOfLines={1}>
                  ▶ Stay & Play
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.actionCol, { transform: [{ scale: leaveScale }] }]}>
              <Pressable
                onPress={handleLeave}
                onPressIn={() => animatePress(leaveScale, 0.94)}
                onPressOut={() => animatePress(leaveScale, 1)}
                accessibilityRole="button"
                accessibilityLabel="Leave Match"
                style={({ pressed }) => [
                  styles.leaveBtn,
                  pressed && styles.leaveBtnPressed,
                ]}
              >
                <Text style={styles.leaveBtnText} numberOfLines={1}>
                  Leave Match
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: '#FEF6E9',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  emblemCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 22,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 21,
    color: '#0F172A',
    lineHeight: 24,
  },
  subtitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  bodyContainer: {
    width: '100%',
    marginBottom: 14,
  },
  bodyText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  warningText: {
    ...FONT_CARTOON_BOLD,
    color: '#B91C1C',
    fontSize: 12.5,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  actionCol: {
    flex: 1,
  },
  stayBtn: {
    minHeight: 48,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#059669',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 4,
  },
  stayBtnPressed: {
    backgroundColor: '#059669',
    borderBottomWidth: 2,
    transform: [{ translateY: 2 }],
  },
  stayBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 14.5,
    letterSpacing: 0.3,
  },
  leaveBtn: {
    minHeight: 48,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#EF4444',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  leaveBtnPressed: {
    backgroundColor: '#FECACA',
    borderBottomWidth: 2,
    transform: [{ translateY: 2 }],
  },
  leaveBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#B91C1C',
    fontSize: 14.5,
    letterSpacing: 0.3,
  },
});
