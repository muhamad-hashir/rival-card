// src/components/ModesModal.tsx - Arcade-Themed Bot & Opponents Selector Modal
import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SetupPreset } from '../screens/HomeScreen';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';

interface BotOption {
  preset: SetupPreset;
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  tagline: string;
}

const BOT_OPTIONS: BotOption[] = [
  {
    preset: 'vs_bot_2p',
    icon: '⚔️',
    badge: '1v1 DUEL',
    title: '1 BOT',
    subtitle: '1v1 Match',
    tagline: 'Fast-paced duel',
  },
  {
    preset: 'vs_bot_3p',
    icon: '⚡',
    badge: '3P BRAWL',
    title: '2 BOTS',
    subtitle: '3-Player',
    tagline: 'Trio clash',
  },
  {
    preset: 'vs_bot_4p',
    icon: '🔥',
    badge: '4P CHAOS',
    title: '3 BOTS',
    subtitle: '4-Player',
    tagline: 'Full rumble',
  },
];

export interface ModesModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (preset: SetupPreset) => void;
  onOpenMultiplayer?: () => void;
  onGoHome?: () => void;
}

export const ModesModal: React.FC<ModesModalProps> = ({
  visible,
  onClose,
  onSelectPreset,
  onOpenMultiplayer: _onOpenMultiplayer,
  onGoHome,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<SetupPreset>('vs_bot_2p');

  useEffect(() => {
    if (visible) {
      setSelectedPreset('vs_bot_2p');
    }
  }, [visible]);

  const handleCardPress = (preset: SetupPreset) => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setSelectedPreset(preset);
  };

  const handleStartMatch = () => {
    hapticsService.victory();
    soundService.playCardSnap();
    onClose();
    onSelectPreset(selectedPreset);
  };

  const handleClose = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Distinct Cartoon Close Button pinned to top right */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close Bot Selection"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Modal Header */}
          <View style={styles.header}>
            <Text style={styles.title}>PLAY VS BOTS</Text>
            <Text style={styles.subtitle}>
              Pick your challenge level to battle against AI Rivals!
            </Text>
          </View>

          {/* 3 Bot Selection Cards in a Horizontal Row */}
          <View style={styles.cardsRow}>
            {BOT_OPTIONS.map((opt) => {
              const isSelected = selectedPreset === opt.preset;
              return (
                <TouchableOpacity
                  key={opt.preset}
                  activeOpacity={0.85}
                  onPress={() => handleCardPress(opt.preset)}
                  style={[
                    styles.botCard,
                    isSelected ? styles.botCardSelected : styles.botCardUnselected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.title} ${opt.badge}`}
                >
                  {/* Badge */}
                  <View
                    style={[
                      styles.cardBadge,
                      isSelected ? styles.cardBadgeSelected : styles.cardBadgeUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cardBadgeText,
                        isSelected ? styles.cardBadgeTextSelected : styles.cardBadgeTextUnselected,
                      ]}
                    >
                      {opt.badge}
                    </Text>
                  </View>

                  {/* Icon Circle */}
                  <View
                    style={[
                      styles.iconCircle,
                      isSelected ? styles.iconCircleSelected : styles.iconCircleUnselected,
                    ]}
                  >
                    <Text style={styles.cardIcon}>{opt.icon}</Text>
                  </View>

                  {/* Title & Subtitle */}
                  <Text
                    style={[
                      styles.cardTitle,
                      isSelected ? styles.cardTitleSelected : styles.cardTitleUnselected,
                    ]}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      isSelected && styles.cardSubtitleSelected,
                    ]}
                  >
                    {opt.subtitle}
                  </Text>
                  <Text
                    style={[
                      styles.cardTagline,
                      isSelected && styles.cardTaglineSelected,
                    ]}
                  >
                    {opt.tagline}
                  </Text>

                  {/* Selected Indicator Pill */}
                  {isSelected && (
                    <View style={styles.selectedPill}>
                      <Text style={styles.selectedPillText}>✓ ACTIVE</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Primary Action Button: Large Vibrant START MATCH Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStartMatch}
            style={styles.startMatchBtn}
            accessibilityRole="button"
            accessibilityLabel="Start Match"
          >
            <Text style={styles.startMatchBtnText}>START MATCH</Text>
          </TouchableOpacity>

          {/* Optional Return to Home link (if opened from within in-game) */}
          {Boolean(onGoHome) && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                onGoHome?.();
              }}
              style={styles.returnHomeLink}
            >
              <Text style={styles.returnHomeText}>🏠 Return to Main Menu</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B', // Deep navy/slate rounded dialog
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#38BDF8', // Stylized cyan border
    paddingHorizontal: 16,
    paddingVertical: 22,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  closeBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#F8FAFC',
    lineHeight: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#FACC15', // Vibrant yellow/gold color
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 18,
  },
  botCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 175,
  },
  botCardUnselected: {
    backgroundColor: '#334155', // Dark frosted surface
    borderWidth: 2,
    borderColor: '#475569',
    transform: [{ scale: 1.0 }],
  },
  botCardSelected: {
    backgroundColor: '#065F46', // Emerald glow background
    borderWidth: 2.5,
    borderColor: '#10B981', // Bursting emerald border
    transform: [{ scale: 1.05 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  cardBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 8,
  },
  cardBadgeUnselected: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cardBadgeSelected: {
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: '#34D399',
  },
  cardBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    letterSpacing: 0.6,
  },
  cardBadgeTextUnselected: {
    color: '#94A3B8',
  },
  cardBadgeTextSelected: {
    color: '#A7F3D0',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircleUnselected: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  iconCircleSelected: {
    backgroundColor: '#047857',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  cardIcon: {
    fontSize: 22,
  },
  cardTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    marginBottom: 2,
    textAlign: 'center',
  },
  cardTitleUnselected: {
    color: '#E2E8F0',
  },
  cardTitleSelected: {
    color: '#FFFFFF',
  },
  cardSubtitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#CBD5E1',
    marginBottom: 2,
    textAlign: 'center',
  },
  cardSubtitleSelected: {
    color: '#D1FAE5',
  },
  cardTagline: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 9.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 12,
  },
  cardTaglineSelected: {
    color: '#A7F3D0',
  },
  selectedPill: {
    marginTop: 8,
    backgroundColor: '#10B981',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  startMatchBtn: {
    width: '100%',
    backgroundColor: '#10B981', // 3D emerald arcade styling
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  startMatchBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  returnHomeLink: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  returnHomeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#64748B',
  },
});
