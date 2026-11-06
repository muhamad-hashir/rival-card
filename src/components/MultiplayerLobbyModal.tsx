// src/components/MultiplayerLobbyModal.tsx - Unified Multiplayer Hub (Quick Match & Private Rooms)
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ConnectionStatus,
  generateRoomCode,
  multiplayerService,
  RoomPlayer,
} from '../services/supabase';
import { matchmakingService } from '../services/matchmakingService';
import { createGame } from '../gameEngine';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { errorToastService } from '../services/errorToastService';
import { networkService } from '../services/networkService';
import {
  playerProfileService,
  PlayerProfile,
  getAvatarConfig,
} from '../services/playerProfileService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import type { GameState } from '../types';

interface MultiplayerLobbyModalProps {
  visible: boolean;
  onClose: () => void;
  onGameStart: (gameState: GameState, myPlayerId: string, roomCode: string) => void;
}

type PrivateRoomTab = 'host' | 'join';

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  visible,
  onClose,
  onGameStart,
}) => {
  const [privateTab, setPrivateTab] = useState<PrivateRoomTab>('host');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [myPlayerId] = useState<string>(() => `p_${Date.now().toString(36)}`);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Matchmaking State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchSeconds, setSearchSeconds] = useState<number>(0);

  // Preload player profile and wire multiplayer callbacks
  useEffect(() => {
    if (!visible) return;

    playerProfileService.getProfile().then((p) => {
      setProfile(p);
    });

    multiplayerService.setCallbacks({
      onConnectionChange: (status) => {
        setConnectionStatus(status);
      },
      onRoomPlayersUpdate: (players) => {
        setRoomPlayers(players);
      },
      onGameStarted: (initialState) => {
        soundService.playCardDraw();
        hapticsService.validPlay();
        const code = multiplayerService.getRoomCode() || roomCode;
        onGameStart(initialState, myPlayerId, code);
      },
      onError: (errMsg) => {
        setIsBusy(false);
        hapticsService.invalidMove();
        soundService.playError();
        errorToastService.showError(errMsg);
        Alert.alert('Multiplayer Notice', errMsg);
      },
    });

    return () => {
      // Don't auto-leave room on unmount if game is in progress
    };
  }, [visible, myPlayerId, roomCode, onGameStart]);

  // Handle Quick Match "Find Match"
  const handleFindMatch = async () => {
    const canProceed = await networkService.ensureOnline('Quick Match');
    if (!canProceed) return;

    try {
      hapticsService.cardSelection();
      soundService.playCardSnap();

      const userProfile = profile || (await playerProfileService.getProfile());
      setIsSearching(true);
      setSearchSeconds(0);

      await matchmakingService.startMatchmaking(
        {
          id: userProfile.id || myPlayerId,
          name: userProfile.nickname || 'Player',
          avatarId: userProfile.avatarId || 'avatar_1',
        },
        {
          onStatusChange: (status) => {
            if (status === 'idle') {
              setIsSearching(false);
            }
          },
          onTick: (secs) => {
            setSearchSeconds(secs);
          },
          onMatchFound: (result) => {
            setIsSearching(false);
            soundService.playCardDraw();
            hapticsService.validPlay();
            onClose();
            onGameStart(result.initialState, result.myPlayerId, result.roomCode);
          },
          onError: (errMsg) => {
            setIsSearching(false);
            soundService.playError();
            hapticsService.invalidMove();
            errorToastService.showError(errMsg);
            Alert.alert('Matchmaking Notice', errMsg);
          },
        },
        12 // 12-second fallback to RivalBot
      );
    } catch (err: any) {
      setIsSearching(false);
      Alert.alert('Matchmaking Error', err?.message || 'Could not start matchmaking');
    }
  };

  // Handle Quick Match "Cancel Search"
  const handleCancelSearch = async () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    await matchmakingService.cancelMatchmaking();
    setIsSearching(false);
    setSearchSeconds(0);
  };

  // Private Room: Host creates 4-digit code room
  const handleHostRoom = async () => {
    const canProceed = await networkService.ensureOnline('Create Room');
    if (!canProceed) return;

    try {
      setIsBusy(true);
      hapticsService.cardSelection();
      soundService.playCardSnap();

      const userProfile = profile || (await playerProfileService.getProfile());
      const code = generateRoomCode();
      setRoomCode(code);

      await multiplayerService.createRoom(
        {
          id: userProfile.id || myPlayerId,
          name: userProfile.nickname || 'Player',
          avatarId: userProfile.avatarId || 'avatar_1',
        },
        code
      );
      setIsBusy(false);
    } catch (err: any) {
      setIsBusy(false);
      Alert.alert('Error', err?.message || 'Failed to create room');
    }
  };

  // Private Room: Join existing 4-digit room
  const handleJoinRoom = async () => {
    const clean = joinCode.trim();
    if (clean.length !== 4) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Invalid Code', 'Please enter a 4-digit room code.');
      return;
    }

    const canProceed = await networkService.ensureOnline('Join Room');
    if (!canProceed) return;

    try {
      setIsBusy(true);
      hapticsService.cardSelection();
      soundService.playCardSnap();

      const userProfile = profile || (await playerProfileService.getProfile());
      setRoomCode(clean);

      const success = await multiplayerService.joinRoom(clean, {
        id: userProfile.id || myPlayerId,
        name: userProfile.nickname || 'Player',
        avatarId: userProfile.avatarId || 'avatar_1',
      });

      setIsBusy(false);
      if (!success) {
        soundService.playError();
      }
    } catch (err: any) {
      setIsBusy(false);
      Alert.alert('Join Error', err?.message || 'Failed to join room');
    }
  };

  // Host starts the match for private room
  const handleHostStartGame = async () => {
    if (roomPlayers.length < 2) {
      Alert.alert('Waiting for Players', 'At least 2 players are needed to begin the match.');
      return;
    }

    try {
      setIsBusy(true);
      hapticsService.validPlay();
      soundService.playCardDraw();

      const playerConfigs = roomPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
        avatarId: p.avatarId || 'avatar_1',
      }));

      const initialState = createGame(playerConfigs, 'multiplayer');

      await multiplayerService.startGame(initialState);
      setIsBusy(false);
      onGameStart(initialState, myPlayerId, roomCode);
    } catch (err: any) {
      setIsBusy(false);
      Alert.alert('Start Error', err?.message || 'Could not start match');
    }
  };

  // Close Hub Modal
  const handleClose = async () => {
    hapticsService.cardSnap();
    await matchmakingService.cancelMatchmaking();
    await multiplayerService.leaveRoom();
    setIsSearching(false);
    setSearchSeconds(0);
    setRoomPlayers([]);
    setRoomCode('');
    setJoinCode('');
    onClose();
  };

  const avatarConfig = getAvatarConfig(profile?.avatarId);

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitles}>
                <Text style={styles.title}>MULTIPLAYER HUB</Text>
                <Text style={styles.subtitle}>Quick Match & Private Rooms</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.75}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Status Chip (Uses saved nickname & avatar without prompting to re-type) */}
            <View style={styles.profileChip}>
              <View
                style={[
                  styles.profileAvatarCircle,
                  { backgroundColor: avatarConfig.bgColor || '#FED7AA' },
                ]}
              >
                <Text style={styles.profileAvatarEmoji}>{avatarConfig.emoji}</Text>
              </View>
              <View style={styles.profileChipInfo}>
                <Text style={styles.profileChipLabel}>Playing as</Text>
                <Text style={styles.profileChipName} numberOfLines={1}>
                  {profile?.nickname || 'Player'}
                </Text>
              </View>
              <View style={styles.connectionBadge}>
                <View
                  style={[
                    styles.statusDot,
                    connectionStatus === 'connected' && styles.statusConnected,
                    connectionStatus === 'connecting' && styles.statusConnecting,
                    connectionStatus === 'error' && styles.statusError,
                  ]}
                />
                <Text style={styles.connectionText}>
                  {connectionStatus === 'connected'
                    ? 'Online'
                    : connectionStatus === 'connecting'
                    ? 'Connecting'
                    : 'Realtime'}
                </Text>
              </View>
            </View>

            {/* ================================================================= */}
            {/* CARD 1: QUICK MATCH (1v1 Auto-Matchmaking) */}
            {/* ================================================================= */}
            <View style={styles.hubCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Quick Match</Text>
                  <Text style={styles.cardSub}>Instant 1v1 match with an online rival</Text>
                </View>
                <View style={styles.cardBadgeGreen}>
                  <Text style={styles.cardBadgeGreenText}>1V1 AUTO</Text>
                </View>
              </View>

              {isSearching ? (
                /* Searching Overlay on Card 1 */
                <View style={styles.searchingOverlay}>
                  <View style={styles.pulseContainer}>
                    <ActivityIndicator size="large" color="#22C55E" />
                  </View>
                  <Text style={styles.searchingTimerText}>
                    Searching for opponent... 0:{searchSeconds < 10 ? `0${searchSeconds}` : searchSeconds}
                  </Text>
                  <Text style={styles.searchingHintText}>
                    Searching live queue • Auto-pairs RivalBot in 12s
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelSearchBtn}
                    onPress={handleCancelSearch}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelSearchBtnText}>Cancel Search</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Normal Quick Match Action */
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleFindMatch}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Find Match</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ================================================================= */}
            {/* CARD 2: PRIVATE ROOM (Play with Friends) */}
            {/* ================================================================= */}
            <View style={styles.hubCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Private Room</Text>
                  <Text style={styles.cardSub}>Play with friends via 4-digit code</Text>
                </View>
                <View style={styles.cardBadgeBlue}>
                  <Text style={styles.cardBadgeBlueText}>WITH FRIENDS</Text>
                </View>
              </View>

              {/* Segmented Pill Switch: Host Room vs Join Room */}
              <View style={styles.segmentedBar}>
                <TouchableOpacity
                  style={[styles.segmentBtn, privateTab === 'host' && styles.segmentBtnActive]}
                  onPress={() => {
                    hapticsService.cardSelection();
                    soundService.playCardSnap();
                    setPrivateTab('host');
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      privateTab === 'host' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Host Room
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, privateTab === 'join' && styles.segmentBtnActive]}
                  onPress={() => {
                    hapticsService.cardSelection();
                    soundService.playCardSnap();
                    setPrivateTab('join');
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      privateTab === 'join' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Join Room
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Private Room Tab Content */}
              {privateTab === 'host' ? (
                <View style={styles.privateTabContent}>
                  {roomCode ? (
                    <>
                      <Text style={styles.codeLabel}>SHARE THIS 4-DIGIT ROOM CODE</Text>
                      <View style={styles.codeBoxContainer}>
                        {roomCode.split('').map((char, idx) => (
                          <View key={idx} style={styles.codeDigitBox}>
                            <Text style={styles.codeDigitText}>{char}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Joined Players List */}
                      <View style={styles.playersListCard}>
                        <Text style={styles.playersListTitle}>
                          PLAYERS IN ROOM ({roomPlayers.length}/4)
                        </Text>
                        {roomPlayers.map((p) => {
                          const pAvatar = getAvatarConfig(p.avatarId);
                          return (
                            <View key={p.id} style={styles.playerItemRow}>
                              <View style={styles.playerItemLeft}>
                                <Text style={styles.playerItemEmoji}>{pAvatar.emoji}</Text>
                                <Text style={styles.playerItemName}>
                                  {p.name} {p.id === (profile?.id || myPlayerId) ? '(You)' : ''}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.playerItemBadge,
                                  p.isHost ? styles.playerHostBadge : styles.playerReadyBadge,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.playerItemBadgeText,
                                    p.isHost
                                      ? styles.playerHostBadgeText
                                      : styles.playerReadyBadgeText,
                                  ]}
                                >
                                  {p.isHost ? 'Host' : 'Ready'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}

                        {roomPlayers.length < 2 && (
                          <View style={styles.waitingNotice}>
                            <ActivityIndicator size="small" color="#2B8EEA" />
                            <Text style={styles.waitingNoticeText}>
                              Waiting for opponent to enter code...
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Host Start Match Button (Primary Action) */}
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          roomPlayers.length < 2 && styles.btnDisabled,
                        ]}
                        disabled={roomPlayers.length < 2 || isBusy}
                        onPress={handleHostStartGame}
                        activeOpacity={0.8}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryBtnText}>
                            {roomPlayers.length < 2 ? 'Need 2+ Players to Start' : 'Start Match'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.privateIntroContainer}>
                      <Text style={styles.tabIntroText}>
                        Create a room with a 4-digit code and invite friends to join your match.
                      </Text>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={handleHostRoom}
                        disabled={isBusy}
                        activeOpacity={0.85}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryBtnText}>Host Room</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.privateTabContent}>
                  <Text style={styles.codeLabel}>ENTER 4-DIGIT ROOM CODE</Text>
                  <TextInput
                    style={styles.codeEntryInput}
                    value={joinCode}
                    onChangeText={(val) => setJoinCode(val.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="0000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={4}
                  />

                  {/* Secondary Action: Cobalt Blue Pill Button */}
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      joinCode.length !== 4 && styles.btnDisabled,
                    ]}
                    disabled={joinCode.length !== 4 || isBusy}
                    onPress={handleJoinRoom}
                    activeOpacity={0.85}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Join Room</Text>
                    )}
                  </TouchableOpacity>

                  {connectionStatus === 'connected' && roomCode && (
                    <View style={styles.joinedNotice}>
                      <Text style={styles.joinedNoticeTitle}>Connected to Room #{roomCode}</Text>
                      <Text style={styles.joinedNoticeSub}>
                        Waiting for host to start the match...
                      </Text>
                      <ActivityIndicator size="small" color="#16A34A" style={{ marginTop: 6 }} />
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
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
  card: {
    backgroundColor: '#FEF6E9', // Warm cream container surface
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 22,
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  subtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#0F172A',
    fontSize: 15,
  },

  /* Profile Chip */
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    marginBottom: 14,
  },
  profileAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
  },
  profileAvatarEmoji: {
    fontSize: 18,
  },
  profileChipInfo: {
    flex: 1,
  },
  profileChipLabel: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
  },
  profileChipName: {
    ...FONT_CARTOON_BOLD,
    fontSize: 14,
    color: '#0F172A',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginRight: 5,
  },
  statusConnected: {
    backgroundColor: '#22C55E',
  },
  statusConnecting: {
    backgroundColor: '#F59E0B',
  },
  statusError: {
    backgroundColor: '#EF4444',
  },
  connectionText: {
    ...FONT_CARTOON_SEMIBOLD,
    color: '#475569',
    fontSize: 11,
  },

  /* Hub Cards */
  hubCard: {
    backgroundColor: '#FFFDF7', // Warm off-white
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 18,
    color: '#0F172A',
  },
  cardSub: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  cardBadgeGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBadgeGreenText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#15803D',
  },
  cardBadgeBlue: {
    backgroundColor: '#DBEAFE',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBadgeBlueText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#1D4ED8',
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: '#22C55E',
    borderBottomWidth: 4,
    borderColor: '#15803D',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: '#2B8EEA',
    borderBottomWidth: 4,
    borderColor: '#1D4ED8',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  cancelSearchBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelSearchBtnText: {
    ...FONT_CARTOON_BOLD,
    color: '#DC2626',
    fontSize: 14,
  },
  btnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    opacity: 0.7,
  },

  /* Searching Overlay */
  searchingOverlay: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pulseContainer: {
    marginVertical: 4,
  },
  searchingTimerText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    marginTop: 8,
    textAlign: 'center',
  },
  searchingHintText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
    marginBottom: 12,
    textAlign: 'center',
  },

  /* Segmented Pill Switch */
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: '#2B8EEA',
  },
  segmentBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#94A3B8',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },

  /* Private Room Content */
  privateTabContent: {
    paddingTop: 4,
  },
  privateIntroContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabIntroText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  codeLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  codeBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  codeDigitBox: {
    width: 48,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#2B8EEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeDigitText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 26,
    color: '#38BDF8',
  },
  codeEntryInput: {
    ...FONT_CARTOON_HEAVY,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2B8EEA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 24,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 14,
  },
  playersListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
  },
  playersListTitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  playerItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  playerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerItemEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  playerItemName: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#0F172A',
  },
  playerItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  playerHostBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  playerReadyBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  playerItemBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
  },
  playerHostBadgeText: {
    color: '#B45309',
  },
  playerReadyBadgeText: {
    color: '#15803D',
  },
  waitingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  waitingNoticeText: {
    ...FONT_CARTOON_REGULAR,
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  joinedNotice: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  joinedNoticeTitle: {
    ...FONT_CARTOON_BOLD,
    color: '#15803D',
    fontSize: 13,
  },
  joinedNoticeSub: {
    ...FONT_CARTOON_REGULAR,
    color: '#166534',
    fontSize: 11,
    marginTop: 2,
  },
});
