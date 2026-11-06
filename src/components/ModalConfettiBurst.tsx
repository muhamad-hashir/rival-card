// src/components/ModalConfettiBurst.tsx - Lightweight Winner-Only Confetti Burst Constrained Inside Leaderboard Card
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface Particle {
  id: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  startXPercent: number;
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

const NUM_PARTICLES = 36;

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    // Spread horizontally across the top edge of the leaderboard card container
    const startXPercent = 5 + Math.random() * 90;
    // Downward gravity cascade distance inside the leaderboard card bounds
    const dy = 55 + Math.random() * 160;
    // Gentle horizontal sway
    const dx = (Math.random() - 0.5) * 45;
    const isRound = Math.random() > 0.55;

    particles.push({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: isRound ? 7 : 5 + Math.random() * 4,
      height: isRound ? 7 : 10 + Math.random() * 6,
      borderRadius: isRound ? 3.5 : 2,
      startXPercent,
      dx,
      dy,
      rotation: `${(Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360)}deg`,
    });
  }
  return particles;
}

export interface ModalConfettiBurstProps {
  active: boolean;
}

export const ModalConfettiBurst: React.FC<ModalConfettiBurstProps> = ({ active }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return;
    }

    particlesRef.current = generateParticles();
    anim.setValue(0);

    Animated.timing(anim, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, anim]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particlesRef.current.map((p) => {
        const translateX = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, p.dx * 0.6, p.dx],
        });

        // Downward cascade from top origin
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.dy],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', p.rotation],
        });

        const scale = anim.interpolate({
          inputRange: [0, 0.15, 0.8, 1],
          outputRange: [0.3, 1.1, 1, 0.4],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.1, 0.75, 1],
          outputRange: [0, 1, 0.9, 0],
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
                top: 2,
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
    zIndex: 3,
  },
  particle: {
    position: 'absolute',
  },
});
