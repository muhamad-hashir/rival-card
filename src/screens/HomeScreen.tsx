import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ProfileModal } from '../components/ProfileModal';
import { ResumeMatchModal } from '../components/ResumeMatchModal';
import {
  playerProfileService,
  PlayerProfile,
  getAvatarConfig,
} from '../services/playerProfileService';
import {
  multiplayerService,
  getActiveMatchSession,
  clearActiveMatchSession,
  ActiveMatchSession,
} from '../services/multiplayerService';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';
import type { GameState } from '../types';

const HOMESCREEN_IMAGE = require('../../assets/homescreen.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

interface HomeScreenProps {
  onStartOfflineGame: (presetKey: SetupPreset) => void;
  onStartOnlineGame: (initialState: GameState, myPlayerId: string, roomCode: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartOfflineGame,
  onStartOnlineGame,
}) => {
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [pendingResumeSession, setPendingResumeSession] = useState<ActiveMatchSession | null>(null);
  const [isRejoiningSession, setIsRejoiningSession] = useState(false);

  // Check for unexpired active online match session on initial launch (< 10 minutes old)
  useEffect(() => {
    async function checkResumeSession() {
      try {
        const session = await getActiveMatchSession();
        if (!session) return;
        const TEN_MINUTES_MS = 10 * 60 * 1000;
        if (Date.now() - session.timestamp < TEN_MINUTES_MS) {
          setPendingResumeSession(session);
        } else {
          await clearActiveMatchSession();
        }
      } catch {
        // ignore storage errors
      }
    }
    checkResumeSession();
  }, []);

  const handleRejoinSession = async () => {
    if (!pendingResumeSession) return;
    try {
      setIsRejoiningSession(true);
      hapticsService.cardSelection();
      soundService.playCardSnap();

      const userProfile = profile || (await playerProfileService.getProfile());
      const { roomId, playerId } = pendingResumeSession;

      const joined = await multiplayerService.joinRoom(roomId, {
        id: playerId,
        name: userProfile.nickname || 'Player',
        avatarId: userProfile.avatarId || 'avatar_1',
      });

      if (!joined) {
        setIsRejoiningSession(false);
        await clearActiveMatchSession();
        setPendingResumeSession(null);
        Alert.alert('Notice', 'Could not rejoin room. The match may have ended.');
        return;
      }

      let snapshotReceived = false;
      const timeoutTimer = setTimeout(async () => {
        if (!snapshotReceived) {
          setIsRejoiningSession(false);
          await clearActiveMatchSession();
          setPendingResumeSession(null);
          Alert.alert('Notice', 'Match session expired or host disconnected.');
        }
      }, 4000);

      multiplayerService.setCallbacks({
        onGameStarted: (initialState) => {
          snapshotReceived = true;
          clearTimeout(timeoutTimer);
          setIsRejoiningSession(false);
          setPendingResumeSession(null);
          onStartOnlineGame(initialState, playerId, roomId);
        },
        onGameStateUpdate: (state) => {
          snapshotReceived = true;
          clearTimeout(timeoutTimer);
          setIsRejoiningSession(false);
          setPendingResumeSession(null);
          onStartOnlineGame(state, playerId, roomId);
        },
        onStateSnapshotReceived: (state) => {
          snapshotReceived = true;
          clearTimeout(timeoutTimer);
          setIsRejoiningSession(false);
          setPendingResumeSession(null);
          onStartOnlineGame(state, playerId, roomId);
        },
      });

      await multiplayerService.requestStateSnapshot();
    } catch (err: any) {
      setIsRejoiningSession(false);
      await clearActiveMatchSession();
      setPendingResumeSession(null);
      Alert.alert('Rejoin Error', err?.message || 'Could not rejoin match');
    }
  };

  const handleAbandonSession = async () => {
    hapticsService.cardSnap();
    soundService.playCardSnap();
    await clearActiveMatchSession();
    setPendingResumeSession(null);
  };

  // Load and subscribe to persistent guest profile updates
  useEffect(() => {
    playerProfileService.getProfile().then(setProfile);
    const unsubscribe = playerProfileService.subscribe(setProfile);
    return () => unsubscribe();
  }, []);

  // Lock orientation to portrait when mounting Home Screen
  useEffect(() => {
    async function lockPortrait() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch {
        // Fallback for web or unsupported orientation devices
      }
    }
    lockPortrait();
  }, []);

  // Button 1: Play vs Bot (triggers offline vs bot mode immediately)
  const handlePressVsBot = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('vs_bot_2p');
  };

  // Button 2: Pass & Play (triggers local 2P mode immediately)
  const handlePressPassAndPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('pass_play_2p');
  };

  // Button 3: Online Multiplayer (opens real-time room lobby modal)
  const handlePressOnlineMultiplayer = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsLobbyModalOpen(true);
  };

  // Header: Open Profile Editor Modal
  const handlePressProfile = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (newNickname: string, newAvatarId: string) => {
    await playerProfileService.updateNickname(newNickname);
    await playerProfileService.updateAvatar(newAvatarId);
    const updated = await playerProfileService.getProfile(true);
    setProfile(updated);
  };

  const handleCloseProfileModal = async () => {
    setIsProfileModalOpen(false);
    const updated = await playerProfileService.getProfile(true);
    setProfile(updated);
  };

  const activeAvatar = getAvatarConfig(profile?.avatarId);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={HOMESCREEN_IMAGE}
        style={styles.backgroundImage}
        resizeMode="stretch"
      >
        {/* Invisible Touch Overlay Button 1: Play vs Bot */}
        <Pressable
          onPress={handlePressVsBot}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn1,
            pressed && styles.touchOverlayPressed,
          ]}
        />

        {/* Invisible Touch Overlay Button 2: Pass & Play */}
        <Pressable
          onPress={handlePressPassAndPlay}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn2,
            pressed && styles.touchOverlayPressed,
          ]}
        />

        {/* Invisible Touch Overlay Button 3: Online Multiplayer */}
        <Pressable
          onPress={handlePressOnlineMultiplayer}
          style={({ pressed }) => [
            styles.touchOverlay,
            styles.btn3,
            pressed && styles.touchOverlayPressed,
          ]}
        />
      </ImageBackground>

      {/* Top Header Row with Profile Pill */}
      <View style={styles.topHeaderContainer} pointerEvents="box-none">
        <Pressable
          pointerEvents="auto"
          onPress={handlePressProfile}
          style={({ pressed }) => [
            styles.profilePill,
            pressed && styles.profilePillPressed,
          ]}
        >
          {/* Avatar Circle */}
          <View style={[styles.avatarCircle, { backgroundColor: activeAvatar.bgColor }]}>
            <Text style={styles.avatarEmoji}>{activeAvatar.emoji}</Text>
          </View>

          {/* Nickname */}
          <Text style={styles.profileNickname} numberOfLines={1}>
            {profile?.nickname || 'Player'}
          </Text>

          {/* Divider */}
          <View style={styles.profileDivider} />

          {/* Wins count */}
          <View style={styles.winsBadge}>
            <Text style={styles.winsText}>🏆 {profile?.stats.wins ?? 0}</Text>
          </View>
        </Pressable>
      </View>

      {/* Online Multiplayer Hosting & Joining Modal */}
      <MultiplayerLobbyModal
        visible={isLobbyModalOpen}
        onClose={() => setIsLobbyModalOpen(false)}
        onGameStart={(initialState, myPlayerId, roomCode) => {
          setIsLobbyModalOpen(false);
          onStartOnlineGame(initialState, myPlayerId, roomCode);
        }}
      />

      {/* Profile Editor & Career Stats Modal */}
      {profile && (
        <ProfileModal
          visible={isProfileModalOpen}
          profile={profile}
          onClose={handleCloseProfileModal}
          onSave={handleSaveProfile}
        />
      )}

      {/* Unexpired Active Match Session Recovery Modal */}
      <ResumeMatchModal
        visible={Boolean(pendingResumeSession)}
        session={pendingResumeSession}
        isRejoining={isRejoiningSession}
        onRejoin={handleRejoinSession}
        onAbandon={handleAbandonSession}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topHeaderContainer: {
    position: 'absolute',
    top: Platform.select({
      ios: 52,
      android: (RNStatusBar.currentHeight || 24) + 12,
      default: 20,
    }),
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
    borderWidth: 2.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  profilePillPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 15,
  },
  profileNickname: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#0F172A',
    maxWidth: 110,
    marginRight: 6,
  },
  profileDivider: {
    width: 1.5,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginRight: 6,
  },
  winsBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  winsText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#D97706',
  },
  touchOverlay: {
    position: 'absolute',
    width: '78%',
    height: '8.8%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  touchOverlayPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  btn1: {
    top: '40.8%',
  },
  btn2: {
    top: '53.0%',
  },
  btn3: {
    top: '65.2%',
  },
});
