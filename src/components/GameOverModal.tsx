// src/components/GameOverModal.tsx - Displays 2-step paginated victory/defeat, standings, and rewards flow
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GameMode, Player, SeriesState, TimeoutStandingBreakdown } from '../types';
import { getTimeoutTieBreakerNote } from '../gameEngine';
import { isSeriesNaturallyCompleted } from '../utils/seriesEngine';
import type { SetupPreset } from '../screens/HomeScreen';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import { getAvatarConfig, AwardRewardsResult } from '../services/playerProfileService';
import { AvatarIcon } from './AvatarIcon';
import { ModalConfettiBurst } from './ModalConfettiBurst';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  adService,
  computeDoubleMatchRewardBonus,
  MAX_POST_MATCH_REWARDED_ADS_PER_DAY,
  RewardedAdCooldownStatus,
  shouldShowPostMatchDoubleRewardButton,
} from '../services/adService';
import {
  formatScorecardHoldSeconds,
  getRemainingScorecardHoldMs,
  getScorecardHoldProgressPct,
  ROOM_SCORECARD_MIN_DISPLAY_MS,
  shouldShowPlayVsAiOpponents,
} from '../utils/matchEndPacing';

export interface GameOverModalProps {
  visible: boolean;
  winner: Player | null;
  turnCount: number;
  players: Player[];
  localPlayerId?: string;
  mode?: 'bot' | 'online' | 'pass_and_play';
  gameMode?: GameMode;
  isOnlineMode?: boolean;
  isOnlineRoom?: boolean;
  isQuickMatch?: boolean;
  seriesState?: SeriesState | null;
  departedPlayerIds?: string[];
  matchRewards?: AwardRewardsResult | null;
  onDoubleRewardsClaimed?: (
    bonusCoins: number,
    bonusXp: number,
    bonusResult?: AwardRewardsResult
  ) => void;
  endedByTimeout?: boolean;
  timeoutUsedTieBreaker?: boolean;
  timeoutStandings?: TimeoutStandingBreakdown[];
  onPlayAgain: () => void;
  onQuitRoom?: () => void;
  onPlayWithMoreBots?: () => void;
  onPlay1v1?: () => void;
  onSelectPreset?: (preset: SetupPreset) => void;
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
  mode,
  gameMode,
  isOnlineMode = false,
  isOnlineRoom = false,
  isQuickMatch = false,
  seriesState = null,
  departedPlayerIds = [],
  matchRewards = null,
  onDoubleRewardsClaimed,
  endedByTimeout = false,
  timeoutUsedTieBreaker = false,
  timeoutStandings,
  onPlayAgain,
  onQuitRoom,
  onPlayWithMoreBots,
  onPlay1v1,
  onSelectPreset,
  onMainMenu,
}) => {
  // Step 1: "Victory & Standings" | Step 2: "Rewards & Level Up"
  const [step, setStep] = useState<1 | 2>(1);
  const [scorecardHoldRemainingMs, setScorecardHoldRemainingMs] = useState<number>(0);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adRewardClaimed, setAdRewardClaimed] = useState(false);
  const [claimedBonus, setClaimedBonus] = useState<{
    coins: number;
    xp: number;
    result?: AwardRewardsResult;
  } | null>(null);
  const [adFeedbackMessage, setAdFeedbackMessage] = useState<string | null>(null);
  const [adCooldown, setAdCooldown] = useState<RewardedAdCooldownStatus>({
    placement: 'post_match',
    canWatch: true,
    watchedToday: 0,
    remainingWatches: MAX_POST_MATCH_REWARDED_ADS_PER_DAY,
    maxPerDay: MAX_POST_MATCH_REWARDED_ADS_PER_DAY,
    nextAvailableInMs: 0,
  });

  useEffect(() => {
    if (visible) {
      setStep(1);
      setIsWatchingAd(false);
      setAdRewardClaimed(false);
      setClaimedBonus(null);
      setAdFeedbackMessage(null);
      adService.getRewardedAdCooldownStatus('post_match').then(setAdCooldown).catch(() => {});
      adService.preloadRewardedAd();
    } else {
      setScorecardHoldRemainingMs(0);
    }
  }, [visible]);

  // Enforce a 5.5-second minimum Room Scorecard view before auto-advancing to Match Rewards
  useEffect(() => {
    if (!visible || !isOnlineRoom || step !== 1) {
      setScorecardHoldRemainingMs(0);
      return;
    }

    const openedAt = Date.now();
    setScorecardHoldRemainingMs(ROOM_SCORECARD_MIN_DISPLAY_MS);

    const timer = setInterval(() => {
      const remaining = getRemainingScorecardHoldMs(openedAt, Date.now(), ROOM_SCORECARD_MIN_DISPLAY_MS);
      setScorecardHoldRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setStep(2);
      }
    }, 150);

    return () => clearInterval(timer);
  }, [visible, isOnlineRoom, step]);

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

  // Sort players: by timeout standings order when endedByTimeout, otherwise winner first -> cards left
  const sortedPlayers = [...players].sort((a, b) => {
    if (endedByTimeout && timeoutStandings && timeoutStandings.length > 0) {
      const idxA = timeoutStandings.findIndex((s) => s.playerId === a.id);
      const idxB = timeoutStandings.findIndex((s) => s.playerId === b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    }
    if (a.id === winner.id) return -1;
    if (b.id === winner.id) return 1;
    return a.hand.length - b.hand.length;
  });

  const winnerCardLabel = winner.hand.length === 1 ? 'card' : 'cards';
  const step1Subtitle = endedByTimeout
    ? timeoutUsedTieBreaker
      ? `Time expired! ${
          isLocalWinner ? 'You won' : `${winner.name} won`
        } the card-priority tie-breaker with ${winner.hand.length} ${winnerCardLabel} left.`
      : `Time expired! ${
          isLocalWinner ? 'You finished' : `${winner.name} finished`
        } with the fewest cards (${winner.hand.length} ${winnerCardLabel} left).`
    : isLocalWinner
    ? 'You emptied your hand and won the match!'
    : `${winner.name} emptied their hand and won the match.`;

  // Rewards calculation with sensible defaults
  const baseEarnedXp = matchRewards?.earnedXp ?? (isLocalWinner ? 120 : 50);
  const baseEarnedCoins = matchRewards?.earnedCoins ?? (isLocalWinner ? 60 : 20);
  const doubleRewardPreview = computeDoubleMatchRewardBonus({
    baseCoins: baseEarnedCoins,
    baseXp: baseEarnedXp,
  });
  const canShowDoubleRewards = shouldShowPostMatchDoubleRewardButton({
    isWinner: isLocalWinner,
    winnerId: winner?.id,
  });
  const earnedXp = baseEarnedXp + (claimedBonus?.xp ?? 0);
  const earnedCoins = baseEarnedCoins + (claimedBonus?.coins ?? 0);
  const displayLevel = claimedBonus?.result?.newLevel ?? matchRewards?.newLevel ?? 1;
  const displayCurrentXp =
    claimedBonus?.result?.currentXp ?? matchRewards?.currentXp ?? (isLocalWinner ? 120 : 50);
  const displayXpToNextLevel =
    claimedBonus?.result?.xpToNextLevel ?? matchRewards?.xpToNextLevel ?? (displayLevel * 100);
  const didLevelUp = Boolean(matchRewards?.leveledUp || claimedBonus?.result?.leveledUp);
  const totalLevelUpBonusCoins =
    (matchRewards?.bonusCoins ?? 0) + (claimedBonus?.result?.bonusCoins ?? 0);
  const totalLevelUpBonusGems =
    (matchRewards?.bonusGems ?? 0) + (claimedBonus?.result?.bonusGems ?? 0);
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      Math.round((displayCurrentXp / (displayXpToNextLevel || 100)) * 100)
    )
  );

  const isScorecardHoldLocked = Boolean(isOnlineRoom && step === 1 && scorecardHoldRemainingMs > 0);
  const scorecardHoldSeconds = formatScorecardHoldSeconds(scorecardHoldRemainingMs);
  const scorecardHoldProgressPct = getScorecardHoldProgressPct(
    scorecardHoldRemainingMs,
    ROOM_SCORECARD_MIN_DISPLAY_MS
  );

  const handleContinueToStep2 = () => {
    if (isScorecardHoldLocked) return;
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

  const handleWatchRewardedAd = async () => {
    if (isWatchingAd || adRewardClaimed || !canShowDoubleRewards) return;
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsWatchingAd(true);
    setAdFeedbackMessage(null);
    try {
      const result = await adService.showPostMatchDoubleRewardsAd({
        isWinner: isLocalWinner,
        baseCoins: baseEarnedCoins,
        baseXp: baseEarnedXp,
      });
      setAdCooldown(result.cooldownStatus);
      setAdFeedbackMessage(result.message);
      if (result.rewarded) {
        const awardedCoins = result.coinsAwarded;
        const awardedXp = result.xpAwarded ?? 0;
        setAdRewardClaimed(true);
        setClaimedBonus({
          coins: awardedCoins,
          xp: awardedXp,
          result: result.bonusAwardResult,
        });
        onDoubleRewardsClaimed?.(awardedCoins, awardedXp, result.bonusAwardResult);
        hapticsService.victory();
        soundService.playWinChime();
      } else {
        hapticsService.cardSnap();
      }
    } catch {
      setAdFeedbackMessage('No ad available right now. Please try again later.');
    } finally {
      setIsWatchingAd(false);
    }
  };

  const seriesCompletedNaturally = isSeriesNaturallyCompleted(seriesState);
  const seriesEndedEarlyFlag = Boolean(seriesState?.seriesEndedEarly) && !seriesCompletedNaturally;
  const seriesStatusLabel = seriesState?.isPrivateSeries
    ? seriesCompletedNaturally
      ? 'Series Completed'
      : seriesEndedEarlyFlag
      ? 'Series Ended Early'
      : null
    : null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
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

                {/* Banner Tag: TIME'S UP! or VICTORY! / DEFEAT */}
                <View
                  style={[
                    styles.bannerTagContainer,
                    endedByTimeout
                      ? styles.bannerTagTimeout
                      : isLocalWinner
                      ? styles.bannerTagVictory
                      : styles.bannerTagDefeat,
                  ]}
                >
                  <Text
                    style={[
                      styles.bannerTagText,
                      endedByTimeout
                        ? styles.bannerTagTextTimeout
                        : isLocalWinner
                        ? styles.bannerTagTextVictory
                        : styles.bannerTagTextDefeat,
                    ]}
                  >
                    {endedByTimeout
                      ? `⏱️ TIME'S UP! • ${isLocalWinner ? 'VICTORY' : 'DEFEAT'}`
                      : seriesStatusLabel
                      ? `${seriesStatusLabel.toUpperCase()} • ${isLocalWinner ? 'VICTORY' : 'DEFEAT'}`
                      : isLocalWinner
                      ? 'VICTORY!'
                      : 'DEFEAT'}
                  </Text>
                </View>

                {/* Main Headline */}
                <Text style={styles.headline}>
                  {isLocalWinner ? 'You Won!' : `${winner.name} Won!`}
                </Text>

                {/* Outcome Subtitle */}
                <Text style={styles.subtitle}>{step1Subtitle}</Text>

                {/* Final Standings / Leaderboard Card */}
                <View style={styles.statsContainer}>
                  <Text style={styles.statsHeader}>
                    {endedByTimeout ? "TIME'S UP STANDINGS" : 'FINAL STANDINGS'}
                  </Text>
                  {sortedPlayers.map((p, index) => {
                    const isWinner = p.id === winner.id;
                    const isLocalPlayer = localPlayerId ? p.id === localPlayerId : p.id === 'p1';
                    const isAlreadyNamedYou = p.name.trim().toLowerCase() === 'you';
                    const displayName = isAlreadyNamedYou
                      ? 'You'
                      : isLocalPlayer
                      ? `${p.name} (You)`
                      : p.name;
                    const tieBreakerNote = endedByTimeout
                      ? getTimeoutTieBreakerNote(p.id, timeoutStandings)
                      : null;
                    const hasLeftRoom =
                      departedPlayerIds.includes(p.id) ||
                      seriesState?.playerStats?.[p.id]?.isActive === false;
                    const pCardLabel = p.hand.length === 1 ? 'card' : 'cards';

                    return (
                      <View
                        key={p.id}
                        style={[
                          styles.playerRow,
                          isWinner && styles.winnerPlayerRow,
                          !isWinner && isLocalPlayer && styles.localPlayerRow,
                        ]}
                      >
                        {/* Column 1: Rank */}
                        <View style={styles.rankColumn}>
                          <Text style={[styles.rankText, isWinner && styles.winnerRankText]}>
                            {getOrdinalRank(index)}
                          </Text>
                        </View>

                        {/* Column 2: Player Avatar & Name */}
                        <View style={styles.playerInfoColumn}>
                          {Boolean(p.avatarId) && (
                            <AvatarIcon avatarId={p.avatarId} size={34} showCircle />
                          )}
                          <View style={styles.playerNameStack}>
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
                            {hasLeftRoom && (
                              <View style={styles.leftRoomBadge}>
                                <Text style={styles.leftRoomBadgeText}>Left Room</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Column 3: Remaining Cards / Tie-Breaker Note / Winner Badge */}
                        <View style={styles.cardCountColumn}>
                          {isWinner ? (
                            <View style={styles.winnerBadge}>
                              <Text style={styles.winnerBadgeText}>
                                {endedByTimeout
                                  ? `1ST • ${p.hand.length} ${pCardLabel}`
                                  : '1ST • WINNER'}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.playerRowCount}>
                              {p.hand.length} {pCardLabel} left
                            </Text>
                          )}
                          {Boolean(tieBreakerNote) && (
                            <Text style={styles.tieBreakerMeta}>{tieBreakerNote}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Visible Room Scorecard minimum-display countdown & progress bar */}
                {isScorecardHoldLocked && (
                  <View style={styles.scorecardHoldBox} testID="gameover-scorecard-hold-banner">
                    <Text style={styles.scorecardHoldText}>
                      Room Scorecard • Match Rewards in {scorecardHoldSeconds}s
                    </Text>
                    <View style={styles.scorecardHoldTrack}>
                      <View
                        style={[styles.scorecardHoldFill, { width: `${scorecardHoldProgressPct}%` }]}
                      />
                    </View>
                  </View>
                )}

                {/* Primary Action Button: Emerald Green "Continue ➔" */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isScorecardHoldLocked}
                  onPress={handleContinueToStep2}
                  style={[styles.continueBtn, isScorecardHoldLocked && styles.continueBtnDisabled]}
                  accessibilityState={{ disabled: isScorecardHoldLocked }}
                >
                  <Text style={styles.continueBtnText}>
                    {isScorecardHoldLocked ? `Continue in ${scorecardHoldSeconds}s...` : 'Continue ➔'}
                  </Text>
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
                {didLevelUp && (
                  <View style={styles.levelUpCard}>
                    <View style={styles.levelUpCardHeader}>
                      <Text style={styles.levelUpEmoji}>🎉</Text>
                      <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
                    </View>
                    <Text style={styles.levelUpSubtitle}>
                      Reached Level {displayLevel}!
                    </Text>
                    <View style={styles.levelUpBonusBadge}>
                      <Text style={styles.levelUpBonusText}>
                        Bonus: +{totalLevelUpBonusCoins} Coins • +{totalLevelUpBonusGems} Gems
                      </Text>
                    </View>
                  </View>
                )}

                {/* Winners-Only 2x Match Rewards Ad Bonus (max 5/day) */}
                {canShowDoubleRewards && (
                  <View style={styles.rewardedAdContainer}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={isWatchingAd || adRewardClaimed}
                      onPress={handleWatchRewardedAd}
                      style={[
                        styles.rewardedAdBtn,
                        adRewardClaimed && styles.rewardedAdBtnClaimed,
                        !adRewardClaimed && !adCooldown.canWatch && styles.rewardedAdBtnCooldown,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Watch Ad for 2x Rewards (+${doubleRewardPreview.bonusCoins} Coins${
                        doubleRewardPreview.bonusXp > 0
                          ? `, +${doubleRewardPreview.bonusXp} XP`
                          : ''
                      })`}
                      testID="gameover-watch-ad-btn"
                    >
                      {isWatchingAd ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.rewardedAdBtnText}>
                          {adRewardClaimed
                            ? `✓ 2x Rewards Claimed! (+${doubleRewardPreview.bonusCoins} Coins${
                                doubleRewardPreview.bonusXp > 0
                                  ? `, +${doubleRewardPreview.bonusXp} XP`
                                  : ''
                              })`
                            : adCooldown.canWatch
                            ? `🎬 Watch Ad • 2x Rewards (+${doubleRewardPreview.bonusCoins} Coins${
                                doubleRewardPreview.bonusXp > 0
                                  ? `, +${doubleRewardPreview.bonusXp} XP`
                                  : ''
                              })`
                            : '🎬 No more ads available for today'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {Boolean(adFeedbackMessage) && (
                      <Text style={styles.rewardedAdFeedback}>{adFeedbackMessage}</Text>
                    )}
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

                {/* Bot Match Option: Multi-Bot Selection Row (Solo vs AI only — never Play Online) */}
                {shouldShowPlayVsAiOpponents({
                  mode,
                  gameMode,
                  isOnlineMode,
                  isOnlineRoom,
                  isQuickMatch,
                  hasHandlers: Boolean(onSelectPreset || onPlay1v1 || onPlayWithMoreBots),
                }) && (
                  <View style={styles.botSelectorContainer}>
                    <Text style={styles.botSelectorLabel}>PLAY VS AI OPPONENTS</Text>
                    <View style={styles.botSelectorRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.botSelectorBtn,
                          players.length === 2 && styles.botSelectorBtnActive,
                        ]}
                        onPress={() => {
                          hapticsService.cardSnap();
                          soundService.playCardSnap();
                          if (onSelectPreset) {
                            onSelectPreset('vs_bot_2p');
                          } else {
                            onPlay1v1?.();
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.botSelectorBtnText,
                            players.length === 2 && styles.botSelectorBtnTextActive,
                          ]}
                        >
                          1 Bot (1v1)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.botSelectorBtn,
                          players.length === 3 && styles.botSelectorBtnActive,
                        ]}
                        onPress={() => {
                          hapticsService.cardSnap();
                          soundService.playCardSnap();
                          if (onSelectPreset) {
                            onSelectPreset('vs_bot_3p');
                          } else {
                            onPlayAgain();
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.botSelectorBtnText,
                            players.length === 3 && styles.botSelectorBtnTextActive,
                          ]}
                        >
                          2 Bots (3P)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.botSelectorBtn,
                          players.length === 4 && styles.botSelectorBtnActive,
                        ]}
                        onPress={() => {
                          hapticsService.cardSnap();
                          soundService.playCardSnap();
                          if (onSelectPreset) {
                            onSelectPreset('vs_bot_4p');
                          } else {
                            onPlayWithMoreBots?.();
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.botSelectorBtnText,
                            players.length === 4 && styles.botSelectorBtnTextActive,
                          ]}
                        >
                          3 Bots (4P)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

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
          </ScrollView>
        </View>
        {isHumanWinner && (
          <ModalConfettiBurst active={visible && isHumanWinner && step === 1} />
        )}
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
    padding: 10,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9', // Warm cream surface matching room creation & homescreen
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stepContentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  trophyWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    marginVertical: 2,
  },
  trophyCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
    fontSize: 28,
  },
  bannerTagContainer: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 4,
    marginTop: 4,
  },
  bannerTagVictory: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  bannerTagDefeat: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  bannerTagTimeout: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  bannerTagText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  bannerTagTextVictory: {
    color: '#D97706',
  },
  bannerTagTextDefeat: {
    color: '#EF4444',
  },
  bannerTagTextTimeout: {
    color: '#B45309',
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
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  statsHeader: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
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
  rankColumn: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  playerInfoColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  cardCountColumn: {
    minWidth: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rankText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
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
  },
  playerNameStack: {
    flex: 1,
  },
  leftRoomBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  leftRoomBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#DC2626',
  },
  winnerRowName: {
    color: '#0F172A',
    fontSize: 14,
  },
  localPlayerRowName: {
    color: '#0369A1',
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
  tieBreakerMeta: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#92400E',
    marginTop: 2,
    textAlign: 'right',
  },
  continueBtn: {
    width: '100%',
    backgroundColor: '#10B981', // Modern vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueBtnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    shadowOpacity: 0.08,
  },
  scorecardHoldBox: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  scorecardHoldText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 6,
  },
  scorecardHoldTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    overflow: 'hidden',
  },
  scorecardHoldFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 999,
  },
  continueBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 15,
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
    backgroundColor: '#10B981',
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
  rewardedAdContainer: {
    width: '100%',
    marginBottom: 10,
    alignItems: 'center',
  },
  rewardedAdBtn: {
    width: '100%',
    backgroundColor: '#F59E0B',
    borderBottomWidth: 4,
    borderColor: '#B45309',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  rewardedAdBtnClaimed: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  rewardedAdBtnCooldown: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
  },
  rewardedAdBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
  rewardedAdFeedback: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#92400E',
    marginTop: 5,
    textAlign: 'center',
  },
  playAgainBtn: {
    width: '100%',
    backgroundColor: '#10B981', // Modern vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#059669',
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
  switchModeBtn: {
    width: '100%',
    backgroundColor: '#FEF6E9',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  switchModeBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#92400E',
    letterSpacing: 0.4,
  },
  botSelectorContainer: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  botSelectorLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#8A715D',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  botSelectorRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 6,
  },
  botSelectorBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF6E9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botSelectorBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
    borderBottomWidth: 3,
  },
  botSelectorBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  botSelectorBtnTextActive: {
    color: '#FFFFFF',
  },
  homeBtn: {
    width: '100%',
    backgroundColor: '#F1F5F9', // Soft cream/slate secondary pill
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 11,
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
