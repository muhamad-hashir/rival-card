// src/screens/LoadingScreen.tsx - Custom Animated Splash & Loading Screen for Rival Card
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Easing,
} from 'react-native';

export interface LoadingScreenProps {
  progress?: number;
  status?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress = 0,
  status = 'Checking cards...',
}) => {
  const animProgress = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: Math.min(Math.max(progress, 0), 100),
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, animProgress]);

  const widthInterpolation = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.centerCard}>
        {/* Playful Decorative Deck Icon / Emblem */}
        <View style={styles.emblemContainer}>
          <View style={[styles.miniCard, styles.miniCardBack]} />
          <View style={[styles.miniCard, styles.miniCardFront]}>
            <Text style={styles.miniCardSymbol}>⚡</Text>
          </View>
        </View>

        {/* Game Title */}
        <Text style={styles.title}>RIVAL CARD</Text>
        <Text style={styles.subtitle}>FAST-PACED CARD BATTLES</Text>

        {/* Animated Loading Bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: widthInterpolation },
            ]}
          />
        </View>

        {/* Status Text */}
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 320,
    width: '100%',
  },
  emblemContainer: {
    width: 64,
    height: 72,
    marginBottom: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    width: 44,
    height: 60,
    borderRadius: 8,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#E2D9C8',
  },
  miniCardBack: {
    backgroundColor: '#EF4444',
    transform: [{ rotate: '-12deg' }, { translateX: -8 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  miniCardFront: {
    backgroundColor: '#3B82F6',
    transform: [{ rotate: '8deg' }, { translateX: 8 }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  miniCardSymbol: {
    fontSize: 20,
  },
  title: {
    fontFamily: Platform.select({
      web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_700Bold',
    }),
    fontWeight: '800',
    fontSize: 32,
    color: '#0F172A',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Platform.select({
      web: '"Fredoka_600SemiBold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_600SemiBold',
    }),
    fontWeight: '700',
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 28,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: 220,
    height: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 8,
  },
  statusText: {
    marginTop: 14,
    fontSize: 14,
    color: '#64748B',
    fontFamily: Platform.select({
      web: '"Fredoka_500Medium", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_500Medium',
    }),
    fontWeight: '600',
    textAlign: 'center',
  },
});
