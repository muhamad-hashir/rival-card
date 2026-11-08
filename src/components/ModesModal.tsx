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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFDF0', // Light warm cream / parchment background
    borderRadius: 24,
    borderWidth: 4,
    borderBottomWidth: 7, // Heavy cartoon outline + solid 3D depth
    borderColor: '#2D1B4E', // Heavy dark cartoon outline
    paddingHorizontal: 16,
    paddingVertical: 22,
    position: 'relative',
    shadowColor: '#2D1B4E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EF4444', // Vibrant cartoon red/coral button
    borderWidth: 2.5,
    borderBottomWidth: 3.5,
    borderColor: '#2D1B4E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#2D1B4E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
  closeBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 17,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    color: '#D97706', // Thick cartoon text in vibrant golden yellow/orange
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(45, 27, 78, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12.5,
    color: '#475569', // Readable dark slate
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
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
    backgroundColor: '#FFFFFF', // Clean light warm surface
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderColor: '#CBD5E1', // Clean cartoon border
    transform: [{ scale: 1.0 }],
    shadowColor: '#2D1B4E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  botCardSelected: {
    backgroundColor: '#ECFDF5', // Bright emerald active glow
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: '#10B981', // Bursting emerald border
    transform: [{ scale: 1.04 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  cardBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginBottom: 8,
  },
  cardBadgeUnselected: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  cardBadgeSelected: {
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  cardBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    letterSpacing: 0.6,
  },
  cardBadgeTextUnselected: {
    color: '#475569',
  },
  cardBadgeTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  iconCircleSelected: {
    backgroundColor: '#D1FAE5',
    borderWidth: 2,
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
    color: '#1E293B', // Dark bold text
  },
  cardTitleSelected: {
    color: '#065F46', // Bold emerald text
  },
  cardSubtitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
    textAlign: 'center',
  },
  cardSubtitleSelected: {
    color: '#059669',
  },
  cardTagline: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 9.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 12,
  },
  cardTaglineSelected: {
    color: '#047857',
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
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: '#065F46',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
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
