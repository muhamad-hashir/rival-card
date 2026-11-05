// src/components/ModalConfettiBurst.tsx - Lightweight Winner-Only Confetti Burst Constrained Inside GameOver Modal
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface Particle {
  id: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
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

const NUM_PARTICLES = 40;

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    // Upward-biased radial explosion angle (-180 deg to 0 deg with horizontal spread)
    const angle = ((-180 + Math.random() * 180) * Math.PI) / 180;
    const distance = 45 + Math.random() * 115;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const isRound = Math.random() > 0.55;

    particles.push({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: isRound ? 8 : 6 + Math.random() * 4,
      height: isRound ? 8 : 12 + Math.random() * 6,
      borderRadius: isRound ? 4 : 2,
      dx,
      dy,
      rotation: `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`,
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
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, anim]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particlesRef.current.map((p) => {
        const translateX = anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, p.dx * 0.7, p.dx],
        });

        // Arc with gravity fall
        const translateY = anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, p.dy, p.dy + 80],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', p.rotation],
        });

        const scale = anim.interpolate({
          inputRange: [0, 0.2, 0.8, 1],
          outputRange: [0.2, 1.2, 1, 0],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 1, 1, 0],
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
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
  },
});
