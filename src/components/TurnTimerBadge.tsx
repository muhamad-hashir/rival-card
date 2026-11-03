// src/components/TurnTimerBadge.tsx - Animated Circular / Pill Turn Countdown Timer Badge
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';

export interface TurnTimerBadgeProps {
  seconds: number;
  totalDuration?: number;
  size?: 'normal' | 'compact';
}

export const TurnTimerBadge: React.FC<TurnTimerBadgeProps> = ({
  seconds,
  totalDuration = 15,
  size = 'normal',
}) => {
  const isUrgent = seconds <= 3;
  const isWarning = seconds <= 5 && !isUrgent;

  // Pulse animation for urgent red state (seconds <= 3)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isUrgent && seconds > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.16,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [seconds, isUrgent, pulseAnim]);

  // Determine colors based on urgency state
  let primaryColor = '#22C55E'; // Normal: Emerald green
  let bgColor = 'rgba(34, 197, 94, 0.18)';
  let borderColor = '#22C55E';

  if (isUrgent) {
    primaryColor = '#EF4444'; // Urgent: Vibrant Red
    bgColor = 'rgba(239, 68, 68, 0.28)';
    borderColor = '#EF4444';
  } else if (isWarning) {
    primaryColor = '#F59E0B'; // Warning: Amber
    bgColor = 'rgba(245, 158, 11, 0.22)';
    borderColor = '#F59E0B';
  }

  const isCompact = size === 'compact';

  return (
    <Animated.View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        {
          backgroundColor: bgColor,
          borderColor,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Mini Circular Progress Ring */}
      <View
        style={[
          styles.miniRing,
          isCompact && styles.miniRingCompact,
          { borderColor: primaryColor },
        ]}
      >
        <View
          style={[
            styles.miniDot,
            isCompact && styles.miniDotCompact,
            { backgroundColor: primaryColor },
          ]}
        />
      </View>

      {/* Numeric Readout */}
      <Text
        style={[
          styles.timeText,
          isCompact && styles.timeTextCompact,
          { color: primaryColor },
        ]}
      >
        {seconds}s
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    marginHorizontal: 3,
  },
  containerCompact: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 3,
    marginHorizontal: 2,
  },
  miniRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRingCompact: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  miniDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  miniDotCompact: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
  },
  timeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  timeTextCompact: {
    ...FONT_CARTOON_BOLD,
    fontSize: 9.5,
    letterSpacing: 0,
  },
});
