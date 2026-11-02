// src/components/TauntBar.tsx - Quick Taunt Emoji Bar & Floating Broadcast Toast
import React, { useEffect, useState } from 'react';
import {
  Animated,
  ScrollView,
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

  const handlePressEmoji = async (emoji: string) => {
    if (disabled) return;
    hapticsService.cardSnap();
    soundService.playCardSnap();

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

      {/* Horizontal Taunt Emojis Bar */}
      <View style={styles.barWrapper}>
        <Text style={styles.barLabel}>TAUNTS:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {TAUNT_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[styles.emojiBtn, disabled && styles.emojiBtnDisabled]}
              onPress={() => handlePressEmoji(emoji)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 4,
    width: '100%',
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emojiBtnDisabled: {
    opacity: 0.4,
  },
  emojiText: {
    fontSize: 16,
  },
});
