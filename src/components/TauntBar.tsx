// src/components/TauntBar.tsx - Quick Taunt Emoji Bar & Floating Broadcast Toast
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

const TAUNT_EMOJIS = ['🔥', '⚡', '😂', '😱', '👑', '🃏', '💥', '🛡️', '😈', '👋'];

interface TauntBarProps {
  activeTaunt: TauntMessage | null;
  onSendTaunt?: (emoji: string) => void;
  disabled?: boolean;
}

export const TauntBar: React.FC<TauntBarProps> = ({
  activeTaunt,
  onSendTaunt,
  disabled = false,
}) => {
  const [slideAnim] = useState(new Animated.Value(-60));
  const [opacityAnim] = useState(new Animated.Value(0));
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [trayScale] = useState(new Animated.Value(0.85));
  const [trayOpacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (activeTaunt) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -60,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [activeTaunt, opacityAnim, slideAnim]);

  useEffect(() => {
    if (isTrayOpen) {
      Animated.parallel([
        Animated.spring(trayScale, {
          toValue: 1,
          friction: 7,
          tension: 90,
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
          toValue: 0.85,
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
      {/* Floating Animated Toast Banner */}
      {activeTaunt && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastEmoji}>{activeTaunt.emoji}</Text>
          <Text style={styles.toastText}>
            <Text style={styles.toastSender}>{activeTaunt.senderName}: </Text>
            {activeTaunt.emoji}
          </Text>
        </Animated.View>
      )}

      {/* Compact Minimal Toggle Button */}
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

      {/* Popover Reaction Drawer / Tray */}
      <Modal
        transparent
        animationType="none"
        visible={isTrayOpen}
        onRequestClose={() => setIsTrayOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsTrayOpen(false)}>
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
                <Text style={styles.drawerBadge}>⚡</Text>
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
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
  },
  floatingToast: {
    position: 'absolute',
    top: -50,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  toastEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  toastText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  toastSender: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5,
  },
  toggleButtonActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(30, 58, 138, 0.85)',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleButtonIcon: {
    fontSize: 12,
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.4,
  },
  toggleButtonChevron: {
    fontSize: 8,
    color: '#94A3B8',
    marginLeft: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popoverDrawer: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
    width: 250,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerBadge: {
    fontSize: 12,
  },
  drawerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  drawerCloseBtn: {
    padding: 2,
  },
  drawerCloseText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '900',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emojiText: {
    fontSize: 18,
  },
});
