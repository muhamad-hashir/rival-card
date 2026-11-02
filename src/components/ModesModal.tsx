// src/components/ModesModal.tsx - Cross-Platform Game Mode Selector Modal (Works on Web & Mobile)
import React from 'react';
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

interface ModesModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (preset: SetupPreset) => void;
  onOpenMultiplayer: () => void;
  onGoHome?: () => void;
}

export const ModesModal: React.FC<ModesModalProps> = ({
  visible,
  onClose,
  onSelectPreset,
  onOpenMultiplayer,
  onGoHome,
}) => {
  const handleSelect = (action: () => void) => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onClose();
    action();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>SELECT GAME MODE</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Mode Option Buttons */}
          <View style={styles.optionsList}>
            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => handleSelect(() => onSelectPreset('vs_bot_2p'))}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>🤖</Text>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>1v1 vs Bot</Text>
                <Text style={styles.optionSubtitle}>Quick offline duel against CPU</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => handleSelect(() => onSelectPreset('vs_bot_4p'))}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>🤖</Text>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>4-Player vs Bots</Text>
                <Text style={styles.optionSubtitle}>4-player battle against 3 CPU rivals</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => handleSelect(() => onSelectPreset('pass_play_2p'))}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>👥</Text>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Pass & Play (2P)</Text>
                <Text style={styles.optionSubtitle}>Local multiplayer on one device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => handleSelect(() => onSelectPreset('pass_play_3p'))}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>👥</Text>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Pass & Play (3P)</Text>
                <Text style={styles.optionSubtitle}>3-player local pass-and-play</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionBtn, styles.onlineOptionBtn]}
              onPress={() => handleSelect(onOpenMultiplayer)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>🌐</Text>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.onlineTitle]}>
                  Online Multiplayer
                </Text>
                <Text style={styles.optionSubtitle}>
                  Host or join a 4-digit room code
                </Text>
              </View>
            </TouchableOpacity>

            {onGoHome && (
              <TouchableOpacity
                style={[styles.optionBtn, styles.homeOptionBtn]}
                onPress={() => handleSelect(onGoHome)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>🏠</Text>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Return to Home</Text>
                  <Text style={styles.optionSubtitle}>Exit to main menu screen</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  optionsList: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    // @ts-ignore
    cursor: 'pointer',
  },
  onlineOptionBtn: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  homeOptionBtn: {
    borderColor: '#64748B',
  },
  optionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  onlineTitle: {
    color: '#60A5FA',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
