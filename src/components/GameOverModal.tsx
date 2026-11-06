// src/components/GameOverModal.tsx - Displays 2-step paginated victory/defeat, standings, and rewards flow
import React, { useState, useEffect } from 'react';
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
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';

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
  turnCount: _turnCount,
  players,
  localPlayerId,
  mode: _mode,
  gameMode: _gameMode,
  isOnlineMode: _isOnlineMode = false,
  matchRewards = null,
  onPlayAgain,
  onQuitRoom,
  onPlayWithMoreBots: _onPlayWithMoreBots,
  onPlay1v1: _onPlay1v1,
  onMainMenu,
}) => {
  // Step 1: "Victory & Standings" | Step 2: "Rewards & Level Up"
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (visible) {
      setStep(1);
    }
  }, [visible]);

  if (!winner) return null;

  // Determine whether a human player won the match
  const isHumanWinner = Boolean(
    winner &&
      !winner.isBot &&
      (localPlayerId ? winner.id === localPlayerId : !winner.isBot)
  );

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

  // Rewards calculation with sensible defaults
  const earnedXp = matchRewards?.earnedXp ?? (isLocalWinner ? 120 : 50);
  const earnedCoins = matchRewards?.earnedCoins ?? (isLocalWinner ? 60 : 20);
  const displayLevel = matchRewards?.newLevel ?? 1;
  const displayCurrentXp = matchRewards?.currentXp ?? (isLocalWinner ? 120 : 50);
  const displayXpToNextLevel = matchRewards?.xpToNextLevel ?? (displayLevel * 100);
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      Math.round((displayCurrentXp / (displayXpToNextLevel || 100)) * 100)
    )
  );

  const handleContinueToStep2 = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    setStep(2);
  };

  const handlePlayAgainPress = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    onPlayAgain();
  };

  const handleHomePress = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    (onMainMenu || onQuitRoom)?.();
  };

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
            {/* ========================================================= */}
            {/* SCREEN 1: VICTORY & STANDINGS                            */}
            {/* ========================================================= */}
            {step === 1 && (
              <View style={styles.stepContentWrapper}>
                {/* Trophy Section */}
                <View style={styles.trophyWrapper}>
                  <View
                    style={[
                      styles.trophyCircle,
                      isLocalWinner ? styles.trophyCircleVictory : styles.trophyCircleDefeat,
                    ]}
                  >
                    <Text style={styles.trophyEmoji}>{isLocalWinner ? '🏆' : '🛡️'}</Text>
                  </View>
                </View>

                {/* Banner Tag: VICTORY! vs DEFEAT */}
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

                {/* Cleaned-up Subtitle without turn counts */}
                <Text style={styles.subtitle}>
                  {isLocalWinner
                    ? 'You emptied your hand and won the match!'
                    : `${winner.name} emptied their hand and won the match.`}
                </Text>

                {/* Final Standings / Leaderboard Card with Confetti Constrained to Card Bounds */}
                <View style={styles.statsContainer}>
                  {isHumanWinner && (
                    <ModalConfettiBurst active={visible && isHumanWinner && step === 1} />
                  )}
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

                {/* Primary Action Button: Emerald Green "Continue ➔" */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleContinueToStep2}
                  style={styles.continueBtn}
                >
                  <Text style={styles.continueBtnText}>Continue ➔</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* SCREEN 2: REWARDS & LEVEL UP                             */}
            {/* ========================================================= */}
            {step === 2 && (
              <View style={styles.stepContentWrapper}>
                {/* Step indicator pill */}
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>STEP 2 OF 2</Text>
                </View>

                {/* Celebratory Icon */}
                <View style={styles.rewardsIconCircle}>
                  <Text style={styles.rewardsIconEmoji}>🎁</Text>
                </View>

                {/* Screen 2 Header */}
                <Text style={styles.headline}>MATCH REWARDS</Text>
                <Text style={styles.subtitle}>
                  {isLocalWinner
                    ? 'Victory rewards added to your profile!'
                    : 'Match rewards earned! Keep playing to level up.'}
                </Text>

                {/* Dual XP and Coins Summary Badges */}
                <View style={styles.rewardsSummaryRow}>
                  {/* XP Summary Badge */}
                  <View style={styles.rewardSummaryBadgeXp}>
                    <Text style={styles.rewardSummaryIcon}>⚡</Text>
                    <Text style={styles.rewardSummaryValue}>+{earnedXp} XP</Text>
                    <Text style={styles.rewardSummaryLabel}>XP EARNED</Text>
                  </View>

                  {/* Coins Summary Badge */}
                  <View style={styles.rewardSummaryBadgeCoin}>
                    <Text style={styles.rewardSummaryIcon}>🪙</Text>
                    <Text style={styles.rewardSummaryValue}>+{earnedCoins} Coins</Text>
                    <Text style={styles.rewardSummaryLabel}>COINS EARNED</Text>
                  </View>
                </View>

                {/* Level Progress Bar Card */}
                <View style={styles.levelProgressCard}>
                  <View style={styles.levelProgressHeader}>
                    <Text style={styles.levelProgressLevelText}>Level {displayLevel}</Text>
                    <Text style={styles.levelProgressXpText}>
                      {displayCurrentXp} / {displayXpToNextLevel} XP
                    </Text>
                  </View>
                  <View style={styles.levelProgressBarTrack}>
                    <View
                      style={[
                        styles.levelProgressBarFill,
                        { width: `${progressPct}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.levelProgressFootnote}>
                    {progressPct}% towards Level {displayLevel + 1}
                  </Text>
                </View>

                {/* Celebratory Level Up Card (if leveled up) */}
                {matchRewards?.leveledUp && (
                  <View style={styles.levelUpCard}>
                    <View style={styles.levelUpCardHeader}>
                      <Text style={styles.levelUpEmoji}>🎉</Text>
                      <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
                    </View>
                    <Text style={styles.levelUpSubtitle}>
                      Reached Level {matchRewards.newLevel}!
                    </Text>
                    <View style={styles.levelUpBonusBadge}>
                      <Text style={styles.levelUpBonusText}>
                        Bonus: +{matchRewards.bonusCoins} Coins • +{matchRewards.bonusGems} Gems
                      </Text>
                    </View>
                  </View>
                )}

                {/* Screen 2 Action Buttons (Bottom) */}
                {/* 1. Primary Emerald Green "Play Again" */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePlayAgainPress}
                  style={styles.playAgainBtn}
                >
                  <Text style={styles.playAgainBtnText}>Play Again</Text>
                </TouchableOpacity>

                {/* 2. Soft Cream/Slate Secondary "Home" Button */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleHomePress}
                  style={styles.homeBtn}
                >
                  <Text style={styles.homeBtnText}>Home</Text>
                </TouchableOpacity>

                {/* Standings Link to return to Step 1 */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticsService.cardSelection();
                    setStep(1);
                  }}
                  style={styles.viewStandingsLink}
                >
                  <Text style={styles.viewStandingsLinkText}>◀ View Final Standings</Text>
                </TouchableOpacity>
              </View>
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
  stepContentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  trophyWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    marginVertical: 4,
  },
  trophyCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    zIndex: 2,
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
    fontSize: 38,
  },
  bannerTagContainer: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 6,
    marginTop: 6,
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
  stepPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 8,
  },
  stepPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#92400E',
    letterSpacing: 1,
  },
  rewardsIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rewardsIconEmoji: {
    fontSize: 32,
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
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
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
    backgroundColor: '#F0FDF4',
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
  continueBtn: {
    width: '100%',
    backgroundColor: '#22C55E', // Vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  rewardsSummaryRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 12,
  },
  rewardSummaryBadgeXp: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  rewardSummaryBadgeCoin: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  rewardSummaryIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  rewardSummaryValue: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 2,
  },
  rewardSummaryLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  levelProgressCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelProgressLevelText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  levelProgressXpText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
  },
  levelProgressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  levelProgressBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 999,
  },
  levelProgressFootnote: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  levelUpCard: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  levelUpCardHeader: {
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
  levelUpSubtitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
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
  playAgainBtn: {
    width: '100%',
    backgroundColor: '#22C55E',
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
  homeBtn: {
    width: '100%',
    backgroundColor: '#F1F5F9', // Soft cream/slate secondary pill
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  homeBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#334155',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  viewStandingsLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewStandingsLinkText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#64748B',
  },
});
