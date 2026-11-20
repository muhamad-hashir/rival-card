import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModesModal } from '../components/ModesModal';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ProfileModal } from '../components/ProfileModal';
import { ResumeMatchModal } from '../components/ResumeMatchModal';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { SpecialCardsModal } from '../components/SpecialCardsModal';
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

const RIVAL_LOGO = require('../../assets/logo.png');
const BG_PATTERN = require('../../assets/home/bg-pattern.png');
const ICON_CPU = require('../../assets/home/icon-cpu.png');
const ICON_PASSPLAY = require('../../assets/home/icon-passplay.png');
const ICON_ONLINE = require('../../assets/home/icon-online.png');
const ICON_HOWTOPLAY = require('../../assets/home/icon-howtoplay.png');
const ICON_STORE = require('../../assets/home/icon-store.png');
const ICON_SETTINGS = require('../../assets/home/icon-settings.png');
const CORNER_TR = require('../../assets/home/corner-tr.png');
const CORNER_BL = require('../../assets/home/corner-bl.png');
const CORNER_BR = require('../../assets/home/corner-br.png');
const SPARKLE_4PT = require('../../assets/home/sparkle-4pt.png');
const STAR_5PT = require('../../assets/home/star-5pt.png');

const OUTLINE_NAVY = '#0F1142';
const CREAM_BG = '#FFF2D8';

const STROKE_OFFSETS: readonly { dx: number; dy: number }[] = [
  { dx: -1.8, dy: 0 },
  { dx: 1.8, dy: 0 },
  { dx: 0, dy: -1.8 },
  { dx: 0, dy: 1.8 },
  { dx: -1.3, dy: -1.3 },
  { dx: 1.3, dy: -1.3 },
  { dx: -1.3, dy: 1.3 },
  { dx: 1.3, dy: 1.3 },
];

interface OutlinedTextProps {
  children: React.ReactNode;
  style: TextStyle | TextStyle[];
  strokeColor?: string;
  numberOfLines?: number;
}

/**
 * Renders crisp comic-book outlined lettering matching the reference artwork.
 */
const OutlinedText: React.FC<OutlinedTextProps> = ({
  children,
  style,
  strokeColor = OUTLINE_NAVY,
  numberOfLines,
}) => (
  <View style={styles.outlinedTextWrap}>
    {STROKE_OFFSETS.map((offset, idx) => (
      <Text
        key={idx}
        accessible={false}
        importantForAccessibility="no"
        numberOfLines={numberOfLines}
        maxFontSizeMultiplier={1.2}
        style={[
          style,
          styles.outlinedTextStroke,
          {
            color: strokeColor,
            transform: [{ translateX: offset.dx }, { translateY: offset.dy }],
          },
        ]}
      >
        {children}
      </Text>
    ))}
    <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={1.2} style={style}>
      {children}
    </Text>
  </View>
);

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isModesModalOpen, setIsModesModalOpen] = useState(false);
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isSpecialCardsOpen, setIsSpecialCardsOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [pendingResumeSession, setPendingResumeSession] = useState<ActiveMatchSession | null>(null);
  const [isRejoiningSession, setIsRejoiningSession] = useState(false);

  // Subtle idle float on the centerpiece hero logo
  const logoFloatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloatAnim, {
          toValue: -4,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [logoFloatAnim]);

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

  const handlePressVsBot = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsModesModalOpen(true);
  };

  const handlePressPassAndPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onStartOfflineGame('pass_play_2p');
  };

  const handlePressOnlineMultiplayer = async () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    const canProceed = await networkService.ensureOnline('Online Multiplayer');
    if (!canProceed) return;
    setIsLobbyModalOpen(true);
  };

  const handlePressHowToPlay = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsHowToPlayOpen(true);
  };

  const handlePressSpecialCards = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsSpecialCardsOpen(true);
  };

  const handlePressShop = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsShopOpen(true);
  };

  const handlePressSettings = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsSettingsOpen(true);
  };

  const handlePressProfile = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsProfileModalOpen(true);
    playerProfileService.refreshFromCloudIfAuthenticated().then(setProfile).catch(() => {});
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

  // Responsive measurements balanced across compact and tall 20:9 Android screens
  const isCompactHeight = screenHeight < 700;
  const isNarrowWidth = screenWidth < 360;
  const heroLogoWidth = Math.min(screenWidth * 0.76, screenHeight * (isCompactHeight ? 0.27 : 0.30), 312);
  const mainColumnWidth = Math.min(screenWidth * 0.82, 340);
  const pillMinHeight = isCompactHeight ? 58 : 66;
  const pillIconSize = isCompactHeight ? 40 : 46;
  const utilMinHeight = isCompactHeight ? 50 : 56;
  const utilIconSize = isCompactHeight ? 21 : 24;

  const primaryModes = [
    {
      key: 'vs_cpu',
      label: 'PLAY WITH BOT',
      accessibilityLabel: 'Play with Bot',
      icon: ICON_CPU,
      faceColor: '#F6364D',
      lipColor: '#D62738',
      onPress: handlePressVsBot,
    },
    {
      key: 'pass_play',
      label: 'PASS & PLAY',
      accessibilityLabel: 'Pass and Play',
      icon: ICON_PASSPLAY,
      faceColor: '#2CAEF9',
      lipColor: '#1889CD',
      onPress: handlePressPassAndPlay,
    },
    {
      key: 'online',
      label: 'PLAY ONLINE',
      accessibilityLabel: 'Play Online',
      icon: ICON_ONLINE,
      faceColor: '#4ACF72',
      lipColor: '#32B45A',
      onPress: handlePressOnlineMultiplayer,
    },
  ] as const;

  const utilityButtons = [
    {
      key: 'howtoplay',
      testID: 'how-to-play-trigger',
      accessibilityLabel: 'How to Play',
      label: 'HOW TO\nPLAY',
      fontSize: isNarrowWidth ? 9.5 : 10.5,
      lineHeight: isNarrowWidth ? 11 : 12.5,
      icon: ICON_HOWTOPLAY,
      faceColor: '#FFB731',
      lipColor: '#E78427',
      onPress: handlePressHowToPlay,
    },
    {
      key: 'store',
      testID: 'store-trigger',
      accessibilityLabel: 'Store',
      label: 'STORE',
      fontSize: isNarrowWidth ? 10 : 11.5,
      lineHeight: isNarrowWidth ? 12 : 14,
      icon: ICON_STORE,
      faceColor: '#FC856D',
      lipColor: '#DA437A',
      onPress: handlePressShop,
    },
    {
      key: 'settings',
      testID: 'settings-trigger',
      accessibilityLabel: 'Settings',
      label: 'SETTINGS',
      fontSize: isNarrowWidth ? 9.5 : 10.5,
      lineHeight: isNarrowWidth ? 11.5 : 13,
      icon: ICON_SETTINGS,
      faceColor: '#6572E2',
      lipColor: '#464EB9',
      onPress: handlePressSettings,
    },
  ] as const;

  return (
    <View style={styles.container}>
      {/* Full-bleed Warm Parchment Background with Subtle Suit Watermarks */}
      <Image source={BG_PATTERN} style={styles.bgPattern} resizeMode="cover" />

      {/* Outer Navy Comic Frame Border */}
      <View style={styles.frameBorder} pointerEvents="none" />

      {/* Corner Card Clusters & Yellow Sparkles matching homescreen.png */}
      <View style={styles.decorLayer} pointerEvents="none">
        <Image source={CORNER_TR} style={styles.cornerTR} resizeMode="contain" />
        <Image source={CORNER_BL} style={styles.cornerBL} resizeMode="contain" />
        <Image source={CORNER_BR} style={styles.cornerBR} resizeMode="contain" />

        <Image source={STAR_5PT} style={styles.starTopEdge} resizeMode="contain" />
        <Image source={STAR_5PT} style={styles.starMidRight} resizeMode="contain" />
        <Image source={SPARKLE_4PT} style={styles.sparkleMidRight} resizeMode="contain" />
        <Image source={SPARKLE_4PT} style={styles.sparkleLowerLeft} resizeMode="contain" />
        <Image source={SPARKLE_4PT} style={styles.sparkleLowerRight} resizeMode="contain" />
        <Image source={SPARKLE_4PT} style={styles.sparkleBottomLeft} resizeMode="contain" />
        <Image source={SPARKLE_4PT} style={styles.sparkleBottomRight} resizeMode="contain" />
      </View>

      {/* Top Safe-Area HUD Bar: Balanced 2-Row Layout (No Collisions or Clipping) */}
      <View
        style={[
          styles.topHeaderContainer,
          { paddingTop: Math.max(insets.top, 16) },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.headerColumnsRow} pointerEvents="box-none">
          {/* Left Column: Profile Pill + Level/XP Bar */}
          <View style={styles.headerLeftCol} pointerEvents="box-none">
            <Pressable
              pointerEvents="auto"
              hitSlop={6}
              onPress={handlePressProfile}
              style={({ pressed }) => [
                styles.profilePill,
                pressed && styles.headerPillPressed,
              ]}
            >
              <View style={[styles.avatarCircle, { backgroundColor: activeAvatar.bgColor }]}>
                <Text style={styles.avatarEmoji}>{activeAvatar.emoji}</Text>
              </View>
              <Text style={styles.profileNickname} numberOfLines={1}>
                {profile?.nickname || 'Player'}
              </Text>
            </Pressable>

            <Pressable
              pointerEvents="auto"
              hitSlop={6}
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

          {/* Right Column: Special Cards Pill aligned edge-to-edge above Coins & Gems */}
          <View style={styles.headerRightCol} pointerEvents="box-none">
            <Pressable
              pointerEvents="auto"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Special Cards"
              testID="special-cards-trigger"
              onPress={handlePressSpecialCards}
              style={({ pressed }) => [
                styles.specialCardsPill,
                pressed && styles.headerPillPressed,
              ]}
            >
              <Text style={styles.specialCardsIcon}>✨</Text>
              <Text style={styles.specialCardsText}>Special Cards</Text>
            </Pressable>

            <View style={styles.headerCurrencyGroup} pointerEvents="box-none">
              <Pressable
                pointerEvents="auto"
                hitSlop={6}
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

              <Pressable
                pointerEvents="auto"
                hitSlop={6}
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
        </View>
      </View>

      {/* Main Content Stack: Hero Logo -> 3 Pill Mode Buttons -> 3 Bottom Utility Buttons */}
      <View
        style={[
          styles.mainContent,
          {
            paddingBottom: Math.max(insets.bottom + (isCompactHeight ? 42 : 58), isCompactHeight ? 48 : 66),
          },
        ]}
      >
        {/* Centerpiece RIVAL CARD Logo */}
        <View style={styles.heroSlot}>
          <Animated.View
            style={{
              width: heroLogoWidth,
              transform: [{ translateY: logoFloatAnim }],
            }}
          >
            <Image
              source={RIVAL_LOGO}
              style={{
                width: heroLogoWidth,
                height: heroLogoWidth * (802 / 1024),
              }}
              resizeMode="contain"
              accessibilityLabel="Rival Card Logo"
            />
          </Animated.View>
        </View>

        {/* Primary Pill Buttons */}
        <View
          style={[
            styles.modeButtonsStack,
            { width: mainColumnWidth, gap: isCompactHeight ? 10 : 13 },
          ]}
        >
          {primaryModes.map((mode) => (
            <Pressable
              key={mode.key}
              accessibilityRole="button"
              accessibilityLabel={mode.accessibilityLabel}
              onPress={mode.onPress}
              style={({ pressed }) => [
                styles.pillShadowOuter,
                pressed && styles.pillPressed,
              ]}
            >
              <View style={styles.pillNavyOutline}>
                <View
                  style={[
                    styles.pillFace,
                    {
                      backgroundColor: mode.faceColor,
                      borderBottomColor: mode.lipColor,
                      minHeight: pillMinHeight,
                    },
                  ]}
                >
                  <View style={styles.pillTopSheen} pointerEvents="none" />
                  <View style={styles.pillIconBox}>
                    <Image
                      source={mode.icon}
                      style={{ width: pillIconSize, height: pillIconSize }}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.pillLabelCenter}>
                    <OutlinedText
                      numberOfLines={1}
                      style={[
                        styles.pillLabelText,
                        { fontSize: isNarrowWidth ? 19 : screenWidth < 390 ? 21 : 22.5 },
                      ]}
                    >
                      {mode.label}
                    </OutlinedText>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Bottom Utility Dock: How To Play, Store, Settings */}
        <View
          style={[
            styles.utilityRow,
            {
              width: mainColumnWidth,
              marginTop: isCompactHeight ? 14 : 20,
            },
          ]}
        >
          {utilityButtons.map((btn) => (
            <Pressable
              key={btn.key}
              accessibilityRole="button"
              accessibilityLabel={btn.accessibilityLabel}
              testID={btn.testID}
              onPress={btn.onPress}
              style={({ pressed }) => [
                styles.utilShadowOuter,
                pressed && styles.utilPressed,
              ]}
            >
              <View style={styles.utilNavyOutline}>
                <View
                  style={[
                    styles.utilFace,
                    {
                      backgroundColor: btn.faceColor,
                      borderBottomColor: btn.lipColor,
                      minHeight: utilMinHeight,
                    },
                  ]}
                >
                  <View style={styles.utilTopSheen} pointerEvents="none" />
                  <Image
                    source={btn.icon}
                    style={{ width: utilIconSize, height: utilIconSize, marginRight: 4 }}
                    resizeMode="contain"
                  />
                  <OutlinedText
                    style={[
                      styles.utilLabelText,
                      { fontSize: btn.fontSize, lineHeight: btn.lineHeight },
                    ]}
                  >
                    {btn.label}
                  </OutlinedText>
                </View>
              </View>
            </Pressable>
          ))}
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

      {/* Interactive 4-Portion Special Cards Catalogue Modal */}
      <SpecialCardsModal
        visible={isSpecialCardsOpen}
        onClose={() => setIsSpecialCardsOpen(false)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM_BG,
  },
  bgPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  frameBorder: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    borderRadius: 16,
    borderWidth: 3.5,
    borderColor: OUTLINE_NAVY,
    zIndex: 1,
  },
  decorLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: -20,
    right: -18,
    width: 60,
    height: 60,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -12,
    left: -12,
    width: 96,
    height: 88,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 92,
    height: 84,
  },
  starTopEdge: {
    position: 'absolute',
    top: 4,
    right: 76,
    width: 20,
    height: 20,
  },
  starMidRight: {
    position: 'absolute',
    top: 138,
    right: 12,
    width: 22,
    height: 22,
  },
  sparkleMidRight: {
    position: 'absolute',
    top: 118,
    right: 32,
    width: 17,
    height: 17,
  },
  sparkleLowerLeft: {
    position: 'absolute',
    bottom: 124,
    left: 14,
    width: 20,
    height: 20,
  },
  sparkleLowerRight: {
    position: 'absolute',
    bottom: 124,
    right: 14,
    width: 20,
    height: 20,
  },
  sparkleBottomLeft: {
    position: 'absolute',
    bottom: 18,
    left: 96,
    width: 20,
    height: 20,
  },
  sparkleBottomRight: {
    position: 'absolute',
    bottom: 18,
    right: 96,
    width: 20,
    height: 20,
  },

  // Top Header HUD
  topHeaderContainer: {
    width: '100%',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  headerColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeftCol: {
    alignItems: 'flex-start',
    gap: 7,
    flexShrink: 1,
  },
  headerRightCol: {
    alignItems: 'stretch',
    gap: 7,
  },
  specialCardsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
    borderWidth: 2.5,
    borderColor: OUTLINE_NAVY,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
  },
  specialCardsIcon: {
    fontSize: 13.5,
    marginRight: 5,
  },
  specialCardsText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12.5,
    color: '#4C1D95',
    letterSpacing: 0.2,
  },
  headerCurrencyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerPillPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF6E9',
    borderWidth: 2.5,
    borderColor: OUTLINE_NAVY,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: 165,
    flexShrink: 1,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
    borderWidth: 1.5,
    borderColor: OUTLINE_NAVY,
  },
  avatarEmoji: {
    fontSize: 14,
  },
  profileNickname: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: OUTLINE_NAVY,
    flexShrink: 1,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF6E9',
    borderWidth: 2.5,
    borderColor: OUTLINE_NAVY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  levelText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: OUTLINE_NAVY,
    marginRight: 6,
  },
  levelTrack: {
    width: 44,
    height: 7,
    backgroundColor: '#EADBC5',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: OUTLINE_NAVY,
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#4ACF72',
    borderRadius: 999,
  },
  coinPill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: OUTLINE_NAVY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  coinIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  coinText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12.5,
    color: '#78350F',
  },
  gemPill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 2.5,
    borderColor: OUTLINE_NAVY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  gemIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  gemText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12.5,
    color: '#0369A1',
  },

  // Main Vertical Stack
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    zIndex: 5,
  },
  heroSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  modeButtonsStack: {
    alignItems: 'stretch',
  },

  // Pill Mode Buttons (matching homescreen.png)
  pillShadowOuter: {
    borderRadius: 999,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 4,
  },
  pillPressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
  },
  pillNavyOutline: {
    backgroundColor: OUTLINE_NAVY,
    borderRadius: 999,
    padding: 3.5,
  },
  pillFace: {
    borderRadius: 999,
    borderBottomWidth: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pillTopSheen: {
    position: 'absolute',
    top: 3,
    left: 26,
    right: 26,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  pillIconBox: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pillLabelCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
  },
  pillLabelText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  // Bottom Utility Row (HOW TO PLAY, STORE, SETTINGS)
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  utilShadowOuter: {
    flex: 1,
    borderRadius: 18,
    shadowColor: '#8B6D52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 3,
    elevation: 3,
  },
  utilPressed: {
    transform: [{ translateY: 2 }, { scale: 0.97 }],
  },
  utilNavyOutline: {
    backgroundColor: OUTLINE_NAVY,
    borderRadius: 18,
    padding: 3,
  },
  utilFace: {
    borderRadius: 15,
    borderBottomWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  utilTopSheen: {
    position: 'absolute',
    top: 2.5,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  utilLabelText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Comic Outlined Text Helper
  outlinedTextWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinedTextStroke: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
