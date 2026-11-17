// src/components/DefenseReactionModal.tsx - Compact 3-Second Reactive Shield & Mirror Defense Overlay
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DefenseAttackType, PendingDefenseState } from '../types';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';

export interface DefenseReactionModalProps {
  visible: boolean;
  pendingDefense: PendingDefenseState | null;
  attackerName: string;
  canUseShield: boolean;
  canUseMirror: boolean;
  onUseShield: () => void;
  onUseMirror: () => void;
  onTakeHit: () => void;
}

function getThreatCopy(attackType: DefenseAttackType, drawPenalty: number, mirrorBounceCount: number): {
  badge: string;
  title: string;
  subtitle: string;
} {
  const threatLabel =
    drawPenalty > 0
      ? `+${drawPenalty} Cards`
      : attackType === 'skip'
      ? 'Skip Turn'
      : attackType === 'mute'
      ? 'Mute + Skip'
      : 'Rival Swap';

  if (mirrorBounceCount === 1) {
    return {
      badge: '🪞 COUNTER-MIRROR?',
      title: `Reflected ${threatLabel}!`,
      subtitle: 'Use your Mirror now to cancel the bounce!',
    };
  }

  return {
    badge: `⚡ INCOMING ${threatLabel.toUpperCase()}!`,
    title: `Incoming ${threatLabel}!`,
    subtitle: 'React within 3s or take the hit.',
  };
}

export const DefenseReactionModal: React.FC<DefenseReactionModalProps> = ({
  visible,
  pendingDefense,
  attackerName,
  canUseShield,
  canUseMirror,
  onUseShield,
  onUseMirror,
  onTakeHit,
}) => {
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [secondsLeft, setSecondsLeft] = useState('3.0s');

  useEffect(() => {
    if (!visible || !pendingDefense) return;

    const totalDuration = 3000;
    const remainingMs = Math.max(0, pendingDefense.expiresAt - Date.now());
    const initialFraction = Math.min(1, Math.max(0.05, remainingMs / totalDuration));

    progressAnim.setValue(initialFraction);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: Math.max(100, remainingMs),
      useNativeDriver: false,
    }).start();

    const updateLabel = () => {
      const ms = Math.max(0, pendingDefense.expiresAt - Date.now());
      setSecondsLeft(`${(ms / 1000).toFixed(1)}s`);
    };
    updateLabel();

    const interval = setInterval(updateLabel, 100);
    return () => {
      clearInterval(interval);
      progressAnim.stopAnimation();
    };
  }, [visible, pendingDefense?.defenseEventId, pendingDefense?.expiresAt, progressAnim]);

  if (!visible || !pendingDefense) return null;

  const isCounterMirror = pendingDefense.mirrorBounceCount === 1;
  const copy = getThreatCopy(
    pendingDefense.attackType,
    pendingDefense.drawPenalty,
    pendingDefense.mirrorBounceCount
  );

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <View style={styles.card}>
        {/* Top Threat Pill & Timer */}
        <View style={styles.topRow}>
          <View
            style={[
              styles.threatPill,
              isCounterMirror ? styles.threatPillMirror : styles.threatPillAttack,
            ]}
          >
            <Text style={styles.threatPillText}>{copy.badge}</Text>
          </View>
          <View style={styles.timerChip}>
            <Text style={styles.timerChipText}>{secondsLeft}</Text>
          </View>
        </View>

        {/* Attacker + Description */}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.attackerHighlight}>{attackerName}</Text> triggered this move.{' '}
          {copy.subtitle}
        </Text>

        {/* Smooth 3.0s Animated Progress Bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: barWidth,
                backgroundColor: isCounterMirror ? '#7C3AED' : '#F59E0B',
              },
            ]}
          />
        </View>

        {/* Valid Defense Action Buttons */}
        <View style={styles.actionsRow}>
          {canUseShield && (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onUseShield}
              style={styles.shieldBtn}
              accessibilityRole="button"
              accessibilityLabel="Use Shield"
            >
              <Text style={styles.shieldBtnText}>🛡️ Use Shield</Text>
            </TouchableOpacity>
          )}

          {canUseMirror && (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={onUseMirror}
              style={styles.mirrorBtn}
              accessibilityRole="button"
              accessibilityLabel={isCounterMirror ? 'Counter Mirror' : 'Use Mirror'}
            >
              <Text style={styles.mirrorBtnText}>
                {isCounterMirror ? '🪞 Counter-Mirror' : '🪞 Use Mirror'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onTakeHit}
            style={styles.takeHitBtn}
            accessibilityRole="button"
            accessibilityLabel="Take Hit"
          >
            <Text style={styles.takeHitText}>Take Hit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 920,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FEF6E9',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  threatPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  threatPillAttack: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  threatPillMirror: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  threatPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  timerChip: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  timerChipText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#92400E',
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 2,
  },
  subtitle: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 10,
  },
  attackerHighlight: {
    ...FONT_CARTOON_BOLD,
    color: '#0F172A',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2D9C8',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  shieldBtn: {
    flexGrow: 1,
    minWidth: 112,
    backgroundColor: '#0F2B46',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FDE047',
    letterSpacing: 0.3,
  },
  mirrorBtn: {
    flexGrow: 1,
    minWidth: 112,
    backgroundColor: '#4C1D95',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  takeHitBtn: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : null),
  },
  takeHitText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#475569',
  },
});
