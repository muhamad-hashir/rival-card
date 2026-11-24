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

const CARD_BACK_IMAGE = require('../../assets/store/card_backs/classic_back.png');

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
  cardBackImage?: any;
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
  cardBackImage,
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

  // Face-down card: Render equipped card back PNG with clean rounded borders & fallback
  if (isFaceDown || !card) {
    const resolvedBackSource = cardBackImage || CARD_BACK_IMAGE;
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
          source={resolvedBackSource}
          style={[
            styles.cardBackImage,
            { borderRadius: Math.max(0, dimensions.container.borderRadius - 1.5) },
            !cardBackImage && cardBackStyle?.primaryColor && cardBackStyle.primaryColor !== '#1E293B'
              ? { tintColor: cardBackStyle.primaryColor }
              : null,
          ]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  const isWild = card.color === 'wild';
  const isShield = card.value === 'shield';
  const isMirror = card.value === 'mirror';
  const activeHex =
    activeColor &&
    (COLOR_HEX[activeColor as keyof typeof COLOR_HEX] ||
      (activeColor.startsWith('#') ? activeColor : undefined));

  // If wild and an active color is chosen (e.g. on discard pile), tint card face and borders to active color
  const customCardBg = isShield ? '#0F2B46' : isMirror ? '#3B1D6E' : COLOR_HEX[card.color];
  const bgColor = isWild && activeHex ? activeHex : customCardBg;
  const customBorderColor =
    isWild && activeHex
      ? '#FFFFFF'
      : isShield
      ? '#FBBF24'
      : isMirror
      ? '#DDD6FE'
      : '#FFFFFF';
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
          borderColor: customBorderColor,
        },
        isPlayable && !disabled && styles.playableCard,
        (!isPlayable || disabled) && styles.unplayableCard,
        isSelected && styles.selectedCard,
        style,
      ]}
    >
      {/* Subtle Cosmic / Arcane Corner Accent */}
      {isShield && !activeHex && <View style={styles.shieldCosmicHalo} pointerEvents="none" />}
      {isMirror && !activeHex && <View style={styles.mirrorArcaneHalo} pointerEvents="none" />}

      {/* Outer Inner Container */}
      <View
        style={[
          styles.cardInnerBorder,
          isWild && activeHex ? { borderColor: 'rgba(255, 255, 255, 0.75)' } : null,
        ]}
      >
        {/* Top-Left Corner Badge */}
        <View style={styles.topLeftCorner}>
          {card.value === 'reverse' ? (
            <View style={styles.cornerMotifShadow}>
              <ReverseArrowsMotif
                size={size === 'small' ? 'corner_small' : size === 'large' ? 'corner_large' : 'corner_medium'}
                color="#FFFFFF"
              />
            </View>
          ) : (
            <Text style={[styles.cornerText, dimensions.cornerText]}>
              {cornerLabel}
            </Text>
          )}
        </View>

        {/* Center Oval Visual */}
        <View
          style={[
            styles.centerOval,
            dimensions.centerOval,
            isShield && !activeHex ? styles.shieldCenterOval : null,
            isMirror && !activeHex ? styles.mirrorCenterOval : null,
            isWild && activeHex ? { borderWidth: 2.5, borderColor: activeHex } : null,
          ]}
        >
          {card.value === 'reverse' ? (
            <View style={styles.actionIconContainer}>
              <ReverseArrowsMotif size={size} color={bgColor} />
            </View>
          ) : isShield ? (
            <View style={styles.actionIconContainer}>
              <ShieldEmblemMotif size={size} />
            </View>
          ) : isMirror ? (
            <View style={styles.actionIconContainer}>
              <MirrorEmblemMotif size={size} />
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
          {card.value === 'reverse' ? (
            <View style={styles.cornerMotifShadow}>
              <ReverseArrowsMotif
                size={size === 'small' ? 'corner_small' : size === 'large' ? 'corner_large' : 'corner_medium'}
                color="#FFFFFF"
              />
            </View>
          ) : (
            <Text style={[styles.cornerText, dimensions.cornerText]}>
              {cornerLabel}
            </Text>
          )}
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
    case 'shield':
      return 'SHIELD';
    case 'mirror':
      return 'MIRROR';
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
    case 'shield':
      return '🛡️';
    case 'mirror':
      return '🪞';
    default:
      return value;
  }
}

type ReverseMotifSize = 'corner_small' | 'corner_medium' | 'corner_large' | 'small' | 'medium' | 'large';

const SingleCurvedArrow: React.FC<{
  width: number;
  arcH: number;
  stroke: number;
  arrowHead: number;
  color: string;
}> = ({ width, arcH, stroke, arrowHead, color }) => {
  const headWidth = arrowHead * 1.45;
  const stemWidth = Math.max(4, width - headWidth + 1.5);
  return (
    <View style={[styles.reverseArrowHalf, { width, height: arcH }]}>
      <View
        style={[
          styles.reverseArcStem,
          {
            width: stemWidth,
            height: arcH,
            borderColor: color,
            borderTopWidth: stroke,
            borderLeftWidth: stroke,
            borderTopLeftRadius: arcH * 0.9,
            borderBottomLeftRadius: stroke * 0.5,
          },
        ]}
      />
      <View
        style={[
          styles.reverseArrowHeadRight,
          {
            borderTopWidth: arrowHead,
            borderBottomWidth: arrowHead,
            borderLeftWidth: headWidth,
            borderLeftColor: color,
            top: stroke / 2 - arrowHead,
            right: 0,
          },
        ]}
      />
    </View>
  );
};

// Iconic curved circular looping vector arrows for Reverse cards with flush tangent arrowheads
const ReverseArrowsMotif: React.FC<{ size: ReverseMotifSize; color: string }> = ({
  size,
  color,
}) => {
  const metrics: Record<ReverseMotifSize, { boxW: number; boxH: number; stroke: number; arrowHead: number }> = {
    corner_small: { boxW: 8, boxH: 7.5, stroke: 1.2, arrowHead: 1.9 },
    corner_medium: { boxW: 11, boxH: 10, stroke: 1.6, arrowHead: 2.5 },
    corner_large: { boxW: 13, boxH: 12, stroke: 1.9, arrowHead: 2.9 },
    small: { boxW: 15, boxH: 14, stroke: 2, arrowHead: 3 },
    medium: { boxW: 26, boxH: 23, stroke: 2.8, arrowHead: 4.5 },
    large: { boxW: 34, boxH: 30, stroke: 3.5, arrowHead: 5.8 },
  };
  const { boxW, boxH, stroke, arrowHead } = metrics[size];
  const arcH = boxH * 0.54;

  return (
    <View style={[styles.reverseMotifBox, { width: boxW, height: boxH }]}>
      <View style={[styles.reverseArrowLayerTop, { width: boxW, height: arcH }]}>
        <SingleCurvedArrow width={boxW} arcH={arcH} stroke={stroke} arrowHead={arrowHead} color={color} />
      </View>
      <View style={[styles.reverseArrowLayerBottom, { width: boxW, height: arcH }]}>
        <SingleCurvedArrow width={boxW} arcH={arcH} stroke={stroke} arrowHead={arrowHead} color={color} />
      </View>
    </View>
  );
};

// Golden Sun-Crest Shield emblem for Shield card
const ShieldEmblemMotif: React.FC<{ size: 'small' | 'medium' | 'large' }> = ({ size }) => {
  const isSmall = size === 'small';
  const isLarge = size === 'large';
  const shieldW = isSmall ? 14 : isLarge ? 30 : 23;
  const shieldH = isSmall ? 16 : isLarge ? 34 : 26;
  const labelSize = isSmall ? 4.5 : isLarge ? 8 : 6.5;

  return (
    <View style={styles.customEmblemStack}>
      <View
        style={[
          styles.shieldCrestOuter,
          {
            width: shieldW,
            height: shieldH,
            borderRadius: shieldW * 0.25,
            borderBottomLeftRadius: shieldW * 0.55,
            borderBottomRightRadius: shieldW * 0.55,
            borderWidth: isSmall ? 1.5 : 2.5,
          },
        ]}
      >
        <View
          style={[
            styles.shieldCrestInnerSun,
            {
              width: shieldW * 0.45,
              height: shieldW * 0.45,
              borderRadius: shieldW * 0.25,
            },
          ]}
        />
      </View>
      {!isSmall && (
        <Text style={[styles.shieldBadgeLabel, { fontSize: labelSize }]} numberOfLines={1}>
          SHIELD
        </Text>
      )}
    </View>
  );
};

// Ornate Golden Hand-Mirror & Arcane Swirl emblem for Mirror card
const MirrorEmblemMotif: React.FC<{ size: 'small' | 'medium' | 'large' }> = ({ size }) => {
  const isSmall = size === 'small';
  const isLarge = size === 'large';
  const glassW = isSmall ? 13 : isLarge ? 26 : 20;
  const glassH = isSmall ? 15 : isLarge ? 30 : 23;
  const handleW = isSmall ? 3 : isLarge ? 5.5 : 4.5;
  const handleH = isSmall ? 4 : isLarge ? 9 : 7;
  const labelSize = isSmall ? 4.5 : isLarge ? 8 : 6.5;

  return (
    <View style={styles.customEmblemStack}>
      <View
        style={[
          styles.mirrorFrameOuter,
          {
            width: glassW,
            height: glassH,
            borderRadius: glassW * 0.5,
            borderWidth: isSmall ? 1.5 : 2.5,
          },
        ]}
      >
        <View style={styles.mirrorGlassSheen} />
      </View>
      <View
        style={[
          styles.mirrorHandle,
          {
            width: handleW,
            height: handleH,
            borderBottomLeftRadius: handleW * 0.5,
            borderBottomRightRadius: handleW * 0.5,
          },
        ]}
      />
      {!isSmall && (
        <Text style={[styles.mirrorBadgeLabel, { fontSize: labelSize }]} numberOfLines={1}>
          MIRROR
        </Text>
      )}
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
  cornerMotifShadow: {
    paddingTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0.5, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 1.5,
    elevation: 2,
  },
  reverseMotifBox: {
    position: 'relative',
  },
  reverseArrowLayerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  reverseArrowLayerBottom: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ rotate: '180deg' }],
  },
  reverseArrowHalf: {
    position: 'relative',
    overflow: 'visible',
  },
  reverseArcStem: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
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
  shieldCosmicHalo: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 184, 166, 0.28)',
  },
  mirrorArcaneHalo: {
    position: 'absolute',
    bottom: -12,
    left: -12,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(196, 181, 253, 0.25)',
  },
  shieldCenterOval: {
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  mirrorCenterOval: {
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
    borderColor: '#A78BFA',
  },
  customEmblemStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCrestOuter: {
    backgroundColor: '#0F766E',
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
  },
  shieldCrestInnerSun: {
    backgroundColor: '#FDE047',
    borderWidth: 1.5,
    borderColor: '#FEF9C3',
  },
  shieldBadgeLabel: {
    ...FONT_CARTOON_HEAVY,
    color: '#0F2B46',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  mirrorFrameOuter: {
    backgroundColor: '#E0F2FE',
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mirrorGlassSheen: {
    width: '45%',
    height: '85%',
    backgroundColor: '#FFFFFF',
    opacity: 0.75,
    transform: [{ rotate: '22deg' }],
    borderRadius: 4,
  },
  mirrorHandle: {
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#FBBF24',
    marginTop: -1,
  },
  mirrorBadgeLabel: {
    ...FONT_CARTOON_HEAVY,
    color: '#4C1D95',
    marginTop: 1,
    letterSpacing: 0.3,
  },
});
