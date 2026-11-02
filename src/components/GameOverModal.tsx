// src/components/GameOverModal.tsx - Displays victory screen when a player wins
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Player } from '../types';

interface GameOverModalProps {
  visible: boolean;
  winner: Player | null;
  turnCount: number;
  players: Player[];
  onPlayAgain: () => void;
  onResetMode?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  visible,
  winner,
  turnCount,
  players,
  onPlayAgain,
  onResetMode,
}) => {
  if (!winner) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          <View style={styles.trophyCircle}>
            <Text style={styles.trophyEmoji}>🏆</Text>
          </View>

          <Text style={styles.bannerTag}>VICTORY!</Text>
          <Text style={styles.winnerName}>{winner.name}</Text>
          <Text style={styles.subtitle}>
            Has emptied their hand and won the match in {turnCount} turns!
          </Text>

          {/* Opponents score summary */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsHeader}>Final Standings</Text>
            {players.map((p) => {
              const isWinner = p.id === winner.id;
              return (
                <View key={p.id} style={styles.playerRow}>
                  <Text style={[styles.playerRowName, isWinner && styles.winnerRowText]}>
                    {isWinner ? '👑 ' : ''}{p.name}
                  </Text>
                  <Text style={[styles.playerRowCount, isWinner && styles.winnerRowText]}>
                    {isWinner ? 'WINNER' : `${p.hand.length} cards`}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Play Again button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPlayAgain}
            style={styles.playAgainBtn}
          >
            <Text style={styles.playAgainBtnText}>Play Again</Text>
          </TouchableOpacity>

          {onResetMode && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onResetMode}
              style={styles.menuBtn}
            >
              <Text style={styles.menuBtnText}>Change Game Mode</Text>
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
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  trophyEmoji: {
    fontSize: 40,
  },
  bannerTag: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  winnerName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  playerRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  playerRowCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  winnerRowText: {
    color: '#2563EB',
    fontWeight: '800',
  },
  playAgainBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  playAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  menuBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
