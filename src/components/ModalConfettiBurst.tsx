// src/components/ModalConfettiBurst.tsx - Full-Window Winner Celebration Confetti Overlay
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

interface Particle {
  id: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  startXPercent: number;
  startYOffset: number;
  dx: number;
  dy: number;
  rotation: string;
}

const CONFETTI_COLORS = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#FACC15', // Yellow
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
];

const NUM_PARTICLES = 56;

function generateParticles(windowHeight: number): Particle[] {
  const particles: Particle[] = [];
  const fallRange = Math.max(360, windowHeight);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const startXPercent = 2 + Math.random() * 96;
    const startYOffset = -20 - Math.random() * 70;
    const dy = fallRange * (0.55 + Math.random() * 0.55);
    const dx = (Math.random() - 0.5) * 90;
    const isRound = Math.random() > 0.52;

    particles.push({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: isRound ? 8 : 6 + Math.random() * 5,
      height: isRound ? 8 : 11 + Math.random() * 7,
      borderRadius: isRound ? 4 : 2,
      startXPercent,
      startYOffset,
      dx,
      dy,
      rotation: `${(Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 480)}deg`,
    });
  }
  return particles;
}

export interface ModalConfettiBurstProps {
  active: boolean;
}

export const ModalConfettiBurst: React.FC<ModalConfettiBurstProps> = ({ active }) => {
  const { height: windowHeight } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return;
    }

    particlesRef.current = generateParticles(windowHeight);
    anim.setValue(0);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, anim, windowHeight]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particlesRef.current.map((p) => {
        const translateX = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, p.dx * 0.65, p.dx],
        });

        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startYOffset, p.dy],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', p.rotation],
        });

        const scale = anim.interpolate({
          inputRange: [0, 0.12, 0.85, 1],
          outputRange: [0.4, 1.12, 1, 0.5],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.08, 0.8, 1],
          outputRange: [0, 1, 0.92, 0],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                width: p.width,
                height: p.height,
                borderRadius: p.borderRadius,
                left: `${p.startXPercent}%`,
                top: 0,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 24,
  },
  particle: {
    position: 'absolute',
  },
});
