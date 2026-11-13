// src/components/PrivateSeriesModal.tsx - Game-themed Between-Round & Final 5-Match Series Scorecard Modals
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Player, SeriesState } from '../types';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { getAvatarConfig } from '../services/playerProfileService';
import { getActiveSeriesPlayers, getSeriesStandings } from '../utils/seriesEngine';
import { ModalConfettiBurst } from './ModalConfettiBurst';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';

export interface PrivateSeriesModalProps {
  visible: boolean;
  seriesState: SeriesState | null | undefined;
  roundWinner: Player | null;
  localPlayerId: string;
  nextMatchCountdown: number | null;
  onNextMatch: () => void;
  onPlayNewSeries: () => void;
  onLeaveRoom: () => void;
}

function getSeriesRankBadge(index: number): string {
  if (index === 0) return '🥇 1ST';
  if (index === 1) return '🥈 2ND';
  if (index === 2) return '🥉 3RD';
  return `${index + 1}TH`;
}

export const PrivateSeriesModal: React.FC<PrivateSeriesModalProps> = ({
  visible,
  seriesState,
  roundWinner,
  localPlayerId,
  nextMatchCountdown,
  onNextMatch,
  onPlayNewSeries,
  onLeaveRoom,
}) => {
  if (!visible || !seriesState || !seriesState.isPrivateSeries) {
    return null;
  }

  const standings = getSeriesStandings(seriesState);
  const activePlayers = getActiveSeriesPlayers(seriesState);
  const isFinalMatch =
    Boolean(seriesState.seriesEndedEarly) ||
    seriesState.currentMatchNumber >= seriesState.totalMatches;

  const isHost = seriesState.hostPlayerId === localPlayerId;
  const canContinueSeries = activePlayers.length >= 2;
  const nextMatchNumber = Math.min(seriesState.currentMatchNumber + 1, seriesState.totalMatches);

  const seriesChampion = standings[0] ?? null;
  const isLocalRoundWinner = Boolean(roundWinner && roundWinner.id === localPlayerId);
  const isLocalChampion = Boolean(seriesChampion && seriesChampion.playerId === localPlayerId);

  const handleNextPress = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    onNextMatch();
  };

  const handleNewSeriesPress = () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    onPlayNewSeries();
  };

  const handleLeavePress = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onLeaveRoom();
  };

  const pillText = isFinalMatch
    ? seriesState.seriesEndedEarly
      ? `SERIES ENDED • ${seriesState.roundResults.length}/${seriesState.totalMatches} PLAYED`
      : `SERIES COMPLETE • ${seriesState.totalMatches}/${seriesState.totalMatches}`
    : `MATCH ${seriesState.currentMatchNumber} OF ${seriesState.totalMatches}`;

  const headline = isFinalMatch
    ? seriesState.seriesEndedEarly
      ? 'Series Ended Early'
      : isLocalChampion
      ? 'Series Champion!'
      : `${seriesChampion?.name || 'Player'} Wins the Series!`
    : isLocalRoundWinner
    ? `You Won Match ${seriesState.currentMatchNumber}!`
    : `${roundWinner?.name || 'Player'} Won Match ${seriesState.currentMatchNumber}!`;

  const subtitle = isFinalMatch
    ? seriesState.seriesEndedEarly
      ? seriesState.endedReason || 'Not enough players remained to continue the 5-match series.'
      : isLocalChampion
      ? 'You topped the 5-match private room leaderboard!'
      : `Final rankings after all ${seriesState.totalMatches} matches.`
    : `Standings after Match ${seriesState.currentMatchNumber} of ${seriesState.totalMatches}. Next round resets hands and deck.`;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Trophy / Crown Icon */}
            <View style={styles.trophyWrapper}>
              <View
                style={[
                  styles.trophyCircle,
                  (isFinalMatch ? isLocalChampion : isLocalRoundWinner)
                    ? styles.trophyCircleVictory
                    : styles.trophyCircleNeutral,
                ]}
              >
                <Text style={styles.trophyEmoji}>
                  {isFinalMatch ? (seriesState.seriesEndedEarly ? '🏁' : '👑') : isLocalRoundWinner ? '🏆' : '🃏'}
                </Text>
              </View>
            </View>

            {/* Series Progress / Completion Pill */}
            <View style={styles.seriesPill}>
              <Text style={styles.seriesPillText}>{pillText}</Text>
            </View>

            {/* Headline & Subtitle */}
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {/* Series Leaderboard / Final Scorecard Container */}
            <View style={styles.statsContainer}>
              {(isFinalMatch ? isLocalChampion : isLocalRoundWinner) && (
                <ModalConfettiBurst active={visible} />
              )}
              <Text style={styles.statsHeader}>
                {isFinalMatch ? 'FINAL SERIES SCORECARD' : 'SERIES STANDINGS'}
              </Text>

              {standings.map((entry, index) => {
                const isLocal = entry.playerId === localPlayerId;
                const isFirst = index === 0;
                const avatar = getAvatarConfig(entry.avatarId || 'avatar_1');
                const displayName = isLocal ? `${entry.name} (You)` : entry.name;

                return (
                  <View
                    key={entry.playerId}
                    style={[
                      styles.playerRow,
                      isFirst && styles.leaderRow,
                      !isFirst && isLocal && styles.localRow,
                      !entry.isActive && styles.leftRow,
                    ]}
                  >
                    {/* Rank Badge */}
                    <View style={styles.rankColumn}>
                      <Text style={[styles.rankText, isFirst && styles.leaderRankText]}>
                        {getSeriesRankBadge(index)}
                      </Text>
                    </View>

                    {/* Avatar + Name + Left tag */}
                    <View style={styles.playerInfoColumn}>
                      <Text style={styles.standingsAvatarEmoji}>{avatar.emoji}</Text>
                      <View style={styles.nameWrapper}>
                        <Text
                          style={[
                            styles.playerRowName,
                            isFirst && styles.leaderNameText,
                            !isFirst && isLocal && styles.localNameText,
                          ]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        {!entry.isActive && (
                          <Text style={styles.leftRoomTag}>Left room</Text>
                        )}
                      </View>
                    </View>

                    {/* Wins & Total Series Score */}
                    <View style={styles.scoreColumn}>
                      <Text style={[styles.pointsText, isFirst && styles.leaderPointsText]}>
                        {entry.totalPoints} pts
                      </Text>
                      <Text style={styles.winsText}>
                        {entry.wins} {entry.wins === 1 ? 'Win' : 'Wins'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* BETWEEN-ROUND ACTIONS (Matches 1–4) */}
            {!isFinalMatch && (
              <View style={styles.actionsColumn}>
                {isHost ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNextPress}
                    style={styles.primaryActionBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Start Match ${nextMatchNumber} of ${seriesState.totalMatches}`}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      {nextMatchCountdown !== null
                        ? `Next Match (${nextMatchNumber}/${seriesState.totalMatches}) • ${nextMatchCountdown}s ➔`
                        : `Next Match (${nextMatchNumber}/${seriesState.totalMatches}) ➔`}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.waitingHostBanner}>
                    <Text style={styles.waitingHostText}>
                      {nextMatchCountdown !== null
                        ? `⏳ Starting Match ${nextMatchNumber}/${seriesState.totalMatches} in ${nextMatchCountdown}s...`
                        : `⏳ Waiting for Host to start Match ${nextMatchNumber}/${seriesState.totalMatches}...`}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleLeavePress}
                  style={styles.leaveRoomBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Leave Room"
                >
                  <Text style={styles.leaveRoomBtnText}>Leave Room</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* FINAL SERIES SCORECARD ACTIONS (After Match 5 or Early End) */}
            {isFinalMatch && (
              <View style={styles.actionsColumn}>
                {isHost && canContinueSeries && !seriesState.seriesEndedEarly && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleNewSeriesPress}
                    style={styles.primaryActionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Play New 5-Match Series"
                  >
                    <Text style={styles.primaryActionBtnText}>Play New 5-Match Series</Text>
                  </TouchableOpacity>
                )}

                {!isHost && canContinueSeries && !seriesState.seriesEndedEarly && (
                  <View style={styles.waitingHostBanner}>
                    <Text style={styles.waitingHostText}>
                      Host can start a new 5-match series or head back to lobby.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleLeavePress}
                  style={[
                    styles.secondaryLobbyBtn,
                    (!isHost || seriesState.seriesEndedEarly || !canContinueSeries) &&
                      styles.primarySlateFallbackBtn,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Lobby"
                >
                  <Text
                    style={[
                      styles.secondaryLobbyBtnText,
                      (!isHost || seriesState.seriesEndedEarly || !canContinueSeries) &&
                        styles.primarySlateFallbackText,
                    ]}
                  >
                    Back to Lobby
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 410,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  trophyWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trophyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  trophyCircleVictory: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  trophyCircleNeutral: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  trophyEmoji: {
    fontSize: 28,
  },
  seriesPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 6,
  },
  seriesPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#92400E',
    letterSpacing: 1,
  },
  headline: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  statsHeader: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.9,
    marginBottom: 8,
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  leaderRow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  localRow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  leftRow: {
    opacity: 0.7,
  },
  rankColumn: {
    minWidth: 52,
    marginRight: 6,
  },
  rankText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#475569',
  },
  leaderRankText: {
    color: '#B45309',
  },
  playerInfoColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  standingsAvatarEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  nameWrapper: {
    flex: 1,
  },
  playerRowName: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#1E293B',
  },
  leaderNameText: {
    color: '#92400E',
  },
  localNameText: {
    color: '#1D4ED8',
  },
  leftRoomTag: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#DC2626',
  },
  scoreColumn: {
    alignItems: 'flex-end',
  },
  pointsText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  leaderPointsText: {
    color: '#B45309',
  },
  winsText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
  },
  actionsColumn: {
    width: '100%',
    gap: 8,
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  waitingHostBanner: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  waitingHostText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  leaveRoomBtn: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveRoomBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  secondaryLobbyBtn: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLobbyBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#334155',
    letterSpacing: 0.4,
  },
  primarySlateFallbackBtn: {
    backgroundColor: '#1E293B',
    borderColor: '#0F172A',
  },
  primarySlateFallbackText: {
    color: '#FFFFFF',
  },
});
