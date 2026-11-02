// src/components/FlyingCard.tsx - Animated Flying Card for Dealing & Draws using Reanimated
import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CARD_BACK_IMAGE = require('../../assets/card_back.png');

export interface FlyingCardData {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  duration?: number;
  targetScale?: number;
  onArrival?: () => void;
}

interface FlyingCardProps extends FlyingCardData {
  onComplete: (id: string) => void;
}

export const FlyingCard: React.FC<FlyingCardProps> = ({
  id,
  startX,
  startY,
  targetX,
  targetY,
  duration = 280,
  targetScale = 1.0,
  onComplete,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)(id);
        }
      }
    );
  }, [duration, id, onComplete]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const x = startX + (targetX - startX) * p;
    // Add subtle arc in the fly motion
    const arc = -35 * Math.sin(p * Math.PI);
    const y = startY + (targetY - startY) * p + arc;
    const scale = 1 + (targetScale - 1) * p;
    const rotate = `${((p * 24) - 12).toFixed(1)}deg`;
    const opacity = p < 0.05 ? p * 20 : p > 0.95 ? (1 - p) * 20 : 1;

    return {
      position: 'absolute',
      left: x - 42,
      top: y - 61,
      width: 84,
      height: 122,
      transform: [
        { scale },
        { rotateZ: rotate },
      ],
      opacity,
      zIndex: 9999,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.flyingCard, animatedStyle]}>
      <Image
        source={CARD_BACK_IMAGE}
        style={styles.cardBackImage}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flyingCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  cardBackImage: {
    width: '100%',
    height: '100%',
  },
});
