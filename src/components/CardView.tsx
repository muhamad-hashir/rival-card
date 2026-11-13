// src/components/CardView.tsx - Visual Card Component for Rival Card with PNG Action Icons & Card Back
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { COLOR_HEX } from '../types';
import type { Card } from '../types';
import { hapticsService } from '../services/hapticsService';
import { FONT_CARTOON_HEAVY } from '../styles/typography';

const CARD_BACK_IMAGE = require('../../assets/card_back.png');

const ACTION_ICONS: Record<string, any> = {
  skip: require('../../assets/icons/icon_skip.png'),
  reverse: require('../../assets/icons/icon_reverse.png'),
  draw2: require('../../assets/icons/icon_draw2.png'),
  wild: require('../../assets/icons/icon_wild_color_change.png'),
  wild_draw4: require('../../assets/icons/icon_wild_4.png'),
  mute: require('../../assets/icons/icon_mute.png'),
  rival_swap: require('../../assets/icons/icon_swap.png'),
};

export interface CardViewProps {
  card?: Card;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  disabled?: boolean;
  isSelected?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  cardBackStyle?: {
    primaryColor?: string;
    borderColor?: string;
  };
  activeColor?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isFaceDown = false,
  isPlayable = true,
  disabled = false,
  isSelected = false,
  size = 'medium',
  onPress,
  style,
  cardBackStyle,
  activeColor,
}) => {
  const [imageError, setImageError] = useState(false);
  const dimensions = getCardDimensions(size);

  const handlePress = () => {
    if (onPress) {
      hapticsService.cardSelection();
      onPress();
    }
  };

  // Face-down card: Render assets/card_back.png with clean rounded borders & fallback
  if (isFaceDown || !card) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={disabled || !onPress}
        style={[
          styles.cardBase,
          dimensions.container,
          { borderWidth: size === 'small' ? 1.5 : 2 },
          styles.faceDownCard,
          cardBackStyle?.primaryColor ? { backgroundColor: cardBackStyle.primaryColor } : null,
          cardBackStyle?.borderColor ? { borderColor: cardBackStyle.borderColor } : null,
          style,
        ]}
      >
        <Image
          source={CARD_BACK_IMAGE}
          style={[
            styles.cardBackImage,
            { borderRadius: Math.max(0, dimensions.container.borderRadius - 1.5) },
            cardBackStyle?.primaryColor && cardBackStyle.primaryColor !== '#1E293B'
              ? { tintColor: cardBackStyle.primaryColor }
              : null,
          ]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  const isWild = card.color === 'wild';
  const activeHex =
    activeColor &&
    (COLOR_HEX[activeColor as keyof typeof COLOR_HEX] ||
      (activeColor.startsWith('#') ? activeColor : undefined));

  // If wild and an active color is chosen (e.g. on discard pile), tint card face and borders to active color
  const bgColor = isWild && activeHex ? activeHex : COLOR_HEX[card.color];
  const label = getCardDisplayLabel(card.value);
  const cornerLabel = getCornerDisplayLabel(card.value);
  const actionIcon = ACTION_ICONS[card.value];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={disabled || !onPress}
      style={[
        styles.cardBase,
        dimensions.container,
        {
          backgroundColor: bgColor,
          borderWidth: size === 'small' ? 1.5 : 2,
          borderColor: isWild && activeHex ? '#FFFFFF' : '#FFFFFF',
        },
        isPlayable && !disabled && styles.playableCard,
        (!isPlayable || disabled) && styles.unplayableCard,
        isSelected && styles.selectedCard,
        style,
      ]}
    >
      {/* Outer Inner Container */}
      <View
        style={[
          styles.cardInnerBorder,
          isWild && activeHex ? { borderColor: 'rgba(255, 255, 255, 0.75)' } : null,
        ]}
      >
        {/* Top-Left Corner Badge */}
        <View style={styles.topLeftCorner}>
          <Text style={[styles.cornerText, dimensions.cornerText]}>
            {cornerLabel}
          </Text>
        </View>

        {/* Center Oval Visual */}
        <View
          style={[
            styles.centerOval,
            dimensions.centerOval,
            isWild && activeHex ? { borderWidth: 2.5, borderColor: activeHex } : null,
          ]}
        >
          {card.value === 'reverse' ? (
            <View style={styles.actionIconContainer}>
              <ReverseArrowsMotif size={size} color={bgColor} />
            </View>
          ) : actionIcon && !imageError ? (
            <View style={styles.actionIconContainer}>
              <Image
                source={actionIcon}
                style={dimensions.actionIcon}
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            </View>
          ) : isWild ? (
            <View style={styles.wildCenterContainer}>
              <View style={styles.wildBadgeGrid}>
                <View style={[styles.wildDot, { backgroundColor: COLOR_HEX.red }]} />
                <View style={[styles.wildDot, { backgroundColor: COLOR_HEX.blue }]} />
                <View style={[styles.wildDot, { backgroundColor: COLOR_HEX.yellow }]} />
                <View style={[styles.wildDot, { backgroundColor: COLOR_HEX.green }]} />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.wildCenterText, dimensions.centerText]}
              >
                {label}
              </Text>
            </View>
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.centerValueText, dimensions.centerText, { color: bgColor }]}
            >
              {label}
            </Text>
          )}
        </View>

        {/* Bottom-Right Corner Badge */}
        <View style={styles.bottomRightCorner}>
          <Text style={[styles.cornerText, dimensions.cornerText]}>
            {cornerLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function getCardDimensions(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        container: { width: 34, height: 50, borderRadius: 6 },
        centerOval: { width: 20, height: 30, borderRadius: 10 },
        centerText: { fontSize: 10 },
        cornerText: { fontSize: 6.5 },
        actionIcon: { width: 13, height: 13 },
      };
    case 'large':
      return {
        container: { width: 78, height: 114, borderRadius: 10 },
        centerOval: { width: 56, height: 80, borderRadius: 28 },
        centerText: { fontSize: 22 },
        cornerText: { fontSize: 11 },
        actionIcon: { width: 38, height: 38 },
      };
    case 'medium':
    default:
      return {
        container: { width: 62, height: 90, borderRadius: 9 },
        centerOval: { width: 44, height: 62, borderRadius: 22 },
        centerText: { fontSize: 17 },
        cornerText: { fontSize: 9.5 },
        actionIcon: { width: 28, height: 28 },
      };
  }
}

function getCardDisplayLabel(value: string): string {
  switch (value) {
    case 'skip':
      return 'SKIP';
    case 'reverse':
      return 'REV';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'WILD';
    case 'wild_draw4':
      return '+4';
    case 'mute':
      return 'MUTE';
    case 'rival_swap':
      return 'SWAP';
    default:
      return value;
  }
}

function getCornerDisplayLabel(value: string): string {
  switch (value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '↻';
    case 'draw2':
      return '+2';
    case 'wild':
      return '★';
    case 'wild_draw4':
      return '+4';
    case 'mute':
      return '🔇';
    case 'rival_swap':
      return '🔄';
    default:
      return value;
  }
}

// Iconic curved, dynamic circular looping vector arrows for Reverse cards
const ReverseArrowsMotif: React.FC<{ size: 'small' | 'medium' | 'large'; color: string }> = ({
  size,
  color,
}) => {
  const isSmall = size === 'small';
  const isLarge = size === 'large';
  const stroke = isSmall ? 2 : isLarge ? 3.5 : 2.8;
  const boxW = isSmall ? 15 : isLarge ? 34 : 26;
  const boxH = isSmall ? 14 : isLarge ? 30 : 23;
  const arrowHead = isSmall ? 3 : isLarge ? 6 : 4.5;

  return (
    <View style={[styles.reverseMotifBox, { width: boxW, height: boxH }]}>
      {/* Top curving arrow looping clockwise to right */}
      <View style={[styles.reverseArrowGroupTop, { height: boxH * 0.6 }]}>
        <View
          style={[
            styles.reverseArcTop,
            {
              borderColor: color,
              borderTopWidth: stroke,
              borderLeftWidth: stroke,
              borderTopLeftRadius: boxW * 0.5,
              borderTopRightRadius: boxW * 0.3,
            },
          ]}
        />
        <View
          style={[
            styles.reverseArrowHeadRight,
            {
              borderTopWidth: arrowHead,
              borderBottomWidth: arrowHead,
              borderLeftWidth: arrowHead * 1.6,
              borderLeftColor: color,
              top: -arrowHead + stroke / 2,
              right: -1,
            },
          ]}
        />
      </View>

      {/* Bottom curving arrow looping clockwise to left */}
      <View style={[styles.reverseArrowGroupBottom, { height: boxH * 0.6 }]}>
        <View
          style={[
            styles.reverseArcBottom,
            {
              borderColor: color,
              borderBottomWidth: stroke,
              borderRightWidth: stroke,
              borderBottomRightRadius: boxW * 0.5,
              borderBottomLeftRadius: boxW * 0.3,
            },
          ]}
        />
        <View
          style={[
            styles.reverseArrowHeadLeft,
            {
              borderTopWidth: arrowHead,
              borderBottomWidth: arrowHead,
              borderRightWidth: arrowHead * 1.6,
              borderRightColor: color,
              bottom: -arrowHead + stroke / 2,
              left: -1,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 1.0,
  },
  cardBackImage: {
    width: '100%',
    height: '100%',
  },
  playableCard: {
    borderColor: '#34D399',
    borderWidth: 2.5,
    shadowColor: '#10B981',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
    opacity: 1.0,
    transform: [{ translateY: -6 }],
  },
  unplayableCard: {
    opacity: 0.72,
  },
  selectedCard: {
    borderColor: '#F59E0B',
    borderWidth: 2.5,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    opacity: 1.0,
  },
  cardInnerBorder: {
    width: '100%',
    height: '100%',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topLeftCorner: {
    position: 'absolute',
    top: 3,
    left: 4,
  },
  bottomRightCorner: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    transform: [{ rotate: '180deg' }],
  },
  cornerText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 1 },
    textShadowRadius: 1.5,
    letterSpacing: -0.3,
    opacity: 1.0,
  },
  centerOval: {
    backgroundColor: '#FFFDF5',
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-18deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3.5,
    elevation: 3,
    opacity: 1.0,
  },
  actionIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '18deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  reverseMotifBox: {
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  reverseArrowGroupTop: {
    width: '100%',
    position: 'relative',
  },
  reverseArcTop: {
    width: '85%',
    height: '100%',
    alignSelf: 'flex-start',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  reverseArrowHeadLeft: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftWidth: 0,
  },
  reverseArrowGroupBottom: {
    width: '100%',
    position: 'relative',
  },
  reverseArcBottom: {
    width: '85%',
    height: '100%',
    alignSelf: 'flex-end',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  reverseArrowHeadRight: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightWidth: 0,
  },
  centerValueText: {
    ...FONT_CARTOON_HEAVY,
    transform: [{ rotate: '18deg' }],
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowOffset: { width: 0.5, height: 1 },
    textShadowRadius: 1,
    opacity: 1.0,
  },
  wildCenterContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '18deg' }],
  },
  wildBadgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 16,
    height: 16,
    marginBottom: 2,
  },
  wildDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    margin: 0.5,
  },
  wildCenterText: {
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
  },
  faceDownCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
});
