// src/screens/LoadingScreen.tsx - Vibrant Cartoon Arcade Splash & Loading Screen for Rival Card
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Easing,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LoadingScreenProps {
  progress?: number;
  status?: string;
}

const SUNBURST_RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress = 0,
  status = 'Checking cards...',
}) => {
  const animProgress = useRef(new Animated.Value(progress)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Smooth progress bar animation (interpolates smoothly to the target progress)
  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: Math.min(Math.max(progress, 0), 100),
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, animProgress]);

  // Ambient rotating comic sunburst
  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 36000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [spinAnim]);

  // Gentle bouncing floating cartoon cards
  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoop.start();
    return () => bounceLoop.stop();
  }, [bounceAnim]);

  const widthInterpolation = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const sunburstSpin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background Sunburst Comic Rays */}
      <View style={styles.sunburstWrapper} pointerEvents="none">
        <Animated.View
          style={[
            styles.sunburstContainer,
            { transform: [{ rotate: sunburstSpin }] },
          ]}
        >
          {SUNBURST_RAYS.map((deg) => (
            <View
              key={deg}
              style={[
                styles.sunburstRay,
                { transform: [{ rotate: `${deg}deg` }] },
              ]}
            />
          ))}
        </Animated.View>
      </View>

      {/* Centered Content Card */}
      <View style={styles.centerContent}>
        {/* Floating Cartoon Emblem Cards */}
        <Animated.View
          style={[
            styles.emblemContainer,
            { transform: [{ translateY: bounceAnim }] },
          ]}
        >
          {/* Back Card (Red) */}
          <View style={[styles.miniCard, styles.miniCardBack]}>
            <View style={styles.miniCardBackInner} />
          </View>
          {/* Front Card (Blue with Star/Lightning) */}
          <View style={[styles.miniCard, styles.miniCardFront]}>
            <View style={styles.miniCardEmblemCircle}>
              <Text style={styles.miniCardSymbol}>⚡</Text>
            </View>
          </View>
        </Animated.View>

        {/* Game Title Header */}
        <Text style={styles.title}>RIVAL CARD</Text>
        <Text style={styles.subtitle}>FAST-PACED CARD BATTLES</Text>

        {/* Progress Bar Container */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { width: widthInterpolation },
              ]}
            >
              {/* Gloss Shine Strip */}
              <View style={styles.glossShine} />
            </Animated.View>
          </View>
        </View>

        {/* Playful Status Banner Badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7', // Warm cartoon cream background
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  sunburstWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sunburstContainer: {
    width: Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.8,
    height: Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sunburstRay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    marginLeft: -45,
    marginTop: -550,
    borderLeftWidth: 45,
    borderRightWidth: 45,
    borderBottomWidth: 550,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(251, 191, 36, 0.12)', // Warm golden/orange radiating burst
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 340,
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  emblemContainer: {
    width: 76,
    height: 80,
    marginBottom: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    width: 48,
    height: 68,
    borderRadius: 12,
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#2D1F17',
    shadowColor: '#2D1F17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 6,
  },
  miniCardBack: {
    backgroundColor: '#EF4444',
    transform: [{ rotate: '-14deg' }, { translateX: -10 }],
    padding: 3,
  },
  miniCardBackInner: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: '#DC2626',
  },
  miniCardFront: {
    backgroundColor: '#3B82F6',
    transform: [{ rotate: '10deg' }, { translateX: 10 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardEmblemCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2D1F17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardSymbol: {
    fontSize: 15,
  },
  title: {
    fontFamily: Platform.select({
      web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_700Bold',
    }),
    fontWeight: '900',
    fontSize: 34,
    color: '#FACC15', // Vibrant golden arcade yellow
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: '#2D1F17',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Platform.select({
      web: '"Fredoka_600SemiBold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_600SemiBold',
    }),
    fontWeight: '700',
    fontSize: 11,
    color: '#78350F',
    letterSpacing: 2,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarWrapper: {
    width: 240,
    shadowColor: '#2D1F17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 6,
  },
  progressBarContainer: {
    width: '100%',
    height: 24,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#2D1F17',
    backgroundColor: '#FDE8B5', // Warm cartoon pill background
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 3,
    borderBottomColor: '#16A34A', // Darker emerald rim
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  glossShine: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)', // Arcade gloss shine bar
  },
  statusBadge: {
    marginTop: 18,
    backgroundColor: '#FFFDF7',
    borderWidth: 2.5,
    borderColor: '#2D1F17',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#2D1F17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  statusText: {
    color: '#2D1F17', // Deep chocolate
    fontFamily: Platform.select({
      web: '"Fredoka_700Bold", "Fredoka", system-ui, -apple-system, sans-serif',
      default: 'Fredoka_700Bold',
    }),
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
