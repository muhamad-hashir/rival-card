import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModesModal } from '../components/ModesModal';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ProfileModal } from '../components/ProfileModal';
import { ResumeMatchModal } from '../components/ResumeMatchModal';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ShopModal } from '../components/ShopModal';
import { SettingsModal } from '../components/SettingsModal';
import { OnboardingAuthModal } from '../components/OnboardingAuthModal';
import { ErrorToast } from '../components/ErrorToast';
import { authService } from '../services/authService';
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
import { networkService } from '../services/networkService';
import { audioService } from '../services/audioService';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';
import type { GameState } from '../types';

const HOMESCREEN_IMAGE = require('../../assets/homescreen.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_3p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

interface HomeScreenProps {
  onStartOfflineGame: (presetKey: SetupPreset) => void;
  onStartOnlineGame: (
    initialState: GameState,
    myPlayerId: string,
    roomCode: string,
    isQuickMatch?: boolean
  ) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartOfflineGame,
  onStartOnlineGame,
}) => {
  const insets = useSafeAreaInsets();
  const [isModesModalOpen, setIsModesModalOpen] = useState(false);
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [pendingResumeSession, setPendingResumeSession] = useState<ActiveMatchSession | null>(null);
  const [isRejoiningSession, setIsRejoiningSession] = useState(false);

  // Check for unexpired active online match session on initial launch (< 10 minutes old)
  useEffect(() => {
    try {
      audioService.playMenuBgm().catch((err) => {
        console.warn('[Audio] Failed to play menu BGM:', err);
      });
    } catch (err) {
      console.warn('[Audio] Synchronous error starting menu BGM:', err);
    }

    async function checkOnboardingAndSession() {
      try {
        const completed = await authService.isOnboardingCompleted();
        if (!completed) {
          setIsOnboardingOpen(true);
        }
      } catch {
        // ignore
      }

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
    checkOnboardingAndSession();
  }, []);

  const handleRejoinSession = async () => {
    if (!pendingResumeSession || isRejoiningSession) return;
    const canProceed = await networkService.ensureOnline('Rejoining Match');
    if (!canProceed) return;

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

  // Button 1: Play vs Bot (opens ModesModal to select 1v1 vs Bot or 4-Player vs Bots)
  const handlePressVsBot = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsModesModalOpen(true);
  };

  // Button 2: Pass & Play (triggers local 2P mode immediately)
  const handlePressPassAndPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('pass_play_2p');
  };

  // Button 3: Online Multiplayer (opens real-time room lobby modal)
  const handlePressOnlineMultiplayer = async () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    const canProceed = await networkService.ensureOnline('Online Multiplayer');
    if (!canProceed) return;
    setIsLobbyModalOpen(true);
  };

  // Button 4: How to Play (opens interactive book rulebook modal)
  const handlePressHowToPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsHowToPlayOpen(true);
  };

  // Button 5: Store / Shop (opens interactive cosmetics & currency shop)
  const handlePressShop = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsShopOpen(true);
  };

  // Button 6: Settings (opens audio/gameplay toggles & account management)
  const handlePressSettings = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsSettingsOpen(true);
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
    <SafeAreaView style={styles.safeArea}>
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

        {/* Invisible Touch Overlay Row matching illustrated buttons in homescreen.png */}
        <View style={styles.bottomButtonsContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How to Play"
            testID="how-to-play-trigger"
            onPress={handlePressHowToPlay}
            style={({ pressed }) => [
              styles.bottomUtilityBtn,
              pressed && styles.bottomUtilityBtnPressed,
            ]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Store"
            testID="store-trigger"
            onPress={handlePressShop}
            style={({ pressed }) => [
              styles.bottomUtilityBtn,
              pressed && styles.bottomUtilityBtnPressed,
            ]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            testID="settings-trigger"
            onPress={handlePressSettings}
            style={({ pressed }) => [
              styles.bottomUtilityBtn,
              pressed && styles.bottomUtilityBtnPressed,
            ]}
          />
        </View>
      </ImageBackground>

      {/* Top Header Row with Profile Pill, Level Badge, Coins, and Gems */}
      <View style={styles.topHeaderContainer} pointerEvents="box-none">
        {/* Left Cluster: Profile Pill & Level Badge */}
        <View style={styles.headerLeftGroup} pointerEvents="box-none">
          <Pressable
            pointerEvents="auto"
            onPress={handlePressProfile}
            style={({ pressed }) => [
              styles.profilePill,
              pressed && styles.headerPillPressed,
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
          </Pressable>

          {/* Level Badge with Mini XP Progress Bar */}
          <Pressable
            pointerEvents="auto"
            onPress={handlePressProfile}
            style={({ pressed }) => [
              styles.levelPill,
              pressed && styles.headerPillPressed,
            ]}
          >
            <Text style={styles.levelText}>Lv. {profile?.level ?? 1}</Text>
            <View style={styles.levelTrack}>
              <View
                style={[
                  styles.levelFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          ((profile?.currentXp ?? 0) / (profile?.xpToNextLevel || 100)) * 100
                        )
                      )
                    )}%`,
                  },
                ]}
              />
            </View>
          </Pressable>
        </View>

        {/* Right Cluster: Coin & Gem Economy Pills (Opens Shop) */}
        <View style={styles.headerRightGroup} pointerEvents="box-none">
          {/* Coins Pill */}
          <Pressable
            pointerEvents="auto"
            accessibilityRole="button"
            accessibilityLabel="Coins Shop"
            testID="coins-shop-trigger"
            onPress={handlePressShop}
            style={({ pressed }) => [
              styles.coinPill,
              pressed && styles.headerPillPressed,
            ]}
          >
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinText}>{profile?.coins ?? 250}</Text>
          </Pressable>

          {/* Gems Pill */}
          <Pressable
            pointerEvents="auto"
            accessibilityRole="button"
            accessibilityLabel="Gems Shop"
            testID="gems-shop-trigger"
            onPress={handlePressShop}
            style={({ pressed }) => [
              styles.gemPill,
              pressed && styles.headerPillPressed,
            ]}
          >
            <Text style={styles.gemIcon}>💎</Text>
            <Text style={styles.gemText}>{profile?.gems ?? 10}</Text>
          </Pressable>
        </View>
      </View>

      {/* Online Multiplayer Hosting & Joining Modal */}
      <MultiplayerLobbyModal
        visible={isLobbyModalOpen}
        onClose={() => setIsLobbyModalOpen(false)}
        onGameStart={(initialState, myPlayerId, roomCode, isQuickMatch) => {
          setIsLobbyModalOpen(false);
          onStartOnlineGame(initialState, myPlayerId, roomCode, isQuickMatch);
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

      {/* Interactive Book-Style Rulebook Modal */}
      <HowToPlayModal
        visible={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />

      {/* Interactive Cosmetics & Currency Shop Modal */}
      <ShopModal
        visible={isShopOpen}
        onClose={() => setIsShopOpen(false)}
      />

      {/* Interactive Settings Modal */}
      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* First-Launch Onboarding & Auth Modal */}
      <OnboardingAuthModal
        visible={isOnboardingOpen}
        onSuccess={async () => {
          setIsOnboardingOpen(false);
          const p = await playerProfileService.getProfile(true);
          setProfile(p);
        }}
      />

      {/* Game Mode Selector Modal (1v1 vs Bot, 4-Player vs Bots, etc.) */}
      <ModesModal
        visible={isModesModalOpen}
        onClose={() => setIsModesModalOpen(false)}
        onSelectPreset={(preset) => {
          setIsModesModalOpen(false);
          onStartOfflineGame(preset);
        }}
        onOpenMultiplayer={() => {
          setIsModesModalOpen(false);
          setIsLobbyModalOpen(true);
        }}
      />

      {/* Global Error & Disconnection Toast */}
      <ErrorToast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
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
      ios: 14,
      android: 14,
      default: 14,
    }),
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPillPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
    borderWidth: 2.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingVertical: 4,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 14,
  },
  profileNickname: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#0F172A',
    maxWidth: 90,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF6E9',
    borderWidth: 2,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  levelText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#0F172A',
    marginRight: 5,
  },
  levelTrack: {
    width: 28,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 999,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  coinIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  coinText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#92400E',
  },
  gemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  gemIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  gemText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#0369A1',
  },
  touchOverlay: {
    position: 'absolute',
    width: '74%',
    height: '12.6%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 24,
  },
  touchOverlayPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ scale: 0.98 }],
  },
  btn1: {
    top: '40.6%',
  },
  btn2: {
    top: '53.4%',
  },
  btn3: {
    top: '66.2%',
  },
  bottomButtonsContainer: {
    position: 'absolute',
    top: '84.8%',
    height: '8.4%',
    left: '12%',
    right: '12%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    zIndex: 10,
  },
  bottomUtilityBtn: {
    flex: 1,
    marginHorizontal: 3,
    backgroundColor: 'transparent',
    borderRadius: 18,
  },
  bottomUtilityBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ scale: 0.96 }],
  },
});
