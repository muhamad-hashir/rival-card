// src/components/MultiplayerLobbyModal.tsx - Online Multiplayer Room Hosting & Joining Modal
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { createGame } from '../gameEngine';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import type { GameState } from '../types';

interface MultiplayerLobbyModalProps {
  visible: boolean;
  onClose: () => void;
  onGameStart: (gameState: GameState, myPlayerId: string, roomCode: string) => void;
}

type LobbyTab = 'create' | 'join';

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  visible,
  onClose,
  onGameStart,
}) => {
  const [activeTab, setActiveTab] = useState<LobbyTab>('create');
  const [playerName, setPlayerName] = useState<string>('Player');
  const [joinCode, setJoinCode] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [myPlayerId] = useState<string>(() => `p_${Date.now().toString(36)}`);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Setup callbacks when modal is visible
  useEffect(() => {
    if (!visible) return;

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
        Alert.alert('Multiplayer Error', errMsg);
      },
    });

    return () => {
      // Don't leave room on unmount if game started
    };
  }, [visible, myPlayerId, roomCode, onGameStart]);

  // Host room creation
  const handleCreateRoom = async () => {
    try {
      setIsBusy(true);
      hapticsService.cardSelection();
      const code = generateRoomCode();
      setRoomCode(code);
      await multiplayerService.createRoom(
        { id: myPlayerId, name: playerName.trim() || 'Host' },
        code
      );
      setIsBusy(false);
    } catch (err: any) {
      setIsBusy(false);
      Alert.alert('Error', err?.message || 'Failed to create room');
    }
  };

  // Join room by 4-digit code
  const handleJoinRoom = async () => {
    const clean = joinCode.trim();
    if (clean.length !== 4) {
      hapticsService.invalidMove();
      Alert.alert('Invalid Code', 'Please enter a 4-digit room code.');
      return;
    }

    try {
      setIsBusy(true);
      hapticsService.cardSelection();
      setRoomCode(clean);
      const success = await multiplayerService.joinRoom(clean, {
        id: myPlayerId,
        name: playerName.trim() || 'Player 2',
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

  // Host starts the match
  const handleHostStartGame = async () => {
    if (roomPlayers.length < 2) {
      Alert.alert('Waiting for Players', 'At least 2 players are needed to begin the match.');
      return;
    }

    try {
      setIsBusy(true);
      hapticsService.validPlay();
      soundService.playCardDraw();

      // Create multiplayer game with joined players
      const playerConfigs = roomPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
      }));

      const initialState = createGame(playerConfigs, 'multiplayer');

      // Broadcast start to all joined players
      await multiplayerService.startGame(initialState);

      setIsBusy(false);
      onGameStart(initialState, myPlayerId, roomCode);
    } catch (err: any) {
      setIsBusy(false);
      Alert.alert('Start Error', err?.message || 'Could not start match');
    }
  };

  const handleClose = async () => {
    hapticsService.cardSnap();
    await multiplayerService.leaveRoom();
    setRoomPlayers([]);
    setRoomCode('');
    setJoinCode('');
    onClose();
  };

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
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>ONLINE MULTIPLAYER</Text>
              <Text style={styles.subtitle}>Play in real-time with friends</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Connection Status Badge */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                connectionStatus === 'connected' && styles.statusConnected,
                connectionStatus === 'connecting' && styles.statusConnecting,
                connectionStatus === 'error' && styles.statusError,
              ]}
            />
            <Text style={styles.statusText}>
              {connectionStatus === 'connected'
                ? 'Connected to Realtime'
                : connectionStatus === 'connecting'
                ? 'Connecting to Lobby...'
                : 'Offline'}
            </Text>
          </View>

          {/* Player Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>YOUR NICKNAME</Text>
            <TextInput
              style={styles.textInput}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Enter your name"
              placeholderTextColor="#64748B"
              maxLength={15}
            />
          </View>

          {/* Tabs: Create vs Join */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
              onPress={() => {
                hapticsService.cardSelection();
                setActiveTab('create');
              }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'create' && styles.tabBtnTextActive]}>
                👑 Host Room
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'join' && styles.tabBtnActive]}
              onPress={() => {
                hapticsService.cardSelection();
                setActiveTab('join');
              }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'join' && styles.tabBtnTextActive]}>
                🚪 Join Room
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'create' ? (
            <View style={styles.tabContent}>
              {roomCode ? (
                <>
                  <Text style={styles.codeLabel}>SHARE THIS 4-DIGIT ROOM CODE:</Text>
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
                      PLAYERS IN LOBBY ({roomPlayers.length}/4)
                    </Text>
                    {roomPlayers.map((p, index) => (
                      <View key={p.id} style={styles.playerItemRow}>
                        <Text style={styles.playerItemName}>
                          {p.isHost ? '👑 ' : '👤 '}
                          {p.name} {p.id === myPlayerId ? '(You)' : ''}
                        </Text>
                        <View style={styles.playerItemBadge}>
                          <Text style={styles.playerItemBadgeText}>
                            {p.isHost ? 'Host' : 'Ready'}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {roomPlayers.length < 2 && (
                      <View style={styles.waitingNotice}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={styles.waitingNoticeText}>
                          Waiting for opponent to enter code...
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Host Start Button */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.startBtn,
                      roomPlayers.length < 2 && styles.btnDisabled,
                    ]}
                    disabled={roomPlayers.length < 2 || isBusy}
                    onPress={handleHostStartGame}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>
                        {roomPlayers.length < 2 ? 'Need 2+ Players to Start' : '🚀 Start Match'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.centerActionContainer}>
                  <Text style={styles.tabIntroText}>
                    Create a private room to challenge your friends online with real-time card
                    synchronization.
                  </Text>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.createBtn]}
                    onPress={handleCreateRoom}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>⚡ Generate 4-Digit Room</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.tabContent}>
              <Text style={styles.codeLabel}>ENTER 4-DIGIT ROOM CODE:</Text>
              <TextInput
                style={styles.codeEntryInput}
                value={joinCode}
                onChangeText={(val) => setJoinCode(val.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="4-digit code (e.g. 1234)"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                maxLength={4}
              />

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.joinBtn,
                  joinCode.length !== 4 && styles.btnDisabled,
                ]}
                disabled={joinCode.length !== 4 || isBusy}
                onPress={handleJoinRoom}
              >
                {isBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>🎮 Join Match</Text>
                )}
              </TouchableOpacity>

              {connectionStatus === 'connected' && roomCode && (
                <View style={styles.joinedNotice}>
                  <Text style={styles.joinedNoticeTitle}>✅ Connected to Room #{roomCode}!</Text>
                  <Text style={styles.joinedNoticeSub}>
                    Waiting for the host to start the match...
                  </Text>
                  <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 8 }} />
                </View>
              )}
            </View>
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
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748B',
    marginRight: 6,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusConnecting: {
    backgroundColor: '#F59E0B',
  },
  statusError: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#334155',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    color: '#F8FAFC',
  },
  tabContent: {
    minHeight: 180,
  },
  tabIntroText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  centerActionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  codeBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  codeDigitBox: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeDigitText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#60A5FA',
    letterSpacing: 1,
  },
  codeEntryInput: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  playersListCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playersListTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  playerItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  playerItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  playerItemBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  playerItemBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  waitingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  waitingNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    backgroundColor: '#3B82F6',
    width: '100%',
  },
  startBtn: {
    backgroundColor: '#10B981',
    width: '100%',
  },
  joinBtn: {
    backgroundColor: '#8B5CF6',
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  joinedNotice: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  joinedNoticeTitle: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  joinedNoticeSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
});
