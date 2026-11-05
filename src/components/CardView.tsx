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
          {actionIcon && !imageError ? (
            <Image
              source={actionIcon}
              style={dimensions.actionIcon}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
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
        container: { width: 36, height: 54, borderRadius: 6 },
        centerOval: { width: 22, height: 32, borderRadius: 11 },
        centerText: { fontSize: 11 },
        cornerText: { fontSize: 7 },
        actionIcon: { width: 14, height: 14 },
      };
    case 'large':
      return {
        container: { width: 92, height: 138, borderRadius: 12 },
        centerOval: { width: 68, height: 96, borderRadius: 34 },
        centerText: { fontSize: 26 },
        cornerText: { fontSize: 13 },
        actionIcon: { width: 48, height: 48 },
      };
    case 'medium':
    default:
      return {
        container: { width: 72, height: 108, borderRadius: 10 },
        centerOval: { width: 52, height: 74, borderRadius: 26 },
        centerText: { fontSize: 20 },
        cornerText: { fontSize: 11 },
        actionIcon: { width: 34, height: 34 },
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
      return '⇄';
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
    borderColor: '#38BDF8',
    borderWidth: 2.5,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 7,
    opacity: 1.0,
    transform: [{ translateY: -4 }],
  },
  unplayableCard: {
    opacity: 0.90,
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
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 1.0,
  },
  centerOval: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-18deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    opacity: 1.0,
  },
  centerValueText: {
    fontWeight: '900',
    transform: [{ rotate: '18deg' }],
    textAlign: 'center',
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
