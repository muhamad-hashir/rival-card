// src/components/DraggableCard.tsx - Gesture-enabled Draggable Card with UNO Mobile Lift & Overlap
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CardView } from './CardView';
import { hapticsService } from '../services/hapticsService';
import type { Card } from '../types';

interface DraggableCardProps {
  card: Card;
  isPlayable: boolean;
  disabled?: boolean;
  isSelected?: boolean;
  isTutorialHighlighted?: boolean;
  zIndex?: number;
  overlapMargin?: number;
  onPlay: (card: Card) => void;
  onTap?: (card: Card) => void;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  card,
  isPlayable,
  disabled = false,
  isSelected = false,
  isTutorialHighlighted = false,
  zIndex = 1,
  overlapMargin = 0,
  onPlay,
  onTap,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const liftY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const isPressed = useSharedValue(false);
  const scale = useSharedValue(1);
  const tutorialPulse = useSharedValue(1);

  useEffect(() => {
    if (isTutorialHighlighted) {
      tutorialPulse.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 480 }),
          withTiming(1.0, { duration: 480 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(tutorialPulse);
      tutorialPulse.value = withTiming(1, { duration: 150 });
    }
  }, [isTutorialHighlighted]);

  useEffect(() => {
    if (isSelected || isTutorialHighlighted) {
      liftY.value = withSpring(-16, { damping: 15, stiffness: 220 });
    } else if (!isPressed.value && !isDragging.value) {
      liftY.value = withSpring(0, { damping: 15, stiffness: 220 });
    }
  }, [isSelected, isTutorialHighlighted]);

  const handleDragStartHaptic = () => {
    hapticsService.cardSnap();
  };

  const handlePlayCardJS = () => {
    onPlay(card);
  };

  const handleTapCardJS = () => {
    if (onTap) {
      onTap(card);
    } else {
      onPlay(card);
    }
  };

  // Pan gesture for dragging card upwards onto discard arena
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      isPressed.value = true;
      liftY.value = withSpring(-16, { damping: 15, stiffness: 220 });
      scale.value = withSpring(1.06, { damping: 15 });
      runOnJS(handleDragStartHaptic)();
    })
    .onUpdate((event) => {
      isDragging.value = true;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      isPressed.value = false;
      scale.value = withSpring(1);

      // If dragged upwards past the drop threshold (-48px)
      if (isPlayable && event.translationY < -48) {
        runOnJS(handlePlayCardJS)();
      }

      translateX.value = withSpring(0, { damping: 14 });
      translateY.value = withSpring(0, { damping: 14 });
      if (!isSelected) {
        liftY.value = withSpring(0, { damping: 15, stiffness: 220 });
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      isPressed.value = false;
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      if (!isSelected) {
        liftY.value = withSpring(0, { damping: 15, stiffness: 220 });
      }
    });

  // Tap gesture for quick tap-to-play
  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      isPressed.value = true;
      liftY.value = withSpring(-16, { damping: 15, stiffness: 220 });
    })
    .onEnd(() => {
      isPressed.value = false;
      if (!isSelected) {
        liftY.value = withSpring(0, { damping: 15, stiffness: 220 });
      }
      runOnJS(handleTapCardJS)();
    })
    .onFinalize(() => {
      isPressed.value = false;
      if (!isSelected) {
        liftY.value = withSpring(0, { damping: 15, stiffness: 220 });
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const rotateZ = `${(translateX.value / 180) * 15}deg`;
    const currentY = translateY.value + liftY.value;
    const isElevated =
      isDragging.value ||
      isPressed.value ||
      isSelected ||
      isTutorialHighlighted ||
      liftY.value < -4;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: currentY },
        { rotateZ },
        { scale: scale.value * tutorialPulse.value },
      ],
      zIndex: isElevated ? 999 : zIndex,
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.cardContainer,
          isTutorialHighlighted && styles.tutorialGlowContainer,
          { marginLeft: overlapMargin, zIndex },
          animatedStyle,
        ]}
      >
        <CardView
          card={card}
          size="medium"
          isPlayable={isPlayable}
          isSelected={isSelected}
          disabled={disabled}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    paddingTop: 2,
    paddingBottom: 0,
  },
  tutorialGlowContainer: {
    borderRadius: 14,
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 12,
  },
});
