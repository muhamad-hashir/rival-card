// src/components/TauntBar.tsx - Quick Taunt Emoji Bar & Game-Themed Broadcast Toast
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { multiplayerService, TauntMessage } from '../services/supabase';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';

const TAUNT_EMOJIS = ['🔥', '⚡', '😂', '😱', '👑', '🃏', '💥', '🛡️', '😈', '👋'];

export const TAUNT_TOAST_TOP_OFFSET = 36;

interface TauntToastBannerProps {
  activeTaunt: TauntMessage | null;
  inline?: boolean;
}

/**
 * Dynamically sized active taunt popup banner matching the Rival Card game board HUD.
 * Auto-sizes to fit the full sender username and emoji without fixed narrow clipping.
 */
export const TauntToastBanner: React.FC<TauntToastBannerProps> = ({
  activeTaunt,
  inline = false,
}) => {
  const [slideAnim] = useState(() => new Animated.Value(-8));
  const [opacityAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!activeTaunt) return;

    slideAnim.setValue(-8);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -8,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2500);

    return () => clearTimeout(timer);
  }, [activeTaunt, opacityAnim, slideAnim]);

  if (!activeTaunt) return null;

  return (
    <View
      style={inline ? styles.inlineToastAnchor : styles.boardToastOverlay}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.floatingToast,
          {
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.toastEmojiBubble}>
          <Text style={styles.toastEmoji}>{activeTaunt.emoji}</Text>
        </View>
        <Text style={styles.toastText}>
          <Text style={styles.toastSender}>{activeTaunt.senderName}</Text>
          <Text style={styles.toastSeparator}> • </Text>
          <Text style={styles.toastEchoEmoji}>{activeTaunt.emoji}</Text>
        </Text>
      </Animated.View>
    </View>
  );
};

interface TauntBarProps {
  activeTaunt: TauntMessage | null;
  onSendTaunt?: (emoji: string) => void;
  disabled?: boolean;
  hideToast?: boolean;
}

export const TauntBar: React.FC<TauntBarProps> = ({
  activeTaunt,
  onSendTaunt,
  disabled = false,
  hideToast = false,
}) => {
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [trayScale] = useState(() => new Animated.Value(0.88));
  const [trayOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isTrayOpen) {
      Animated.parallel([
        Animated.spring(trayScale, {
          toValue: 1,
          friction: 7,
          tension: 95,
          useNativeDriver: true,
        }),
        Animated.timing(trayOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(trayScale, {
          toValue: 0.88,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(trayOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isTrayOpen, trayOpacity, trayScale]);

  const handleToggleTray = () => {
    if (disabled) return;
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsTrayOpen((prev) => !prev);
  };

  const handlePressEmoji = async (emoji: string) => {
    if (disabled) return;
    hapticsService.cardSnap();
    soundService.playCardSnap();
    setIsTrayOpen(false);

    if (onSendTaunt) {
      onSendTaunt(emoji);
    } else {
      await multiplayerService.broadcastTaunt(emoji);
    }
  };

  return (
    <View style={styles.container}>
      {!hideToast && <TauntToastBanner activeTaunt={activeTaunt} inline />}

      {/* Compact Game-Themed Toggle Button */}
      <TouchableOpacity
        style={[
          styles.toggleButton,
          isTrayOpen && styles.toggleButtonActive,
          disabled && styles.toggleButtonDisabled,
        ]}
        onPress={handleToggleTray}
        disabled={disabled}
        activeOpacity={0.75}
      >
        <Text style={styles.toggleButtonIcon}>💬</Text>
        <Text style={styles.toggleButtonText}>Taunts</Text>
        <Text style={styles.toggleButtonChevron}>{isTrayOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Game-Themed Popover Reaction Drawer */}
      <Modal
        transparent
        animationType="none"
        visible={isTrayOpen}
        onRequestClose={() => setIsTrayOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsTrayOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.popoverDrawer,
                {
                  opacity: trayOpacity,
                  transform: [{ scale: trayScale }],
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <View style={styles.drawerTitleRow}>
                  <View style={styles.drawerBadgePill}>
                    <Text style={styles.drawerBadge}>⚡</Text>
                  </View>
                  <Text style={styles.drawerTitle}>QUICK TAUNTS</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsTrayOpen(false)}
                  style={styles.drawerCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.drawerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.emojiGrid}>
                {TAUNT_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiBtn}
                    onPress={() => handlePressEmoji(emoji)}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
    zIndex: 80,
    overflow: 'visible',
  },
  boardToastOverlay: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  inlineToastAnchor: {
    position: 'absolute',
    top: TAUNT_TOAST_TOP_OFFSET,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  floatingToast: {
    alignSelf: 'center',
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 10,
  },
  toastEmojiBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  toastEmoji: {
    fontSize: 15,
  },
  toastText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#F8FAFC',
    flexShrink: 1,
  },
  toastSender: {
    ...FONT_CARTOON_HEAVY,
    color: '#FDE68A',
  },
  toastSeparator: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  toastEchoEmoji: {
    fontSize: 14,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    gap: 5,
  },
  toggleButtonActive: {
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleButtonIcon: {
    fontSize: 12,
  },
  toggleButtonText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  toggleButtonChevron: {
    fontSize: 8,
    color: '#FDE68A',
    marginLeft: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popoverDrawer: {
    backgroundColor: '#FEF6E9',
    borderRadius: 22,
    padding: 16,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 12,
    width: 264,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2D9C8',
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  drawerBadgePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBadge: {
    fontSize: 11,
  },
  drawerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  drawerCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#DC2626',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFDF7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: '#E2D9C8',
  },
  emojiText: {
    fontSize: 19,
  },
});
