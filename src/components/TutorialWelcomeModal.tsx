// src/components/TutorialWelcomeModal.tsx - First-Launch "New to Rival Card?" Interactive Tutorial Invite
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  TUTORIAL_REWARD_COINS,
  TUTORIAL_REWARD_GEMS,
} from '../services/tutorialService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';

export interface TutorialWelcomeModalProps {
  visible: boolean;
  onPlayTutorial: () => void;
  onDismiss: () => void;
}

export const TutorialWelcomeModal: React.FC<TutorialWelcomeModalProps> = ({
  visible,
  onPlayTutorial,
  onDismiss,
}) => {
  const handleDismiss = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onDismiss();
  };

  const handlePlay = () => {
    hapticsService.validPlay();
    soundService.playCardDraw();
    onPlayTutorial();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Dismiss Cross Button */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tutorial invite"
            testID="tutorial-welcome-dismiss"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🃏</Text>
          </View>

          <Text style={styles.title}>New to Rival Card?</Text>
          <Text style={styles.subtitle}>
            Learn every Special Card, Wilds, +2/+4 attacks, and calling RIVAL! in a quick practice match.
          </Text>

          <View style={styles.rewardBanner}>
            <Text style={styles.rewardBannerLabel}>COMPLETION REWARD</Text>
            <Text style={styles.rewardBannerValue}>
              🪙 +{TUTORIAL_REWARD_COINS} Coins  •  💎 +{TUTORIAL_REWARD_GEMS} Gems
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePlay}
            style={styles.playBtn}
            accessibilityRole="button"
            accessibilityLabel="Play Tutorial"
            testID="tutorial-welcome-play"
          >
            <Text style={styles.playBtnText}>▶ Play Tutorial</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF8ED',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#0F1142',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#B91C1C',
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DBEAFE',
    borderWidth: 2.5,
    borderColor: '#0F1142',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: 30,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  rewardBanner: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  rewardBannerLabel: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10.5,
    letterSpacing: 0.9,
    color: '#B45309',
    marginBottom: 3,
  },
  rewardBannerValue: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
    color: '#78350F',
  },
  playBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#0F1142',
    borderBottomWidth: 5,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
