// src/components/GameOverModal.tsx - Displays victory/defeat screen when a match ends
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GameMode, Player } from '../types';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import { getAvatarConfig, AwardRewardsResult } from '../services/playerProfileService';
import { ModalConfettiBurst } from './ModalConfettiBurst';

export interface GameOverModalProps {
  visible: boolean;
  winner: Player | null;
  turnCount: number;
  players: Player[];
  localPlayerId?: string;
  mode?: 'bot' | 'online' | 'pass_and_play';
  gameMode?: GameMode;
  isOnlineMode?: boolean;
  matchRewards?: AwardRewardsResult | null;
  onPlayAgain: () => void;
  onQuitRoom?: () => void;
  onPlayWithMoreBots?: () => void;
  onPlay1v1?: () => void;
  onMainMenu?: () => void;
}

export function getOrdinalRank(index: number): string {
  if (index === 0) return '1ST';
  if (index === 1) return '2ND';
  if (index === 2) return '3RD';
  if (index === 3) return '4TH';
  return `${index + 1}TH`;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  visible,
  winner,
  turnCount,
  players,
  localPlayerId,
  mode,
  gameMode,
  isOnlineMode = false,
  matchRewards = null,
  onPlayAgain,
  onQuitRoom,
  onPlayWithMoreBots,
  onPlay1v1,
  onMainMenu,
}) => {
  if (!winner) return null;

  // Determine whether the local viewer is the winner
  const isLocalWinner = localPlayerId
    ? winner.id === localPlayerId
    : players[0]?.id === winner.id;

  // Sort players: winner first (1st), then by fewest cards remaining
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === winner.id) return -1;
    if (b.id === winner.id) return 1;
    return a.hand.length - b.hand.length;
  });

  // Determine game mode: 'online' vs 'bot' vs 'pass_and_play'
  const isOnline = mode === 'online' || isOnlineMode || gameMode === 'multiplayer';
  const isBot =
    mode === 'bot' ||
    gameMode === 'vs_bot' ||
    (!isOnline && (players.some((p) => p.isBot) || mode !== 'pass_and_play'));
  const is1v1Bot = isBot && players.length <= 2;
  const isMultiBot = isBot && players.length > 2;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.dialogCard}>
            {/* Top Trophy Section with Winner-Only Confetti Burst strictly constrained inside */}
            <View style={styles.topSectionWrapper}>
              {isLocalWinner && <ModalConfettiBurst active={visible && isLocalWinner} />}

              {/* Trophy / Emblem Circle */}
              <View
                style={[
                  styles.trophyCircle,
                  isLocalWinner ? styles.trophyCircleVictory : styles.trophyCircleDefeat,
                ]}
              >
                <Text style={styles.trophyEmoji}>{isLocalWinner ? '🏆' : '🛡️'}</Text>
              </View>

              {/* Top Banner Tag: VICTORY! vs DEFEAT */}
              <View
                style={[
                  styles.bannerTagContainer,
                  isLocalWinner ? styles.bannerTagVictory : styles.bannerTagDefeat,
                ]}
              >
                <Text
                  style={[
                    styles.bannerTagText,
                    isLocalWinner ? styles.bannerTagTextVictory : styles.bannerTagTextDefeat,
                  ]}
                >
                  {isLocalWinner ? 'VICTORY!' : 'DEFEAT'}
                </Text>
              </View>

              {/* Main Headline */}
              <Text style={styles.headline}>
                {isLocalWinner ? 'You Won!' : `${winner.name} Won!`}
              </Text>

              {/* Dynamic Subtitle */}
              <Text style={styles.subtitle}>
                {isLocalWinner
                  ? `You emptied your hand and won the match in ${turnCount} turns!`
                  : `${winner.name} emptied their hand and won the match in ${turnCount} turns.`}
              </Text>
            </View>

            {/* Level Up Celebratory Banner */}
            {matchRewards?.leveledUp && (
              <View style={styles.levelUpBanner}>
                <View style={styles.levelUpHeader}>
                  <Text style={styles.levelUpEmoji}>🎉</Text>
                  <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
                </View>
                <Text style={styles.levelUpReached}>
                  Reached Level {matchRewards.newLevel}!
                </Text>
                <View style={styles.levelUpBonusBadge}>
                  <Text style={styles.levelUpBonusText}>
                    Bonus: +{matchRewards.bonusCoins} Coins • +{matchRewards.bonusGems} Gems
                  </Text>
                </View>
              </View>
            )}

            {/* Match Rewards Card */}
            {matchRewards && (
              <View style={styles.rewardsCard}>
                <Text style={styles.rewardsCardTitle}>MATCH REWARDS</Text>
                <View style={styles.rewardsPillsRow}>
                  <View style={styles.xpRewardPill}>
                    <Text style={styles.xpRewardIcon}>⚡</Text>
                    <Text style={styles.xpRewardText}>+{matchRewards.earnedXp} XP</Text>
                  </View>
                  <View style={styles.coinRewardPill}>
                    <Text style={styles.coinRewardIcon}>🪙</Text>
                    <Text style={styles.coinRewardText}>+{matchRewards.earnedCoins} Coins</Text>
                  </View>
                </View>

                {/* Mini XP progress status */}
                <View style={styles.rewardXpProgressRow}>
                  <Text style={styles.rewardXpProgressText}>
                    Level {matchRewards.newLevel} ({matchRewards.currentXp} / {matchRewards.xpToNextLevel} XP)
                  </Text>
                  <View style={styles.rewardXpTrack}>
                    <View
                      style={[
                        styles.rewardXpFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                (matchRewards.currentXp / (matchRewards.xpToNextLevel || 100)) * 100
                              )
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Final Standings Card */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsHeader}>FINAL STANDINGS</Text>
              {sortedPlayers.map((p, index) => {
                const isWinner = p.id === winner.id;
                const isLocalPlayer = localPlayerId ? p.id === localPlayerId : p.id === 'p1';
                const isAlreadyNamedYou = p.name.trim().toLowerCase() === 'you';
                const displayName = isAlreadyNamedYou
                  ? 'You'
                  : isLocalPlayer
                  ? `${p.name} (You)`
                  : p.name;

                return (
                  <View
                    key={p.id}
                    style={[
                      styles.playerRow,
                      isWinner && styles.winnerPlayerRow,
                      !isWinner && isLocalPlayer && styles.localPlayerRow,
                    ]}
                  >
                    <View style={styles.playerRowLeft}>
                      <Text style={[styles.rankText, isWinner && styles.winnerRankText]}>
                        {getOrdinalRank(index)}
                      </Text>
                      {Boolean(p.avatarId) && (
                        <Text style={styles.standingsAvatarEmoji}>
                          {getAvatarConfig(p.avatarId).emoji}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.playerRowName,
                          isWinner && styles.winnerRowName,
                          !isWinner && isLocalPlayer && styles.localPlayerRowName,
                        ]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                    </View>

                    <View style={styles.playerRowRight}>
                      {isWinner ? (
                        <View style={styles.winnerBadge}>
                          <Text style={styles.winnerBadgeText}>1ST • WINNER</Text>
                        </View>
                      ) : (
                        <Text style={styles.playerRowCount}>
                          {p.hand.length} {p.hand.length === 1 ? 'card' : 'cards'} left
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Primary Action: Always Play Again */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onPlayAgain}
              style={styles.playAgainBtn}
            >
              <Text style={styles.playAgainBtnText}>Play Again</Text>
            </TouchableOpacity>

            {/* Mode-Aware Secondary Action Buttons */}
            {/* 1. Online Mode: Quit Room */}
            {isOnline && onQuitRoom && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onQuitRoom}
                style={styles.quitRoomBtn}
              >
                <Text style={styles.quitRoomBtnText}>Quit Room</Text>
              </TouchableOpacity>
            )}

            {/* 2. Bot Mode 1v1 (2 players total): Play with More Bots + subtle Main Menu link */}
            {is1v1Bot && (
              <>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onPlayWithMoreBots || onPlayAgain}
                  style={styles.moreBotsBtn}
                >
                  <Text style={styles.moreBotsBtnText}>Play with More Bots</Text>
                </TouchableOpacity>

                {(onMainMenu || onQuitRoom) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onMainMenu || onQuitRoom}
                    style={styles.mainMenuLinkBtn}
                  >
                    <Text style={styles.mainMenuLinkText}>Main Menu</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* 3. Bot Mode Multi-Bot (3+ bots / 4 players): Play 1v1 + Main Menu button */}
            {isMultiBot && (
              <>
                {onPlay1v1 && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onPlay1v1}
                    style={styles.moreBotsBtn}
                  >
                    <Text style={styles.moreBotsBtnText}>Play 1v1</Text>
                  </TouchableOpacity>
                )}

                {(onMainMenu || onQuitRoom) && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={onMainMenu || onQuitRoom}
                    style={styles.mainMenuBtn}
                  >
                    <Text style={styles.mainMenuBtnText}>Main Menu</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* 4. Pass & Play Mode: Main Menu button */}
            {!isOnline && !isBot && (onMainMenu || onQuitRoom) && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onMainMenu || onQuitRoom}
                style={styles.mainMenuBtn}
              >
                <Text style={styles.mainMenuBtnText}>Main Menu</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FEF6E9', // Warm cream surface matching room creation & homescreen
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  topSectionWrapper: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 20,
    paddingTop: 4,
    marginBottom: 4,
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
  },
  trophyCircleVictory: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  trophyCircleDefeat: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  trophyEmoji: {
    fontSize: 36,
  },
  bannerTagContainer: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  bannerTagVictory: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  bannerTagDefeat: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  bannerTagText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  bannerTagTextVictory: {
    color: '#D97706',
  },
  bannerTagTextDefeat: {
    color: '#EF4444',
  },
  headline: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  levelUpBanner: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  levelUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  levelUpEmoji: {
    fontSize: 18,
  },
  levelUpTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
    color: '#B45309',
    letterSpacing: 0.6,
  },
  levelUpReached: {
    ...FONT_CARTOON_BOLD,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 6,
  },
  levelUpBonusBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelUpBonusText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#15803D',
  },
  rewardsCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderWidth: 2.5,
    borderColor: '#E2D9C8',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  rewardsCardTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  rewardsPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  xpRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  xpRewardIcon: {
    fontSize: 13,
  },
  xpRewardText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#15803D',
  },
  coinRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  coinRewardIcon: {
    fontSize: 13,
  },
  coinRewardText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#92400E',
  },
  rewardXpProgressRow: {
    width: '100%',
    alignItems: 'center',
  },
  rewardXpProgressText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  rewardXpTrack: {
    width: '90%',
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
  },
  rewardXpFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF', // Pure white card surface inside cream container
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statsHeader: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 8,
  },
  winnerPlayerRow: {
    backgroundColor: '#F0FDF4', // Soft emerald tint for winner
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 4,
  },
  localPlayerRow: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  playerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rankText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    minWidth: 26,
  },
  winnerRankText: {
    color: '#15803D',
  },
  standingsAvatarEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  playerRowName: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  winnerRowName: {
    color: '#0F172A',
    fontSize: 14,
  },
  localPlayerRowName: {
    color: '#0369A1',
  },
  playerRowRight: {
    alignItems: 'flex-end',
  },
  winnerBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  winnerBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#15803D',
    letterSpacing: 0.5,
  },
  playerRowCount: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 12,
    color: '#475569',
  },
  playAgainBtn: {
    width: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  playAgainBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  moreBotsBtn: {
    width: '100%',
    backgroundColor: '#2563EB', // Warm cobalt blue
    borderBottomWidth: 4,
    borderColor: '#1D4ED8',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  moreBotsBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  quitRoomBtn: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quitRoomBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#DC2626',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  mainMenuBtn: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  mainMenuBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#475569',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  mainMenuLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mainMenuLinkText: {
    ...FONT_CARTOON_BOLD,
    color: '#64748B',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
