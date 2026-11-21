// src/components/AvatarIcon.tsx - Optimized Circular 2D Cartoon-Arcade PNG Avatar Renderer
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getAvatarConfig, getAvatarImageSource } from '../constants/avatars';

const INK_NAVY = '#0F1142';
const VIP_GOLD = '#FACC15';

export interface AvatarIconProps {
  avatarId?: string | null;
  /** Outer diameter of the circular avatar frame */
  size?: number;
  /** Optional override for the circular rim color */
  borderColor?: string;
  /** Optional override for rim thickness */
  borderWidth?: number;
  /** Kept for backwards compatibility; all PNG avatars render inside a polished circular frame */
  showCircle?: boolean;
  /** Dim artwork cleanly for locked progression previews */
  dimmed?: boolean;
  style?: ViewStyle;
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({
  avatarId,
  size = 32,
  borderColor,
  borderWidth,
  dimmed = false,
  style,
}) => {
  const config = getAvatarConfig(avatarId);
  const imageSource = config.image || getAvatarImageSource(avatarId);
  const isVip = Boolean(config.isVipExclusive);

  const resolvedBorderWidth =
    borderWidth ??
    (isVip
      ? size >= 44
        ? 2.5
        : 2
      : size >= 44
      ? 2
      : 1.5);

  const resolvedBorderColor =
    borderColor ?? (isVip ? VIP_GOLD : config.accentColor || INK_NAVY);

  const glowStyle: ViewStyle | null = isVip
    ? {
        shadowColor: config.accentColor || VIP_GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.72,
        shadowRadius: size >= 44 ? 8 : 4,
        elevation: 6,
      }
    : {
        shadowColor: INK_NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 3,
        elevation: 3,
      };

  return (
    <View
      style={[
        styles.outerRim,
        glowStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: resolvedBorderWidth,
          borderColor: resolvedBorderColor,
          backgroundColor: '#090F24',
        },
        isVip && styles.vipOuterRing,
        dimmed && styles.dimmedWrap,
        style,
      ]}
    >
      <View
        style={[
          styles.innerClip,
          {
            borderRadius: Math.max(0, size / 2 - resolvedBorderWidth),
          },
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.avatarImage}
            resizeMode="cover"
            accessibilityLabel={`${config.label} avatar`}
          />
        ) : (
          <Text style={{ fontSize: Math.round(size * 0.52) }}>{config.emoji}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerRim: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipOuterRing: {
    backgroundColor: '#1E1B4B',
  },
  innerClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  dimmedWrap: {
    opacity: 0.45,
  },
});
