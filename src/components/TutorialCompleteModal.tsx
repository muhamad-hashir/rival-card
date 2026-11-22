// src/components/TutorialCompleteModal.tsx - Celebratory Modal shown when Tutorial finishes
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ModalConfettiBurst } from './ModalConfettiBurst';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import type { TutorialRewardResult } from '../services/tutorialService';
import {
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';

export interface TutorialCompleteModalProps {
  visible: boolean;
  rewardResult: TutorialRewardResult | null;
  onContinueHome: () => void;
}

export const TutorialCompleteModal: React.FC<TutorialCompleteModalProps> = ({
  visible,
  rewardResult,
  onContinueHome,
}) => {
  const awarded = Boolean(rewardResult?.awarded);

  const handleFinish = () => {
    hapticsService.validPlay();
    soundService.playCardSnap();
    onContinueHome();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleFinish}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ModalConfettiBurst active={visible} />

          <View style={styles.trophyCircle}>
            <Text style={styles.trophyEmoji}>🎓</Text>
          </View>

          <Text style={styles.title}>
            {awarded
              ? `Tutorial Complete! +${rewardResult?.coinsAwarded ?? 100} Coins & +${rewardResult?.gemsAwarded ?? 3} Gems`
              : 'Tutorial Complete!'}
          </Text>

          <Text style={styles.subtitle}>
            {awarded
              ? 'Your first-time reward has been added to your wallet. Jump into Solo or Online Quick Match anytime!'
              : 'Great practice! Rewards are granted once on your first completion.'}
          </Text>

          {awarded && (
            <View style={styles.rewardRow}>
              <View style={styles.rewardChip}>
                <Text style={styles.rewardChipText}>
                  🪙 +{rewardResult?.coinsAwarded ?? 100} Coins
                </Text>
              </View>
              <View style={[styles.rewardChip, styles.rewardChipGem]}>
                <Text style={styles.rewardChipGemText}>
                  💎 +{rewardResult?.gemsAwarded ?? 3} Gems
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleFinish}
            style={styles.doneBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Text style={styles.doneBtnText}>Let's Play! ▶</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 370,
    backgroundColor: '#FFF8ED',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#0F1142',
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 14,
  },
  trophyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: '#0F1142',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  trophyEmoji: {
    fontSize: 32,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 19,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  rewardChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rewardChipText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#92400E',
  },
  rewardChipGem: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  rewardChipGemText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#075985',
  },
  doneBtn: {
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
  doneBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
