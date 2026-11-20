// src/components/MatchTimerBadge.tsx - Compact 3-Minute Match Countdown HUD Pill
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { formatMatchTimer } from '../gameEngine';
import { FONT_CARTOON_HEAVY } from '../styles/typography';

export interface MatchTimerBadgeProps {
  remainingMs: number;
  isPaused?: boolean;
}

export const MatchTimerBadge: React.FC<MatchTimerBadgeProps> = ({
  remainingMs,
  isPaused = false,
}) => {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const isCritical = totalSeconds <= 10;
  const isWarning = totalSeconds <= 30 && !isCritical;
  const label = formatMatchTimer(clampedMs);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCritical && totalSeconds > 0 && !isPaused) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [totalSeconds, isCritical, isPaused, pulseAnim]);

  let bgColor = 'rgba(15, 23, 42, 0.58)';
  let borderColor = 'rgba(255, 255, 255, 0.22)';
  let dotColor = '#34D399';
  let textColor = '#F8FAFC';

  if (isCritical) {
    bgColor = 'rgba(239, 68, 68, 0.36)';
    borderColor = '#EF4444';
    dotColor = '#FCA5A5';
    textColor = '#FFFFFF';
  } else if (isWarning) {
    bgColor = 'rgba(245, 158, 11, 0.26)';
    borderColor = '#F59E0B';
    dotColor = '#FBBF24';
    textColor = '#FEF3C7';
  }

  return (
    <Animated.View
      testID="match-timer-badge"
      accessibilityLabel={`Match time remaining ${label}`}
      style={[
        styles.pill,
        {
          backgroundColor: bgColor,
          borderColor,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.timeText, { color: textColor }]}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
});
