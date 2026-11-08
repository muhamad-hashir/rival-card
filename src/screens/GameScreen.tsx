// src/screens/GameScreen.tsx - Main Game Screen for Rival Card with Mobile-Native Polish & Supabase Realtime Multiplayer
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  catchRival,
  chooseWildColor,
  createGame,
  declareRival,
  dismissPrivacyMask,
  getDominantColor,
  hasIdenticalPair,
  hasStackableCard,
  isValidMove,
  isWildCard,
  makeBotMove,
  pickBestBotCard,
  playCard,
  playPairCards,
  playerDrawCard,
  playerPassTurn,
  resolvePendingDraw,
  TURN_DURATION,
} from '../gameEngine';
import { CardView } from '../components/CardView';
import { DraggableCard } from '../components/DraggableCard';
import { ColorPickerModal } from '../components/ColorPickerModal';
import { PrivacyMaskModal } from '../components/PrivacyMaskModal';
import { GameOverModal } from '../components/GameOverModal';
import { LeaveConfirmationModal } from '../components/LeaveConfirmationModal';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ErrorToast } from '../components/ErrorToast';
import { errorToastService } from '../services/errorToastService';
import { ModesModal } from '../components/ModesModal';
import { SettingsModal } from '../components/SettingsModal';
import { TauntBar } from '../components/TauntBar';
import { TurnTimerBadge } from '../components/TurnTimerBadge';
import { FlyingCard, FlyingCardData } from '../components/FlyingCard';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { audioService } from '../services/audioService';
import { playerProfileService, getAvatarConfig, AwardRewardsResult, PlayerProfile } from '../services/playerProfileService';
import { shopService, ShopItem } from '../services/shopService';
import { settingsService, UserSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import {
  multiplayerService,
  TauntMessage,
  saveActiveMatchSession,
  clearActiveMatchSession,
} from '../services/multiplayerService';
import { COLOR_HEX } from '../types';
import type { Card, CardValue, GameMode, GameState, Player, StandardColor } from '../types';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCENIC_BACKGROUND = require('../../assets/background1.png');
const CARD_BACK_IMAGE = require('../../assets/card_back.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_3p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

export { TURN_DURATION };

const PRESETS: Record<
  SetupPreset,
  { name: string; mode: GameMode; players: { id: string; name: string; isBot: boolean }[] }
> = {
  vs_bot_2p: {
    name: '1v1 vs Bot',
    mode: 'vs_bot',
    players: [
      { id: 'p1', name: 'You', isBot: false },
      { id: 'bot1', name: 'RivalBot 🤖', isBot: true },
    ],
  },
  vs_bot_3p: {
    name: '3-Player vs Bots',
    mode: 'vs_bot',
    players: [
      { id: 'p1', name: 'You', isBot: false },
      { id: 'bot1', name: 'CyberBot 🤖', isBot: true },
      { id: 'bot2', name: 'NovaBot 🤖', isBot: true },
    ],
  },
  vs_bot_4p: {
    name: '4-Player vs Bots',
    mode: 'vs_bot',
    players: [
      { id: 'p1', name: 'You', isBot: false },
      { id: 'bot1', name: 'CyberBot 🤖', isBot: true },
      { id: 'bot2', name: 'NovaBot 🤖', isBot: true },
      { id: 'bot3', name: 'EchoBot 🤖', isBot: true },
    ],
  },
  pass_play_2p: {
    name: 'Pass & Play (2P)',
    mode: 'pass_and_play',
    players: [
      { id: 'p1', name: 'Player 1', isBot: false },
      { id: 'p2', name: 'Player 2', isBot: false },
    ],
  },
  pass_play_3p: {
    name: 'Pass & Play (3P)',
    mode: 'pass_and_play',
    players: [
      { id: 'p1', name: 'Player 1', isBot: false },
      { id: 'p2', name: 'Player 2', isBot: false },
      { id: 'p3', name: 'Player 3', isBot: false },
    ],
  },
};

export function getPresetPlayers(
  presetKey: SetupPreset,
  customPlayerName?: string
): { id: string; name: string; isBot: boolean; avatarId?: string }[] {
  const base = PRESETS[presetKey];
  const cached = playerProfileService.getCachedProfile();
  const profileName =
    customPlayerName || cached?.nickname || 'Player';
  const profileAvatar = cached?.avatarId || 'avatar_1';

  return base.players.map((p) => {
    if (p.id === 'p1' && base.mode === 'vs_bot') {
      return { ...p, name: profileName, avatarId: profileAvatar };
    }
    return {
      ...p,
      avatarId: p.isBot ? 'avatar_2' : 'avatar_1',
    };
  });
}

function getCardOverlapMargin(cardCount: number): number {
  if (cardCount <= 1) return 0;
  if (cardCount === 2) return -22;
  if (cardCount === 3) return -27;
  if (cardCount === 4) return -31;
  if (cardCount === 5) return -34;
  if (cardCount <= 7) return -37;
  if (cardCount <= 9) return -40;
  return -42;
}

export interface GameScreenProps {
  initialPresetKey?: SetupPreset;
  initialGameState?: GameState;
  initialOnlineRoomCode?: string | null;
  initialLocalOnlinePlayerId?: string | null;
  isQuickMatch?: boolean;
  onGoHome?: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  initialPresetKey = 'vs_bot_2p',
  initialGameState,
  initialOnlineRoomCode = null,
  initialLocalOnlinePlayerId = null,
  isQuickMatch = false,
  onGoHome,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [currentPresetKey, setCurrentPresetKey] = useState<SetupPreset>(initialPresetKey);
  const [gameState, setGameState] = useState<GameState>(() =>
    initialGameState ||
    createGame(getPresetPlayers(initialPresetKey), PRESETS[initialPresetKey].mode, {
      allowStacking: true,
    })
  );

  // Sound mute state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(soundService.getMuted());

  // Wild Card pending selection
  const [selectedWildCard, setSelectedWildCard] = useState<Card | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // 3-second RIVAL countdown tracking
  const [rivalCountdown, setRivalCountdown] = useState<number | null>(null);
  const rivalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isGameOverRef = useRef(gameState.isGameOver);
  isGameOverRef.current = gameState.isGameOver;

  // Multiplayer Online & Modes states
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [isModesModalOpen, setIsModesModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [onlineRoomCode, setOnlineRoomCode] = useState<string | null>(initialOnlineRoomCode);
  const [localOnlinePlayerId, setLocalOnlinePlayerId] = useState<string | null>(initialLocalOnlinePlayerId);
  const [activeTaunt, setActiveTaunt] = useState<TauntMessage | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [matchRewards, setMatchRewards] = useState<AwardRewardsResult | null>(null);

  // Equipped Cosmetics from Shop
  const [equippedScenery, setEquippedScenery] = useState<ShopItem | null>(null);
  const [equippedCardBack, setEquippedCardBack] = useState<ShopItem | null>(null);

  // User Settings (audio, haptics, fastBots, autoPass)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsService.getSettings().then((s) => {
      setSettings(s);
      setIsAudioMuted(!s.sfxEnabled && !s.bgmEnabled);
    });
    const unsub = settingsService.subscribe((s) => {
      setSettings(s);
      setIsAudioMuted(!s.sfxEnabled && !s.bgmEnabled);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadEquippedCosmetics() {
      try {
        const scenery = await shopService.getEquippedItem('sceneries');
        const cardBack = await shopService.getEquippedItem('card_backs');
        setEquippedScenery(scenery);
        setEquippedCardBack(cardBack);
      } catch {
        // Fallback to default
      }
    }
    loadEquippedCosmetics();

    const unsubscribe = shopService.subscribe(async () => {
      const scenery = await shopService.getEquippedItem('sceneries');
      const cardBack = await shopService.getEquippedItem('card_backs');
      setEquippedScenery(scenery);
      setEquippedCardBack(cardBack);
    });
    return () => unsubscribe();
  }, []);

  // 2.5-second "CATCH RIVAL!" Penalty Window state
  interface CatchPenaltyTarget {
    id: string;
    name: string;
  }
  const [catchPenaltyTarget, setCatchPenaltyTarget] = useState<CatchPenaltyTarget | null>(null);
  const catchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botCatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevHandCountsRef = useRef<Record<string, number>>({});
  const catchPulseAnim = useRef(new Animated.Value(1)).current;

  // Identical Multi-Card Play (Card Stacking / Pair Play Rule) state
  const [pendingPairPlay, setPendingPairPlay] = useState<{ card1: Card; card2: Card } | null>(null);
  const [pendingWildPair, setPendingWildPair] = useState<{ card1: Card; card2: Card } | null>(null);

  // 15-second Network Disconnection Countdown state
  const disconnectCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Quick feedback banner state (e.g., for Pass & Play turn skips)
  const [quickBannerMessage, setQuickBannerMessage] = useState<string | null>(null);
  const quickBannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showQuickBanner = useCallback((message: string, durationMs: number = 3200) => {
    if (quickBannerTimerRef.current) {
      clearTimeout(quickBannerTimerRef.current);
    }
    setQuickBannerMessage(message);
    quickBannerTimerRef.current = setTimeout(() => {
      setQuickBannerMessage(null);
      quickBannerTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (quickBannerTimerRef.current) {
        clearTimeout(quickBannerTimerRef.current);
      }
    };
  }, []);

  // Active flying card animations (deals and draws)
  const [flyingCards, setFlyingCards] = useState<FlyingCardData[]>([]);

  // Dealing phase synchronization (cards appear only as flying card lands)
  const [isDealing, setIsDealing] = useState(true);
  const [dealtCardsCount, setDealtCardsCount] = useState<Record<string, number>>({});

  // Pending penalty cards (cards drawn due to +2 / +4 that haven't landed yet)
  const [pendingPenaltyCount, setPendingPenaltyCount] = useState<Record<string, number>>({});

  // Bot & Human action processing flags
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const [isHumanDrawing, setIsHumanDrawing] = useState(false);

  // Player Profile state for coin badge and display
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(() =>
    playerProfileService.getCachedProfile()
  );

  useEffect(() => {
    playerProfileService.getProfile().then(setPlayerProfile);
    const unsubscribe = playerProfileService.subscribe(setPlayerProfile);
    return () => unsubscribe();
  }, []);

  // Browser testing hook to simulate game ending for verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__triggerGameOver = (winnerId?: string) => {
        setGameState((prev) => ({
          ...prev,
          isGameOver: true,
          winner: prev.players.find((p) => p.id === (winnerId || 'p1')) || prev.players[0],
          players: prev.players.map((p) =>
            p.id === (winnerId || 'p1') ? { ...p, hand: [] } : p
          ),
        }));
      };
      (window as any).__getGameState = () => gameState;
      (window as any).__setIsLeaveModalOpen = (open: boolean) => setIsLeaveModalOpen(open);
      (window as any).__showQuickBanner = (msg: string) => showQuickBanner(msg);
      (window as any).__setIsReconnecting = (val: boolean) => setIsReconnecting(val);
      (window as any).__getIsReconnecting = () => isReconnecting;
      (window as any).__getMatchRewards = () => matchRewards;
      (window as any).__getCatchPenaltyTarget = () => catchPenaltyTarget;
      (window as any).__setCatchPenaltyTarget = (target: CatchPenaltyTarget | null) => setCatchPenaltyTarget(target);
      (window as any).__getPendingPairPlay = () => pendingPairPlay;
    }
  }, [gameState, showQuickBanner, isReconnecting, matchRewards, catchPenaltyTarget, pendingPairPlay]);

  // Cleanup catch timers and network countdown on unmount
  useEffect(() => {
    return () => {
      if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
      if (botCatchTimerRef.current) clearTimeout(botCatchTimerRef.current);
      if (disconnectCountdownRef.current) {
        clearInterval(disconnectCountdownRef.current);
        disconnectCountdownRef.current = null;
      }
      errorToastService.hide();
    };
  }, []);

  // Lock orientation to landscape on mount; revert to portrait on unmount
  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {
        // Fallback for web or devices that don't support locking
      }
    }
    lockLandscape();

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    try {
      audioService.playGameplayBgm().catch(() => {});
    } catch {
      // Audio driver fallback
    }
    return () => {
      try {
        audioService.playMenuBgm().catch(() => {});
      } catch {
        // Audio driver fallback
      }
    };
  }, []);

  // Handle returning to home screen with portrait orientation lock
  const handleExitToHome = async () => {
    try {
      if (disconnectCountdownRef.current) {
        clearInterval(disconnectCountdownRef.current);
        disconnectCountdownRef.current = null;
      }
      errorToastService.hide();
      await clearActiveMatchSession();
      if (isOnlineMode) {
        await multiplayerService.leaveRoom();
      }
      await audioService.playMenuBgm();
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      // Fallback
    }
    onGoHome?.();
  };

  // Trigger Action SFX based on card value or color change
  const triggerCardActionSfx = useCallback((cardValue: CardValue, isColorPicked: boolean = false) => {
    switch (cardValue) {
      case 'wild_draw4':
        audioService.playPlusFourSfx();
        break;
      case 'draw2':
        audioService.playPlusTwoSfx();
        break;
      case 'skip':
        audioService.playSkipSfx();
        break;
      case 'reverse':
        audioService.playReverseSfx();
        break;
      case 'rival_swap':
        audioService.playSwapSfx();
        break;
      case 'mute':
        audioService.playMuteSfx();
        break;
      case 'wild':
        audioService.playColorChangeSfx();
        break;
      default:
        if (isColorPicked) {
          audioService.playColorChangeSfx();
        }
        break;
    }
  }, []);

  const isOnlineMode = gameState.gameMode === 'multiplayer';
  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const discardLen = gameState.discardPile.length;
  const cardMinus2 = discardLen >= 3 ? gameState.discardPile[discardLen - 3] : null;
  const cardMinus1 = discardLen >= 2 ? gameState.discardPile[discardLen - 2] : null;
  const topDiscardCard = gameState.discardPile[discardLen - 1];

  // Hand representation:
  // - In vs_bot mode, the human player's hand is always pinned to the bottom tray.
  // - In online multiplayer, hand cards represent the local player's hand.
  // - In pass_and_play, hand cards represent the current player taking their turn.
  const myPlayer =
    gameState.gameMode === 'vs_bot'
      ? gameState.players.find((p) => !p.isBot) || gameState.players[0]
      : isOnlineMode
      ? gameState.players.find((p) => p.id === localOnlinePlayerId) || currentPlayer
      : currentPlayer;
  const myPlayerAvatar = getAvatarConfig(myPlayer.avatarId);

  // 4-Player & Circular Seating Positions:
  // Bottom (6 O'Clock): myPlayer
  // Left (9 O'Clock): Opponent 1 (3P and 4P)
  // Top (12 O'Clock): Opponent 2 (1v1 and 4P)
  // Right (3 O'Clock): Opponent 3 (3P and 4P)
  const isFourPlayer = gameState.players.length === 4;
  const isThreePlayer = gameState.players.length === 3;
  const isTwoPlayer = gameState.players.length === 2;
  const myPlayerIndex = gameState.players.findIndex((p) => p.id === myPlayer.id);

  const opponentLeft: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 1) % 4]
    : isThreePlayer
    ? gameState.players[(myPlayerIndex + 1) % 3]
    : null;
  const opponentTop: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 2) % 4]
    : isTwoPlayer
    ? gameState.players[(myPlayerIndex + 1) % 2]
    : null;
  const opponentRight: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 3) % 4]
    : isThreePlayer
    ? gameState.players[(myPlayerIndex + 2) % 3]
    : null;

  const isMyTurn = isOnlineMode
    ? currentPlayer.id === localOnlinePlayerId
    : currentPlayer.id === myPlayer.id;
  const isHumanTurn =
    isMyTurn && !gameState.privacyMask.isActive && !gameState.isGameOver && !isReconnecting;

  // Record match result in persistent player profile and award match rewards (XP, Coins, Level Up)
  const hasRecordedResultRef = useRef(false);
  useEffect(() => {
    if (gameState.isGameOver && !hasRecordedResultRef.current) {
      hasRecordedResultRef.current = true;
      clearActiveMatchSession().catch(() => {});
      const isWinner = gameState.winner ? gameState.winner.id === myPlayer.id : false;
      const turns = gameState.turnCount;
      playerProfileService.recordMatchResult(isWinner).catch((err) => {
        console.warn('Failed to record match result:', err);
      });
      // Rewards Balance according to game mode:
      // - Pass & Play & Custom Private Rooms: Completely disabled (0 XP, 0 Coins)
      // - Bot Match (Play vs CPU): Strictly 10% of standard rewards
      // - Online Ranked (Quick Match): 100% full rewards
      let matchType: 'online_ranked' | 'bot' | 'custom_private' | 'pass_and_play' = 'bot';
      if (isOnlineMode) {
        matchType = isQuickMatch ? 'online_ranked' : 'custom_private';
      } else if (gameState.gameMode === 'pass_and_play') {
        matchType = 'pass_and_play';
      } else {
        matchType = 'bot';
      }

      playerProfileService
        .awardMatchRewards(isWinner, turns, matchType)
        .then((rewards) => {
          setMatchRewards(rewards);
        })
        .catch((err) => {
          console.warn('Failed to award match rewards:', err);
        });
    } else if (!gameState.isGameOver) {
      hasRecordedResultRef.current = false;
      setMatchRewards(null);
    }
  }, [gameState.isGameOver, gameState.winner, gameState.turnCount, myPlayer.id, isOnlineMode, isQuickMatch, gameState.gameMode]);

  // Pulsing animation for floating "CATCH RIVAL!" button
  useEffect(() => {
    if (catchPenaltyTarget && catchPenaltyTarget.id !== myPlayer.id) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(catchPulseAnim, {
            toValue: 1.08,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(catchPulseAnim, {
            toValue: 1.0,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => {
        pulseLoop.stop();
        catchPulseAnim.setValue(1);
      };
    } else {
      catchPulseAnim.setValue(1);
    }
  }, [catchPenaltyTarget, myPlayer.id, catchPulseAnim]);

  // Monitor player hand reductions to 1 card and trigger 2.5-second "CATCH RIVAL!" penalty window
  useEffect(() => {
    if (isDealing || gameState.isGameOver) return;

    for (const player of gameState.players) {
      const prevCount = prevHandCountsRef.current[player.id];
      // When a player transitions from 2+ cards down to exactly 1 card without having declared RIVAL
      if (
        prevCount !== undefined &&
        prevCount > 1 &&
        player.hand.length === 1 &&
        !player.hasDeclaredRival
      ) {
        if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
        if (botCatchTimerRef.current) clearTimeout(botCatchTimerRef.current);

        setCatchPenaltyTarget({ id: player.id, name: player.name });

        // 2.5s expiration window
        catchTimerRef.current = setTimeout(() => {
          setCatchPenaltyTarget(null);
          catchTimerRef.current = null;
        }, 2500);

        // If human player dropped to 1 card without calling Rival, bots react with random delay
        if (player.id === myPlayer.id) {
          const activeBots = gameState.players.filter((p) => p.isBot && p.id !== player.id);
          if (activeBots.length > 0) {
            const reactiveBot = activeBots[Math.floor(Math.random() * activeBots.length)];
            const reactionDelay = 1200 + Math.random() * 1000; // 1.2s - 2.2s

            botCatchTimerRef.current = setTimeout(() => {
              // 80% chance for bot to catch human
              if (Math.random() < 0.8) {
                executeCatchPenalty(reactiveBot.id, player.id);
              }
            }, reactionDelay);
          }
        }
      } else if (player.hand.length !== 1 || player.hasDeclaredRival) {
        // If the targeted player is no longer at 1 card or declared Rival, dismiss
        if (catchPenaltyTarget?.id === player.id) {
          if (catchTimerRef.current) {
            clearTimeout(catchTimerRef.current);
            catchTimerRef.current = null;
          }
          if (botCatchTimerRef.current) {
            clearTimeout(botCatchTimerRef.current);
            botCatchTimerRef.current = null;
          }
          setCatchPenaltyTarget(null);
        }
      }
    }

    // Update tracked hand counts
    const newCounts: Record<string, number> = {};
    for (const p of gameState.players) {
      newCounts[p.id] = p.hand.length;
    }
    prevHandCountsRef.current = newCounts;
  }, [gameState.players, isDealing, gameState.isGameOver, myPlayer.id, catchPenaltyTarget]);

  // Cache active online session on mount / room connection
  useEffect(() => {
    if (isOnlineMode && onlineRoomCode && localOnlinePlayerId && !gameState.isGameOver) {
      saveActiveMatchSession(onlineRoomCode, localOnlinePlayerId).catch(() => {});
    }
  }, [isOnlineMode, onlineRoomCode, localOnlinePlayerId, gameState.isGameOver]);

  // Keep human player name and avatar in sync with saved profile in vs_bot mode
  useEffect(() => {
    playerProfileService.getProfile().then((profile) => {
      if (profile?.nickname) {
        setGameState((prev) => {
          if (prev.gameMode !== 'vs_bot') return prev;
          const p1 = prev.players.find((p) => p.id === 'p1');
          if (p1 && (p1.name !== profile.nickname || p1.avatarId !== profile.avatarId)) {
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === 'p1'
                  ? { ...p, name: profile.nickname, avatarId: profile.avatarId || p.avatarId }
                  : p
              ),
            };
          }
          return prev;
        });
      }
    });
  }, []);

  // Keep audio mute state synchronized with persistent settings
  useEffect(() => {
    settingsService.getSettings().then((s) => {
      setIsAudioMuted(!s.sfxEnabled && !s.bgmEnabled);
    });
    const unsubscribe = settingsService.subscribe((s) => {
      setIsAudioMuted(!s.sfxEnabled && !s.bgmEnabled);
    });
    return () => unsubscribe();
  }, []);

  // Toggle Audio (Mute / Unmute both SFX and BGM immediately and persist)
  const handleToggleSound = async () => {
    const currentMute = soundService.getMuted();
    const nextMute = !currentMute;
    soundService.setMuted(nextMute);
    setIsAudioMuted(nextMute);

    if (nextMute) {
      await audioService.pauseBgm();
    } else {
      await audioService.resumeBgm();
    }
    await settingsService.updateSetting('sfxEnabled', !nextMute);
    await settingsService.updateSetting('bgmEnabled', !nextMute);
    hapticsService.cardSnap();
  };

  // Broadcast state changes in multiplayer mode
  const commitGameState = (nextState: GameState, actionDescription: string) => {
    setGameState(nextState);
    if (gameState.gameMode === 'multiplayer') {
      multiplayerService.broadcastGameState(nextState, actionDescription);
    }
  };

  // =========================================================================
  // 15-SECOND TURN TIMER & AFK AUTO-PLAY LOGIC
  // =========================================================================
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(TURN_DURATION);
  const turnTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasExecutedTimeoutRef = useRef<boolean>(false);

  // Conditions that pause the turn countdown
  const isTimerPaused =
    gameState.isGameOver ||
    isDealing ||
    isColorPickerOpen ||
    gameState.pendingColorChoice ||
    gameState.privacyMask.isActive ||
    isLeaveModalOpen ||
    isModesModalOpen ||
    isLobbyModalOpen ||
    isReconnecting;

  // Reset turn timer to 15s whenever the active player turn changes or game deals
  useEffect(() => {
    hasExecutedTimeoutRef.current = false;
    setTurnTimeRemaining(TURN_DURATION);
  }, [gameState.currentTurnIndex, gameState.turnCount, gameState.gameMode, isDealing]);

  // Turn Countdown Interval (ticks every 1s when unpaused)
  useEffect(() => {
    if (isTimerPaused) {
      if (turnTimerIntervalRef.current) {
        clearInterval(turnTimerIntervalRef.current);
        turnTimerIntervalRef.current = null;
      }
      return;
    }

    turnTimerIntervalRef.current = setInterval(() => {
      setTurnTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }

        const next = prev - 1;

        // Audio & Tactile cue: Ticking pulse on last 3 seconds (3, 2, 1) when local human turn
        if (isHumanTurn && (next === 3 || next === 2 || next === 1)) {
          soundService.playCardSnap();
          hapticsService.cardSnap();
        }

        return next;
      });
    }, 1000);

    return () => {
      if (turnTimerIntervalRef.current) {
        clearInterval(turnTimerIntervalRef.current);
        turnTimerIntervalRef.current = null;
      }
    };
  }, [isTimerPaused, isHumanTurn]);

  // AFK Timeout Fallback Action (Auto-Play / Auto-Draw & Pass)
  const handleTimeoutFallback = useCallback(() => {
    if (gameState.isGameOver || isDealing || gameState.privacyMask.isActive) return;

    const timedOutPlayer = gameState.players[gameState.currentTurnIndex];
    if (!timedOutPlayer) return;

    // Online multiplayer synchronization:
    // If it's my turn, I execute and broadcast the timeout action.
    // If it's the other player's turn and I am host, I execute and broadcast so the match never freezes.
    if (isOnlineMode) {
      const isHost = multiplayerService.getMyPlayer()?.isHost ?? false;
      const isMyTurnOnline = currentPlayer.id === localOnlinePlayerId;
      if (!isMyTurnOnline && !isHost) {
        // Guest waiting for host or active player to broadcast
        return;
      }
    }

    // Check if player has any playable cards in hand
    const playableCards = timedOutPlayer.hand.filter((c) =>
      isValidMove(c, topDiscardCard, gameState.activeColor)
    );

    if (playableCards.length > 0) {
      // 1. Playable card exists: Auto-play first valid card
      const cardToPlay = playableCards[0];
      const isWild = isWildCard(cardToPlay);
      const chosenColor = isWild
        ? getDominantColor(timedOutPlayer.hand.filter((c) => c.id !== cardToPlay.id))
        : undefined;

      const nextState = playCard(gameState, timedOutPlayer.id, cardToPlay.id, { chosenColor });
      soundService.playCardSnap();
      hapticsService.cardSnap();
      triggerCardActionSfx(cardToPlay.value, Boolean(chosenColor));
      showQuickBanner(`Time's up! ${timedOutPlayer.name} auto-played.`);
      commitGameState(
        nextState,
        `Time's up! ${timedOutPlayer.name} auto-played ${cardToPlay.color} ${cardToPlay.value}`
      );
    } else {
      // 2. No playable card exists (or player hasn't drawn): Auto-draw and pass turn
      const drawnState = gameState.hasDrawnThisTurn
        ? gameState
        : playerDrawCard(gameState, timedOutPlayer.id);
      const passedState = playerPassTurn(drawnState, timedOutPlayer.id);
      soundService.playCardDraw();
      hapticsService.cardSnap();
      showQuickBanner(`Time's up! ${timedOutPlayer.name} auto-draw passed.`);
      commitGameState(
        passedState,
        `Time's up! ${timedOutPlayer.name} auto-draw passed`
      );
    }
  }, [
    gameState,
    isDealing,
    isOnlineMode,
    currentPlayer.id,
    localOnlinePlayerId,
    topDiscardCard,
    showQuickBanner,
  ]);

  // Watch for Turn Timeout trigger at 0s
  useEffect(() => {
    if (turnTimeRemaining === 0 && !hasExecutedTimeoutRef.current && !isTimerPaused) {
      hasExecutedTimeoutRef.current = true;
      handleTimeoutFallback();
    }
  }, [turnTimeRemaining, isTimerPaused, handleTimeoutFallback]);

  // Browser testing hooks for turn timer and AFK verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setTurnTimer = (secs: number) => setTurnTimeRemaining(secs);
      (window as any).__getTurnTimer = () => turnTimeRemaining;
      (window as any).__triggerTurnTimeout = () => handleTimeoutFallback();
    }
  }, [turnTimeRemaining, handleTimeoutFallback]);

  // Clean up completed flying card and execute its arrival callback
  const handleFlyingCardComplete = useCallback((id: string) => {
    setFlyingCards((prev) => {
      const card = prev.find((c) => c.id === id);
      if (card?.onArrival) {
        card.onArrival();
      }
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  // Launch a flying card animation from Center Table Draw Pile to target clock position
  const triggerFlyingCard = useCallback(
    (target: 'player' | 'opponent' | string, onArrival?: () => void) => {
      const id = `fly_${Date.now()}_${Math.random()}`;
      const screenW = windowWidth || SCREEN_WIDTH;
      const screenH = windowHeight || SCREEN_HEIGHT;
      const startX = screenW * 0.5 - 65; // Draw pile in center table arena
      const startY = screenH * 0.44;

      let targetX = screenW * 0.5;
      let targetY = screenH - 65;
      let targetScale = 1.0;

      if (target === 'player' || target === myPlayer.id) {
        // 6 O'Clock (Bottom Center): User hand
        targetX = screenW * 0.5;
        targetY = screenH - 65;
        targetScale = 1.0;
      } else if ((isFourPlayer || isThreePlayer) && (target === opponentLeft?.id || target === 'left')) {
        // 9 O'Clock (Left Edge): Opponent 1
        targetX = 65;
        targetY = screenH * 0.44;
        targetScale = 0.65;
      } else if ((isFourPlayer || isThreePlayer) && (target === opponentRight?.id || target === 'right')) {
        // 3 O'Clock (Right Edge): Opponent 3
        targetX = screenW - 65;
        targetY = screenH * 0.44;
        targetScale = 0.65;
      } else {
        // 12 O'Clock (Top Center): Opponent 2 or 2P opponent
        targetX = screenW * 0.5;
        targetY = 65;
        targetScale = 0.65;
      }

      setFlyingCards((prev) => [
        ...prev,
        {
          id,
          startX,
          startY,
          targetX,
          targetY,
          duration: 320,
          targetScale,
          onArrival,
        },
      ]);
    },
    [isFourPlayer, isThreePlayer, myPlayer.id, opponentLeft?.id, opponentRight?.id, windowWidth, windowHeight]
  );

  // Rapid sequential card dealing animation at game start: hands start empty and each card reveals on arrival
  const runDealingAnimation = useCallback((initialPlayers: { id: string }[]) => {
    setIsDealing(true);
    const initialCounts: Record<string, number> = {};
    initialPlayers.forEach((p) => {
      initialCounts[p.id] = 0;
    });
    setDealtCardsCount(initialCounts);
    setPendingPenaltyCount({});

    const cardsPerPlayer = 7;
    const totalRounds = cardsPerPlayer * initialPlayers.length;
    let flightIndex = 0;

    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let pIdx = 0; pIdx < initialPlayers.length; pIdx++) {
        const playerId = initialPlayers[pIdx].id;
        const currentFlight = flightIndex++;

        setTimeout(() => {
          triggerFlyingCard(playerId, () => {
            soundService.playCardSnap();
            setDealtCardsCount((prev) => ({
              ...prev,
              [playerId]: (prev[playerId] || 0) + 1,
            }));
          });
        }, currentFlight * 95);
      }
    }

    const totalDuration = totalRounds * 95 + 360;
    setTimeout(() => {
      setIsDealing(false);
    }, totalDuration);
  }, [triggerFlyingCard]);

  // Trigger dealing animation on initial match mount
  useEffect(() => {
    runDealingAnimation(getPresetPlayers(initialPresetKey));
  }, [initialPresetKey, runDealingAnimation]);

  // Restart match with current or new preset
  const handleStartGame = useCallback((presetKey: SetupPreset) => {
    setCurrentPresetKey(presetKey);
    const preset = PRESETS[presetKey];
    const players = getPresetPlayers(presetKey);
    setGameState(createGame(players, preset.mode, { allowStacking: true }));
    setSelectedWildCard(null);
    setIsColorPickerOpen(false);
    setPendingPairPlay(null);
    setPendingWildPair(null);
    setOnlineRoomCode(null);
    setLocalOnlinePlayerId(null);
    setIsBotProcessing(false);
    setIsHumanDrawing(false);
    hapticsService.cardSnap();
    soundService.playCardDraw();
    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
    runDealingAnimation(players);
  }, [runDealingAnimation]);

  // Handle post-game "Play Again" action
  const handlePlayAgain = async () => {
    hapticsService.cardSnap();
    soundService.playCardDraw();
    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
    setSelectedWildCard(null);
    setIsColorPickerOpen(false);
    setPendingPairPlay(null);
    setPendingWildPair(null);
    setIsBotProcessing(false);
    setIsHumanDrawing(false);

    if (isOnlineMode) {
      const playerConfigs = gameState.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
      }));
      const freshState = createGame(playerConfigs, 'multiplayer', { allowStacking: true });
      setGameState(freshState);
      try {
        await multiplayerService.broadcastGameState(freshState, 'Restarted Match');
      } catch (err) {
        console.warn('Failed to broadcast fresh match state:', err);
      }
      runDealingAnimation(playerConfigs);
    } else {
      handleStartGame(currentPresetKey);
    }
  };

  // Handle post-game or header "Quit Room" action
  const handleQuitGame = useCallback(async () => {
    hapticsService.cardSnap();
    if (disconnectCountdownRef.current) {
      clearInterval(disconnectCountdownRef.current);
      disconnectCountdownRef.current = null;
    }
    errorToastService.hide();
    await clearActiveMatchSession();
    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
    setSelectedWildCard(null);
    setIsColorPickerOpen(false);
    setPendingPairPlay(null);
    setPendingWildPair(null);
    setIsBotProcessing(false);
    setIsHumanDrawing(false);

    if (isOnlineMode) {
      try {
        await multiplayerService.leaveRoom();
      } catch (err) {
        console.warn('Error leaving room on quit:', err);
      }
      setOnlineRoomCode(null);
      setLocalOnlinePlayerId(null);
    }
    await handleExitToHome();
  }, [isOnlineMode, handleExitToHome]);

  const stopDisconnectionCountdown = useCallback(() => {
    if (disconnectCountdownRef.current) {
      clearInterval(disconnectCountdownRef.current);
      disconnectCountdownRef.current = null;
    }
    errorToastService.hide();
  }, []);

  const startDisconnectionCountdown = useCallback(() => {
    if (disconnectCountdownRef.current) {
      clearInterval(disconnectCountdownRef.current);
    }
    let remaining = 15;
    errorToastService.show({
      message: `Connection lost! Attempting to reconnect... (${remaining}s)`,
      type: 'warning',
    });

    disconnectCountdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        errorToastService.show({
          message: `Connection lost! Attempting to reconnect... (${remaining}s)`,
          type: 'warning',
        });
      } else {
        if (disconnectCountdownRef.current) {
          clearInterval(disconnectCountdownRef.current);
          disconnectCountdownRef.current = null;
        }
        errorToastService.show({
          message: 'Match disconnected. Return to Main Menu',
          type: 'error',
          action: {
            label: 'Return to Menu',
            onPress: () => {
              errorToastService.hide();
              handleQuitGame();
            },
          },
        });
      }
    }, 1000);
  }, [handleQuitGame]);

  // Online Multiplayer real-time state synchronization listener
  useEffect(() => {
    if (!isOnlineMode) return;

    multiplayerService.setCallbacks({
      onGameStateUpdate: (remoteState, senderId) => {
        stopDisconnectionCountdown();
        if (senderId !== localOnlinePlayerId) {
          const wasGameOver = isGameOverRef.current;
          setGameState(remoteState);
          setIsReconnecting(false);
          if (remoteState.isGameOver) {
            soundService.playWinChime();
            hapticsService.victory();
          } else {
            soundService.playCardSnap();
            hapticsService.cardSnap();
            const topCard = remoteState.discardPile[remoteState.discardPile.length - 1];
            if (topCard) {
              triggerCardActionSfx(topCard.value);
            }
            if (wasGameOver) {
              setSelectedWildCard(null);
              setIsColorPickerOpen(false);
              setPendingPairPlay(null);
              setPendingWildPair(null);
              setRivalCountdown(null);
              runDealingAnimation(remoteState.players);
            }
          }
        }
      },
      onReconnecting: (_attempt) => {
        setIsReconnecting(true);
        startDisconnectionCountdown();
      },
      onReconnected: () => {
        stopDisconnectionCountdown();
        setIsReconnecting(false);
        showQuickBanner('Reconnected to match!');
      },
      onStateSnapshotRequested: (requesterId) => {
        if (isOnlineMode && (multiplayerService.getMyPlayer()?.isHost || myPlayer.id !== requesterId)) {
          multiplayerService.broadcastStateSnapshot(gameState, requesterId);
        }
      },
      onStateSnapshotReceived: (syncedState) => {
        stopDisconnectionCountdown();
        setGameState(syncedState);
        setIsReconnecting(false);
        showQuickBanner('Match state synchronized!');
      },
      onTauntReceived: (taunt) => {
        setActiveTaunt(taunt);
        soundService.playCardSnap();
        hapticsService.cardSelection();
      },
      onPlayerLeft: (_id, name) => {
        Alert.alert('Player Disconnected', `${name} has left the match.`);
      },
      onError: (errMsg) => {
        errorToastService.showError(errMsg);
      },
    });
  }, [
    isOnlineMode,
    localOnlinePlayerId,
    runDealingAnimation,
    gameState,
    myPlayer.id,
    showQuickBanner,
    startDisconnectionCountdown,
    stopDisconnectionCountdown,
  ]);

  // AppState background/foreground resume listener
  useEffect(() => {
    if (!isOnlineMode) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const status = multiplayerService.getConnectionStatus();
        if (status !== 'connected') {
          setIsReconnecting(true);
          multiplayerService.reconnect();
        } else {
          multiplayerService.requestStateSnapshot();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isOnlineMode]);


  // 3-second RIVAL! alert countdown when human player has 1 card without declaring
  useEffect(() => {
    if (
      isHumanTurn &&
      myPlayer.hand.length === 1 &&
      !myPlayer.hasDeclaredRival &&
      rivalCountdown === null
    ) {
      setRivalCountdown(3);
      rivalTimerRef.current = setInterval(() => {
        setRivalCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (rivalTimerRef.current) clearInterval(rivalTimerRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (myPlayer.hand.length !== 1 || myPlayer.hasDeclaredRival) {
      if (rivalTimerRef.current) {
        clearInterval(rivalTimerRef.current);
        rivalTimerRef.current = null;
      }
      setRivalCountdown(null);
    }

    return () => {
      if (rivalTimerRef.current) {
        clearInterval(rivalTimerRef.current);
      }
    };
  }, [myPlayer.hand.length, myPlayer.hasDeclaredRival, isHumanTurn, rivalCountdown]);

  // Automated Bot Turn Handling with organic, casual pacing
  useEffect(() => {
    if (
      isOnlineMode ||
      !currentPlayer.isBot ||
      gameState.isGameOver ||
      gameState.privacyMask.isActive ||
      isDealing ||
      isBotProcessing
    ) {
      return;
    }

    // Step 2: If bot has already drawn this turn, pause to deliberate before playing or passing
    if (gameState.hasDrawnThisTurn) {
      const postDrawDelay = settings.fastBots ? 300 : 800;
      const postDrawTimer = setTimeout(() => {
        setIsBotProcessing(true);
        try {
          const drawnCard = gameState.drawnCard;
          if (drawnCard && isValidMove(drawnCard, topDiscardCard, gameState.activeColor)) {
            const pair = hasIdenticalPair(currentPlayer.hand, drawnCard);
            const playAsPair = Boolean(pair);
            const chosenColor = isWildCard(drawnCard)
              ? getDominantColor(currentPlayer.hand.filter((c) => c.id !== drawnCard.id && (!pair || c.id !== pair.id)))
              : undefined;
            let stateToPlay = gameState;
            const remainingAfter = currentPlayer.hand.length - (playAsPair ? 2 : 1);
            if (remainingAfter === 1 && Math.random() < 0.75) {
              stateToPlay = declareRival(stateToPlay, currentPlayer.id);
            }
            let nextState: GameState;
            if (playAsPair && pair) {
              nextState = playPairCards(stateToPlay, currentPlayer.id, drawnCard.id, pair.id, { chosenColor });
            } else {
              nextState = playCard(stateToPlay, currentPlayer.id, drawnCard.id, { chosenColor });
            }
            soundService.playCardSnap();
            triggerCardActionSfx(drawnCard.value, Boolean(chosenColor));
            commitGameState(nextState, `${currentPlayer.name} played ${drawnCard.value}`);
          } else {
            const nextState = playerPassTurn(gameState, currentPlayer.id);
            soundService.playCardSnap();
            commitGameState(nextState, `${currentPlayer.name} passed turn`);
          }
        } catch (err) {
          console.error('Error during bot post-draw:', err);
        } finally {
          setIsBotProcessing(false);
        }
      }, postDrawDelay);

      return () => clearTimeout(postDrawTimer);
    }

    // Step 1: Initial "thinking" delay so the player clearly sees "RivalBot's turn..."
    const thinkingDelay = settings.fastBots ? 400 : 1400;
    const thinkingTimer = setTimeout(() => {
      setIsBotProcessing(true);
      try {
        let stateForBot = gameState;
        // 1. Opportunistic Catch: Catch any opponent who has 1 card without declaring RIVAL!
        for (const opponent of stateForBot.players) {
          if (opponent.id !== currentPlayer.id && opponent.hand.length === 1 && !opponent.hasDeclaredRival) {
            stateForBot = catchRival(stateForBot, currentPlayer.id, opponent.id);
            break;
          }
        }

        // 2. Active Draw Penalty Stack Defense (+2 / +4 Stacking):
        if ((stateForBot.pendingDrawCount || 0) > 0) {
          const stackableCards = currentPlayer.hand.filter((c) =>
            isValidMove(c, topDiscardCard, stateForBot.activeColor, stateForBot.pendingDrawCount)
          );

          // Bot AI Stacking Logic: Prioritize playing stackable card with ~88% probability
          const shouldStack = stackableCards.length > 0 && Math.random() < 0.88;

          if (shouldStack) {
            const cardToStack = stackableCards[0];
            const identicalPair = hasIdenticalPair(currentPlayer.hand, cardToStack);
            const playAsPair = Boolean(identicalPair);
            const pairCard = identicalPair;

            const remainingAfterPlay = currentPlayer.hand.length - (playAsPair ? 2 : 1);
            if (remainingAfterPlay === 1 && Math.random() < 0.75) {
              stateForBot = declareRival(stateForBot, currentPlayer.id);
            }

            const chosenColor = isWildCard(cardToStack)
              ? getDominantColor(currentPlayer.hand.filter((c) => c.id !== cardToStack.id && (!pairCard || c.id !== pairCard.id)))
              : undefined;

            let nextState: GameState;
            if (playAsPair && pairCard) {
              nextState = playPairCards(stateForBot, currentPlayer.id, cardToStack.id, pairCard.id, { chosenColor });
            } else {
              nextState = playCard(stateForBot, currentPlayer.id, cardToStack.id, { chosenColor });
            }

            // If next player cannot stack, deliver detonated penalty cards
            const targetIndex = nextState.currentTurnIndex;
            const victim = nextState.players[targetIndex];
            if (nextState.pendingDrawCount === 0 && victim) {
              const addedPenalty = playAsPair ? (cardToStack.value === 'draw2' ? 4 : 8) : (cardToStack.value === 'draw2' ? 2 : 4);
              const totalDrawn = (stateForBot.pendingDrawCount || 0) + addedPenalty;
              setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: totalDrawn }));
              for (let i = 0; i < totalDrawn; i++) {
                setTimeout(() => {
                  triggerFlyingCard(victim.id, () => {
                    soundService.playCardSnap();
                    setPendingPenaltyCount((prev) => ({
                      ...prev,
                      [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                    }));
                  });
                }, i * 110);
              }
            }

            soundService.playCardSnap();
            audioService.playPlusTwoSfx();
            soundService.playRivalCallout();
            triggerCardActionSfx(cardToStack.value, Boolean(chosenColor));

            const logMsg = playAsPair && pairCard
              ? `⚡ ${currentPlayer.name} stacked pair of ${cardToStack.value}!`
              : `⚡ ${currentPlayer.name} stacked ${cardToStack.value}!`;
            commitGameState(nextState, logMsg);
            setIsBotProcessing(false);
            return;
          } else {
            // Bot cannot stack or voluntarily accepts penalty
            const count = stateForBot.pendingDrawCount || 1;
            setPendingPenaltyCount((prev) => ({ ...prev, [currentPlayer.id]: count }));
            for (let i = 0; i < count; i++) {
              setTimeout(() => {
                triggerFlyingCard(currentPlayer.id, () => {
                  soundService.playCardSnap();
                  setPendingPenaltyCount((prev) => ({
                    ...prev,
                    [currentPlayer.id]: Math.max(0, (prev[currentPlayer.id] || 1) - 1),
                  }));
                });
              }, i * 110);
            }

            setTimeout(() => {
              try {
                const nextState = resolvePendingDraw(stateForBot, currentPlayer.id);
                soundService.playPenalty();
                commitGameState(nextState, `${currentPlayer.name} took +${count} cards from stack`);
              } catch (err) {
                console.error('Error during bot resolve draw:', err);
              } finally {
                setIsBotProcessing(false);
              }
            }, Math.min(count * 110 + 60, 600));
            return;
          }
        }

        const playableCards = currentPlayer.hand.filter((c) =>
          isValidMove(c, topDiscardCard, stateForBot.activeColor, stateForBot.pendingDrawCount || 0)
        );

        if (playableCards.length > 0) {
          const chosenCard = pickBestBotCard(playableCards, stateForBot, currentPlayer);
          const identicalPair = hasIdenticalPair(currentPlayer.hand, chosenCard);
          const playAsPair = Boolean(identicalPair);
          const pairCard = identicalPair;

          // Pre-declare RIVAL if playing will leave bot with 1 card (with 75% memory rate)
          const remainingAfterPlay = currentPlayer.hand.length - (playAsPair ? 2 : 1);
          if (remainingAfterPlay === 1) {
            const botRemembers = Math.random() < 0.75;
            if (botRemembers) {
              stateForBot = declareRival(stateForBot, currentPlayer.id);
            }
          }

          const chosenColor = isWildCard(chosenCard)
            ? getDominantColor(currentPlayer.hand.filter((c) => c.id !== chosenCard.id && (!pairCard || c.id !== pairCard.id)))
            : undefined;

          // If action card causes draw on victim (+2, +4)
          const targetIndex = (stateForBot.currentTurnIndex + stateForBot.direction + stateForBot.players.length) % stateForBot.players.length;
          const victim = stateForBot.players[targetIndex];
          const isDrawAction = chosenCard.value === 'draw2' || chosenCard.value === 'wild_draw4';
          const canVictimStack = victim && victim.hand.some((c) => c.value === chosenCard.value);

          // Deliver flying cards immediately ONLY if victim cannot stack
          if (isDrawAction && victim && !canVictimStack) {
            let penaltyCards = 0;
            if (chosenCard.value === 'draw2') {
              penaltyCards = playAsPair ? 4 : 2;
            } else if (chosenCard.value === 'wild_draw4') {
              penaltyCards = playAsPair ? 8 : 4;
            }

            if (penaltyCards > 0) {
              setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: penaltyCards }));
              for (let i = 0; i < penaltyCards; i++) {
                setTimeout(() => {
                  triggerFlyingCard(victim.id, () => {
                    soundService.playCardSnap();
                    setPendingPenaltyCount((prev) => ({
                      ...prev,
                      [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                    }));
                  });
                }, i * 110);
              }
            }
          }

          let nextState: GameState;
          if (playAsPair && pairCard) {
            nextState = playPairCards(stateForBot, currentPlayer.id, chosenCard.id, pairCard.id, { chosenColor });
          } else {
            nextState = playCard(stateForBot, currentPlayer.id, chosenCard.id, { chosenColor });
          }

          if (nextState.isGameOver) {
            soundService.playWinChime();
          } else {
            soundService.playCardSnap();
          }
          triggerCardActionSfx(chosenCard.value, Boolean(chosenColor));
          const logMsg = playAsPair && pairCard
            ? `${currentPlayer.name} played pair of ${chosenCard.color} ${chosenCard.value}`
            : `${currentPlayer.name} played ${chosenCard.color} ${chosenCard.value}`;
          commitGameState(nextState, logMsg);
          setIsBotProcessing(false);
        } else {
          // No playable cards: Bot draws from deck!
          // Flying card animates to bot hand, card is committed only upon arrival
          triggerFlyingCard(currentPlayer.id, () => {
            try {
              const nextState = playerDrawCard(stateForBot, currentPlayer.id);
              soundService.playCardSnap();
              commitGameState(nextState, `${currentPlayer.name} drew a card`);
            } catch (err) {
              console.error('Error during bot draw:', err);
            } finally {
              setIsBotProcessing(false);
            }
          });
        }
      } catch (err) {
        console.error('Error during bot move:', err);
        setIsBotProcessing(false);
      }
    }, thinkingDelay);

    return () => clearTimeout(thinkingTimer);
  }, [
    isOnlineMode,
    currentPlayer,
    gameState,
    topDiscardCard,
    isDealing,
    isBotProcessing,
    triggerFlyingCard,
    settings.fastBots,
  ]);

  // Execute Single Card Play
  const executeSinglePlay = (card: Card) => {
    if (!isHumanTurn) return;

    if (card.color === 'wild') {
      hapticsService.cardSnap();
      setSelectedWildCard(card);
      setIsColorPickerOpen(true);
      return;
    }

    // Play standard card
    try {
      if (card.value === 'draw2') {
        const targetIndex = (gameState.currentTurnIndex + gameState.direction + gameState.players.length) % gameState.players.length;
        const victim = gameState.players[targetIndex];
        const isEscalation = (gameState.pendingDrawCount || 0) > 0;
        const totalPenalty = (gameState.pendingDrawCount || 0) + 2;
        const canVictimStack = victim && victim.hand.some((c) => c.value === 'draw2');

        if (victim && !canVictimStack) {
          setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: totalPenalty }));
          for (let i = 0; i < totalPenalty; i++) {
            setTimeout(() => {
              triggerFlyingCard(victim.id, () => {
                soundService.playCardSnap();
                setPendingPenaltyCount((prev) => ({
                  ...prev,
                  [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                }));
              });
            }, i * 110);
          }
        }
        if (isEscalation) {
          audioService.playPlusTwoSfx();
          soundService.playRivalCallout();
          hapticsService.rivalCallout();
        }
      }

      const nextState = playCard(gameState, myPlayer.id, card.id);
      hapticsService.validPlay();

      // In 1v1 Pass & Play mode: If an action card keeps the turn with the player (e.g. Skip, Reverse, Draw 2, Mute),
      // keep their hand active and display a quick feedback banner.
      if (
        gameState.gameMode === 'pass_and_play' &&
        gameState.players.length === 2 &&
        nextState.currentTurnIndex === gameState.currentTurnIndex &&
        !nextState.isGameOver
      ) {
        const opponent = gameState.players.find((p) => p.id !== myPlayer.id);
        const opponentName = opponent ? opponent.name : 'Player 2';
        showQuickBanner(`You skipped ${opponentName}! Take another turn.`);
      }

      if (nextState.isGameOver) {
        hapticsService.victory();
        soundService.playWinChime();
      } else if (card.value === 'draw2' || card.value === 'mute') {
        soundService.playPenalty();
      } else {
        soundService.playCardSnap();
      }
      triggerCardActionSfx(card.value);

      commitGameState(nextState, `${myPlayer.name} played ${card.color} ${card.value}`);
      setPendingPairPlay(null);
    } catch (err: any) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Move Error', err?.message || 'Unable to play card');
    }
  };

  // Execute Pair Play (2 Identical Cards Stacking)
  const executePairPlay = (card1: Card, card2: Card) => {
    if (!isHumanTurn) return;

    if (card1.color === 'wild') {
      hapticsService.cardSnap();
      setPendingWildPair({ card1, card2 });
      setIsColorPickerOpen(true);
      return;
    }

    try {
      if (card1.value === 'draw2') {
        const targetIndex = (gameState.currentTurnIndex + gameState.direction + gameState.players.length) % gameState.players.length;
        const victim = gameState.players[targetIndex];
        const isEscalation = (gameState.pendingDrawCount || 0) > 0;
        const totalPenalty = (gameState.pendingDrawCount || 0) + 4;
        const canVictimStack = victim && victim.hand.some((c) => c.value === 'draw2');

        if (victim && !canVictimStack) {
          setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: totalPenalty }));
          for (let i = 0; i < totalPenalty; i++) {
            setTimeout(() => {
              triggerFlyingCard(victim.id, () => {
                soundService.playCardSnap();
                setPendingPenaltyCount((prev) => ({
                  ...prev,
                  [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                }));
              });
            }, i * 110);
          }
        }
        if (isEscalation) {
          audioService.playPlusTwoSfx();
          soundService.playRivalCallout();
          hapticsService.rivalCallout();
        }
      }

      const nextState = playPairCards(gameState, myPlayer.id, card1.id, card2.id);
      hapticsService.validPlay();

      if (
        gameState.gameMode === 'pass_and_play' &&
        gameState.players.length === 2 &&
        nextState.currentTurnIndex === gameState.currentTurnIndex &&
        !nextState.isGameOver
      ) {
        const opponent = gameState.players.find((p) => p.id !== myPlayer.id);
        const opponentName = opponent ? opponent.name : 'Player 2';
        showQuickBanner(`You skipped ${opponentName}! Take another turn.`);
      }

      if (nextState.isGameOver) {
        hapticsService.victory();
        soundService.playWinChime();
      } else if (card1.value === 'draw2' || card1.value === 'mute') {
        soundService.playPenalty();
      } else {
        soundService.playCardSnap();
      }
      triggerCardActionSfx(card1.value);

      commitGameState(nextState, `${myPlayer.name} played pair of ${card1.color} ${card1.value}`);
      setPendingPairPlay(null);
    } catch (err: any) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Pair Move Error', err?.message || 'Unable to play pair');
    }
  };

  // Card Play Handler (invoked via tap or drag-and-drop)
  const handleCardPress = (card: Card) => {
    if (!isHumanTurn) return;

    if (!isValidMove(card, topDiscardCard, gameState.activeColor)) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert(
        'Invalid Move',
        `This card does not match active color (${gameState.activeColor.toUpperCase()}) or top card (${topDiscardCard.value.toUpperCase()}).`
      );
      return;
    }

    const pair = hasIdenticalPair(myPlayer.hand, card);
    if (pair) {
      if (pendingPairPlay && (pendingPairPlay.card1.id === card.id || pendingPairPlay.card2.id === card.id)) {
        // Tapping currently selected pair card again confirms pair play
        executePairPlay(pendingPairPlay.card1, pendingPairPlay.card2);
        return;
      }
      hapticsService.cardSelection();
      soundService.playCardSnap();
      setPendingPairPlay({ card1: card, card2: pair });
      return;
    }

    setPendingPairPlay(null);
    executeSinglePlay(card);
  };

  // Color Selection for Wild Cards
  const handleSelectWildColor = (color: StandardColor) => {
    setIsColorPickerOpen(false);

    if (pendingWildPair) {
      const pair = pendingWildPair;
      setPendingWildPair(null);
      setPendingPairPlay(null);
      try {
        if (pair.card1.value === 'wild_draw4') {
          const targetIndex = (gameState.currentTurnIndex + gameState.direction + gameState.players.length) % gameState.players.length;
          const victim = gameState.players[targetIndex];
          if (victim) {
            setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: 8 }));
            for (let i = 0; i < 8; i++) {
              setTimeout(() => {
                triggerFlyingCard(victim.id, () => {
                  soundService.playCardSnap();
                  setPendingPenaltyCount((prev) => ({
                    ...prev,
                    [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                  }));
                });
              }, i * 110);
            }
          }
        }

        const nextState = playPairCards(gameState, myPlayer.id, pair.card1.id, pair.card2.id, {
          chosenColor: color,
        });
        hapticsService.validPlay();

        if (
          gameState.gameMode === 'pass_and_play' &&
          gameState.players.length === 2 &&
          nextState.currentTurnIndex === gameState.currentTurnIndex &&
          !nextState.isGameOver
        ) {
          const opponent = gameState.players.find((p) => p.id !== myPlayer.id);
          const opponentName = opponent ? opponent.name : 'Player 2';
          showQuickBanner(`You skipped ${opponentName}! Take another turn.`);
        }

        if (nextState.isGameOver) {
          hapticsService.victory();
          soundService.playWinChime();
        } else if (pair.card1.value === 'wild_draw4' || pair.card1.value === 'mute') {
          soundService.playPenalty();
        } else {
          soundService.playCardSnap();
        }
        triggerCardActionSfx(pair.card1.value, true);

        commitGameState(nextState, `${myPlayer.name} played pair of ${pair.card1.value} (${color})`);
      } catch (err: any) {
        hapticsService.invalidMove();
        soundService.playError();
        Alert.alert('Move Error', err?.message || 'Unable to play wild pair');
      }
      return;
    }

    if (gameState.pendingColorChoice) {
      const nextState = chooseWildColor(gameState, myPlayer.id, color);
      hapticsService.validPlay();
      soundService.playCardSnap();
      audioService.playColorChangeSfx();

      if (
        gameState.gameMode === 'pass_and_play' &&
        gameState.players.length === 2 &&
        nextState.currentTurnIndex === gameState.currentTurnIndex &&
        !nextState.isGameOver
      ) {
        const opponent = gameState.players.find((p) => p.id !== myPlayer.id);
        const opponentName = opponent ? opponent.name : 'Player 2';
        showQuickBanner(`You skipped ${opponentName}! Take another turn.`);
      }

      commitGameState(nextState, `${myPlayer.name} picked ${color}`);
      setSelectedWildCard(null);
      return;
    }

    if (selectedWildCard) {
      try {
        if (selectedWildCard.value === 'wild_draw4') {
          const targetIndex = (gameState.currentTurnIndex + gameState.direction + gameState.players.length) % gameState.players.length;
          const victim = gameState.players[targetIndex];
          const isEscalation = (gameState.pendingDrawCount || 0) > 0;
          const totalPenalty = (gameState.pendingDrawCount || 0) + 4;
          const canVictimStack = victim && victim.hand.some((c) => c.value === 'wild_draw4');

          if (victim && !canVictimStack) {
            setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: totalPenalty }));
            for (let i = 0; i < totalPenalty; i++) {
              setTimeout(() => {
                triggerFlyingCard(victim.id, () => {
                  soundService.playCardSnap();
                  setPendingPenaltyCount((prev) => ({
                    ...prev,
                    [victim.id]: Math.max(0, (prev[victim.id] || 1) - 1),
                  }));
                });
              }, i * 110);
            }
          }
          if (isEscalation) {
            audioService.playPlusFourSfx();
            soundService.playRivalCallout();
            hapticsService.rivalCallout();
          }
        }

        const nextState = playCard(gameState, myPlayer.id, selectedWildCard.id, {
          chosenColor: color,
        });
        hapticsService.validPlay();

        if (
          gameState.gameMode === 'pass_and_play' &&
          gameState.players.length === 2 &&
          nextState.currentTurnIndex === gameState.currentTurnIndex &&
          !nextState.isGameOver
        ) {
          const opponent = gameState.players.find((p) => p.id !== myPlayer.id);
          const opponentName = opponent ? opponent.name : 'Player 2';
          showQuickBanner(`You skipped ${opponentName}! Take another turn.`);
        }

        if (nextState.isGameOver) {
          hapticsService.victory();
          soundService.playWinChime();
        } else if (selectedWildCard.value === 'wild_draw4' || selectedWildCard.value === 'mute') {
          soundService.playPenalty();
        } else {
          soundService.playCardSnap();
        }
        triggerCardActionSfx(selectedWildCard.value, true);

        commitGameState(nextState, `${myPlayer.name} played ${selectedWildCard.value} (${color})`);
      } catch (err: any) {
        hapticsService.invalidMove();
        soundService.playError();
        Alert.alert('Move Error', err?.message || 'Unable to play wild card');
      } finally {
        setSelectedWildCard(null);
      }
    }
  };

  // Take Active Draw Penalty Stack (Voluntary or Forced Draw)
  const handleTakePenaltyStack = () => {
    if (!isHumanTurn || isHumanDrawing || isDealing) return;
    const count = gameState.pendingDrawCount || 0;
    if (count <= 0) return;

    setPendingPairPlay(null);
    setPendingWildPair(null);
    setIsHumanDrawing(true);
    hapticsService.rivalCallout();

    setPendingPenaltyCount((prev) => ({ ...prev, [myPlayer.id]: count }));
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        triggerFlyingCard(myPlayer.id, () => {
          soundService.playCardSnap();
          setPendingPenaltyCount((prev) => ({
            ...prev,
            [myPlayer.id]: Math.max(0, (prev[myPlayer.id] || 1) - 1),
          }));
        });
      }, i * 110);
    }

    setTimeout(() => {
      try {
        const nextState = resolvePendingDraw(gameState, myPlayer.id);
        soundService.playPenalty();
        commitGameState(nextState, `${myPlayer.name} took +${count} cards from stack`);
      } catch (err: any) {
        Alert.alert('Draw Error', err?.message || 'Unable to draw stack penalty');
      } finally {
        setIsHumanDrawing(false);
      }
    }, Math.min(count * 110 + 60, 600));
  };

  // Draw Card from Deck: Spawn flying card and commit to state only upon landing
  const handleDrawCard = () => {
    if (!isHumanTurn || isHumanDrawing || isDealing) return;
    setPendingPairPlay(null);
    setPendingWildPair(null);

    // If facing active draw penalty stack (+2 or +4), voluntarily draw full stack
    if ((gameState.pendingDrawCount || 0) > 0) {
      handleTakePenaltyStack();
      return;
    }

    if (gameState.hasDrawnThisTurn) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Already Drawn', 'You have already drawn a card. Play a card or pass your turn.');
      return;
    }

    setIsHumanDrawing(true);
    hapticsService.cardSnap();
    triggerFlyingCard('player', () => {
      try {
        const nextState = playerDrawCard(gameState, myPlayer.id);
        soundService.playCardSnap();

        const drawnCard = nextState.drawnCard;
        const canPlayDrawn =
          drawnCard && isValidMove(drawnCard, topDiscardCard, nextState.activeColor);

        if (settings.autoPass && !canPlayDrawn) {
          // If autoPass is enabled and the drawn card cannot be played, auto-pass after brief delay
          commitGameState(nextState, `${myPlayer.name} drew a card`);
          setTimeout(() => {
            try {
              const passedState = playerPassTurn(nextState, myPlayer.id);
              soundService.playCardSnap();
              commitGameState(passedState, `${myPlayer.name} passed turn`);
            } catch {
              // ignore if state changed or game over
            }
          }, 450);
        } else {
          commitGameState(nextState, `${myPlayer.name} drew a card`);
        }
      } catch (err: any) {
        Alert.alert('Draw Error', err?.message || 'Unable to draw card');
      } finally {
        setIsHumanDrawing(false);
      }
    });
  };

  // Pass Turn
  const handlePassTurn = () => {
    if (!isHumanTurn) return;
    setPendingPairPlay(null);
    setPendingWildPair(null);

    try {
      const nextState = playerPassTurn(gameState, myPlayer.id);
      hapticsService.cardSnap();
      commitGameState(nextState, `${myPlayer.name} passed turn`);
    } catch (err: any) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Pass Error', err?.message || 'Cannot pass turn right now');
    }
  };

  // Execute Catch Rival penalty (+2 cards draw on careless player)
  const executeCatchPenalty = (accuserPlayerId: string, accusedPlayerId: string) => {
    if (catchTimerRef.current) {
      clearTimeout(catchTimerRef.current);
      catchTimerRef.current = null;
    }
    if (botCatchTimerRef.current) {
      clearTimeout(botCatchTimerRef.current);
      botCatchTimerRef.current = null;
    }
    setCatchPenaltyTarget(null);

    setGameState((current) => {
      const accused = current.players.find((p) => p.id === accusedPlayerId);
      const accuser = current.players.find((p) => p.id === accuserPlayerId);
      if (!accused || accused.hand.length !== 1 || accused.hasDeclaredRival) {
        return current;
      }

      const nextState = catchRival(current, accuserPlayerId, accusedPlayerId);
      hapticsService.rivalCatch();
      soundService.playPenalty();

      // Trigger visual flying penalty cards
      setPendingPenaltyCount((prev) => ({ ...prev, [accusedPlayerId]: 2 }));
      for (let i = 0; i < 2; i++) {
        setTimeout(() => {
          triggerFlyingCard(accusedPlayerId, () => {
            soundService.playCardSnap();
            setPendingPenaltyCount((prev) => ({
              ...prev,
              [accusedPlayerId]: Math.max(0, (prev[accusedPlayerId] || 1) - 1),
            }));
          });
        }, i * 120);
      }

      const accuserName = accuser ? accuser.name : 'Opponent';
      const accusedName = accused ? accused.name : 'Player';
      const toastMsg = `${accuserName} caught ${accusedName}! +2 Cards penalty applied!`;
      showQuickBanner(toastMsg);
      commitGameState(nextState, toastMsg);
      return nextState;
    });
  };

  // Declare RIVAL!
  const handleDeclareRival = () => {
    if (!myPlayer || myPlayer.isBot) return;
    const nextState = declareRival(gameState, myPlayer.id);
    hapticsService.rivalCallout();
    soundService.playRivalCallout();
    audioService.playRivalShout();
    commitGameState(nextState, `${myPlayer.name} declared RIVAL!`);

    if (catchTimerRef.current) {
      clearTimeout(catchTimerRef.current);
      catchTimerRef.current = null;
    }
    if (botCatchTimerRef.current) {
      clearTimeout(botCatchTimerRef.current);
      botCatchTimerRef.current = null;
    }
    setCatchPenaltyTarget(null);

    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
  };

  // Catch Opponent who forgot to declare RIVAL!
  const handleCatchRival = (accusedPlayer: Player) => {
    executeCatchPenalty(myPlayer.id, accusedPlayer.id);
  };

  // Opponents list (all players except local player)
  const opponents = gameState.players.filter((p) => p.id !== myPlayer.id);

  // Helper to render an opponent in horizontal layout (Top Center) or diagonal fan (Left / Right)
  const renderOpponentBox = (opp: Player, layout: 'top' | 'diagonal-left' | 'diagonal-right') => {
    const isOppTurn = gameState.players[gameState.currentTurnIndex].id === opp.id;
    const isCatchable = opp.hand.length === 1 && !opp.hasDeclaredRival;
    const oppVisibleCount = isDealing
      ? (dealtCardsCount[opp.id] ?? 0)
      : pendingPenaltyCount[opp.id]
      ? Math.max(0, opp.hand.length - pendingPenaltyCount[opp.id])
      : opp.hand.length;

    const isSide = layout === 'diagonal-left' || layout === 'diagonal-right';

    if (isSide) {
      const fanCardCount = Math.min(oppVisibleCount, 4);
      const isLeft = layout === 'diagonal-left';
      return (
        <View
          key={opp.id}
          style={[
            styles.sideOpponentCard,
            isOppTurn && styles.opponentCardActive,
          ]}
        >
          {/* Side Opponent Header (Avatar, Name, Count Badge, Muted, Rival) */}
          <View style={styles.sideOpponentInfo}>
            <View
              style={[
                styles.opponentAvatarBadge,
                { backgroundColor: getAvatarConfig(opp.avatarId).bgColor },
              ]}
            >
              <Text style={styles.opponentAvatarEmoji}>
                {getAvatarConfig(opp.avatarId).emoji}
              </Text>
            </View>
            <Text style={styles.sideOpponentName} numberOfLines={1}>
              {opp.name}
            </Text>
            {isOppTurn && !gameState.isGameOver && !isDealing && (
              <View style={styles.miniTurnBadge}>
                <View style={styles.miniTurnDot} />
                <Text style={styles.miniTurnText}>THINKING...</Text>
              </View>
            )}
            {isOppTurn && !gameState.isGameOver && !isDealing && (
              <TurnTimerBadge seconds={turnTimeRemaining} size="compact" />
            )}
            <View
              style={[
                styles.opponentCountBadge,
                oppVisibleCount === 1 && styles.opponentCountBadgeRival,
              ]}
            >
              <Text style={styles.opponentCountBadgeText}>{oppVisibleCount}</Text>
            </View>
            {opp.isMuted && (
              <View style={styles.mutedBadge}>
                <Text style={styles.mutedBadgeText}>🔇</Text>
              </View>
            )}
            {opp.hasDeclaredRival && (
              <View style={styles.rivalDeclaredBadge}>
                <Text style={styles.rivalDeclaredText}>⚡ RIVAL!</Text>
              </View>
            )}
          </View>

          {/* Cards fanned along diagonal */}
          <View style={styles.sideOpponentFanContainer}>
            {fanCardCount > 0 ? (
              Array.from({ length: fanCardCount }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sideCardWrapper,
                    isOppTurn && styles.activeOpponentCardWrapper,
                    {
                      marginTop: idx === 0 ? 0 : -34,
                      marginLeft: isLeft ? idx * 7 : 0,
                      marginRight: !isLeft ? idx * 7 : 0,
                      zIndex: idx + 1,
                      transform: [
                        {
                          rotate: isLeft
                            ? `${(idx - (fanCardCount - 1) / 2) * 8 - 12}deg`
                            : `${(idx - (fanCardCount - 1) / 2) * 8 + 12}deg`,
                        },
                      ],
                    },
                  ]}
                >
                  <CardView
                    isFaceDown
                    size="small"
                    disabled
                    cardBackStyle={equippedCardBack?.previewStyle}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.opponentEmptyText}>{isDealing ? 'Dealing...' : 'Empty'}</Text>
            )}
            {oppVisibleCount > 4 && (
              <View style={styles.sideOverflowPill}>
                <Text style={styles.sideOverflowPillText}>
                  +{oppVisibleCount - 4}
                </Text>
              </View>
            )}
          </View>

          {/* Catch Rival Button */}
          {isCatchable && !gameState.privacyMask.isActive && !gameState.isGameOver && !isDealing && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleCatchRival(opp)}
              style={styles.catchRivalBtn}
            >
              <Text style={styles.catchRivalText}>🚨 CATCH!</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Horizontal Layout for 12 O'Clock (Top Center)
    const fanCardCount = Math.min(oppVisibleCount, 6);
    return (
      <View
        key={opp.id}
        style={[
          styles.opponentCard,
          isOppTurn && styles.opponentCardActive,
          styles.opponentCardSingle,
        ]}
      >
        {/* Opponent Top Row (Avatar, Name, Count Badge, Muted, Rival) */}
        <View style={styles.opponentTopRow}>
          <View
            style={[
              styles.opponentAvatarBadge,
              { backgroundColor: getAvatarConfig(opp.avatarId).bgColor },
            ]}
          >
            <Text style={styles.opponentAvatarEmoji}>
              {getAvatarConfig(opp.avatarId).emoji}
            </Text>
          </View>
          <Text style={styles.opponentName} numberOfLines={1}>
            {opp.name}
          </Text>
          {isOppTurn && !gameState.isGameOver && !isDealing && (
            <View style={styles.miniTurnBadge}>
              <View style={styles.miniTurnDot} />
              <Text style={styles.miniTurnText}>THINKING...</Text>
            </View>
          )}
          {isOppTurn && !gameState.isGameOver && !isDealing && (
            <TurnTimerBadge seconds={turnTimeRemaining} size="compact" />
          )}
          <View
            style={[
              styles.opponentCountBadge,
              oppVisibleCount === 1 && styles.opponentCountBadgeRival,
            ]}
          >
            <Text style={styles.opponentCountBadgeText}>{oppVisibleCount}</Text>
          </View>
          {opp.isMuted && (
            <View style={styles.mutedBadge}>
              <Text style={styles.mutedBadgeText}>🔇</Text>
            </View>
          )}
          {opp.hasDeclaredRival && (
            <View style={styles.rivalDeclaredBadge}>
              <Text style={styles.rivalDeclaredText}>⚡ RIVAL!</Text>
            </View>
          )}
        </View>

        {/* Physical Face-Down Cards Fan Horizontal */}
        <View style={styles.opponentFanContainer}>
          {fanCardCount > 0 ? (
            Array.from({ length: fanCardCount }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.opponentCardWrapper,
                  isOppTurn && styles.activeOpponentCardWrapper,
                  {
                    marginLeft: idx === 0 ? 0 : -22,
                    zIndex: idx + 1,
                    transform: [
                      { rotate: `${(idx - (fanCardCount - 1) / 2) * 4}deg` },
                    ],
                  },
                ]}
              >
                <CardView
                  isFaceDown
                  size="small"
                  disabled
                  cardBackStyle={equippedCardBack?.previewStyle}
                />
              </View>
            ))
          ) : (
            <Text style={styles.opponentEmptyText}>{isDealing ? 'Dealing...' : 'Empty'}</Text>
          )}
          {oppVisibleCount > 6 && (
            <View style={styles.opponentOverflowPill}>
              <Text style={styles.opponentOverflowPillText}>
                +{oppVisibleCount - 6}
              </Text>
            </View>
          )}
        </View>

        {/* Catch Rival Button */}
        {isCatchable && !gameState.privacyMask.isActive && !gameState.isGameOver && !isDealing && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleCatchRival(opp)}
            style={styles.catchRivalBtn}
          >
            <Text style={styles.catchRivalText}>🚨 CATCH!</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Latest game event
  const latestLog = gameState.logs[gameState.logs.length - 1];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={SCENIC_BACKGROUND}
        style={styles.scenicBackground}
        resizeMode="cover"
      >
        <View
          style={[
            styles.scenicOverlay,
            equippedScenery?.previewStyle?.primaryColor
              ? {
                  backgroundColor:
                    equippedScenery.id === 'scenery_midnight'
                      ? 'rgba(15, 23, 42, 0.72)'
                      : equippedScenery.id === 'scenery_royal'
                      ? 'rgba(88, 28, 135, 0.42)'
                      : 'rgba(21, 128, 61, 0.32)',
                }
              : null,
          ]}
        >
          <View style={styles.container}>
            {/* ================================================================= */}
            {/* 1. TOP HEADER & STATUS BAR */}
            {/* ================================================================= */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {Boolean(onGoHome) && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticsService.cardSnap();
                      setIsLeaveModalOpen(true);
                    }}
                    style={styles.leaveHeaderBtn}
                  >
                    <Text style={styles.leaveHeaderIcon}>🏠</Text>
                    <Text style={styles.leaveHeaderText}>Leave</Text>
                  </TouchableOpacity>
                )}

                {/* Skinned Logo Image replacing text header */}
                <Image
                  source={require('../../assets/logo.png')}
                  resizeMode="contain"
                  style={styles.headerLogo}
                />

                {isOnlineMode && onlineRoomCode && (
                  <View style={styles.onlineRoomBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.onlineRoomText}>#{onlineRoomCode}</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerRight}>
                {/* Real-time Quick Taunt Bar Button */}
                <TauntBar
                  activeTaunt={activeTaunt}
                  onSendTaunt={(emoji) => {
                    if (isOnlineMode) {
                      multiplayerService.broadcastTaunt(emoji);
                    }
                    setActiveTaunt({
                      id: Date.now().toString(),
                      emoji,
                      senderId: myPlayer.id,
                      senderName: myPlayer.name,
                      timestamp: Date.now(),
                    });
                  }}
                />

                {/* Audio Toggle */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleToggleSound}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle Audio"
                >
                  <Text style={styles.iconBtnText}>{isAudioMuted ? '🔇' : '🔊'}</Text>
                </TouchableOpacity>

                {/* In-Game Settings Button */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticsService.cardSnap();
                    setIsSettingsOpen(true);
                  }}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <Text style={styles.iconBtnText}>⚙️</Text>
                </TouchableOpacity>
              </View>
            </View>

        {/* ================================================================= */}
        {/* 2. TOP OPPONENT (12 O'CLOCK POSITION) */}
        {/* ================================================================= */}
        {opponentTop && (
          <View style={styles.opponentsSection} pointerEvents="box-none">
            <View style={styles.topOpponentContainer}>
              {renderOpponentBox(opponentTop, 'top')}
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* 3. PLAY ARENA (Left Opponent, Center Table Arena, Right Opponent) */}
        {/* ================================================================= */}
        <View style={styles.arenaSection} pointerEvents="box-none">
          {/* Opponent 1 (Left Edge, Diagonal Fan) */}
          {opponentLeft && (
            <View style={styles.clockPositionLeft}>
              {renderOpponentBox(opponentLeft, 'diagonal-left')}
            </View>
          )}

          {/* Center Table Arena: Discard Pile dead center, Draw Deck top-left, Circular flow arrows */}
          <View
            style={[
              styles.centerTableArena,
              styles.tableFeltMat,
              equippedScenery?.previewStyle?.primaryColor
                ? {
                    backgroundColor:
                      equippedScenery.id === 'scenery_midnight'
                        ? 'rgba(15, 23, 42, 0.65)'
                        : equippedScenery.id === 'scenery_royal'
                        ? 'rgba(88, 28, 135, 0.35)'
                        : 'rgba(21, 128, 61, 0.28)',
                    borderColor:
                      equippedScenery.previewStyle.borderColor || 'rgba(255, 255, 255, 0.2)',
                  }
                : null,
            ]}
          >
            {/* Floating Cartoon Stack Indicator Badge (+2 / +4 Stacking Rule) */}
            {(gameState.pendingDrawCount || 0) > 0 && (
              <View style={styles.floatingStackBadgeContainer} pointerEvents="none">
                <View style={styles.floatingStackBadge}>
                  <Text style={styles.floatingStackIcon}>⚡</Text>
                  <Text style={styles.floatingStackText}>
                    STACK: +{gameState.pendingDrawCount}
                  </Text>
                </View>
              </View>
            )}

            {/* Circular Turn Direction Arrows encircling the center cards */}
            <View
              style={[
                styles.turnDirectionRingContainer,
                { transform: [{ scaleX: gameState.direction === -1 ? -1 : 1 }] },
              ]}
              pointerEvents="none"
            >
              <View style={styles.turnDirectionRing}>
                <View style={styles.flowArrowTop}>
                  <Text style={styles.flowArrowText}>➔</Text>
                </View>
                <View style={styles.flowArrowRight}>
                  <Text style={styles.flowArrowText}>➔</Text>
                </View>
                <View style={styles.flowArrowBottom}>
                  <Text style={styles.flowArrowText}>➔</Text>
                </View>
                <View style={styles.flowArrowLeft}>
                  <Text style={styles.flowArrowText}>➔</Text>
                </View>
              </View>
            </View>

            {/* Draw Deck: Positioned top-left of discard pile with counter badge */}
            <View style={styles.drawDeckAbsoluteAnchor}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDrawCard}
                disabled={!isHumanTurn || gameState.hasDrawnThisTurn}
                style={[
                  styles.deckTouchArea,
                  (!isHumanTurn || gameState.hasDrawnThisTurn) && styles.drawDeckDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Draw Card"
              >
                {/* 3D Physical Stack Layer 2 */}
                {gameState.deck.length > 2 && (
                  <View
                    style={[
                      styles.deckLayerCard,
                      styles.deckLayer2,
                      equippedCardBack?.previewStyle?.primaryColor
                        ? { backgroundColor: equippedCardBack.previewStyle.primaryColor }
                        : null,
                      equippedCardBack?.previewStyle?.borderColor
                        ? { borderColor: equippedCardBack.previewStyle.borderColor }
                        : null,
                    ]}
                  >
                    <Image
                      source={CARD_BACK_IMAGE}
                      style={[
                        styles.drawDeckBackImage,
                        equippedCardBack?.id !== 'card_back_classic' && equippedCardBack?.previewStyle?.primaryColor
                          ? { tintColor: equippedCardBack.previewStyle.primaryColor }
                          : null,
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Top Draw Card */}
                <View
                  style={[
                    styles.drawDeckCard,
                    equippedCardBack?.previewStyle?.primaryColor
                      ? { backgroundColor: equippedCardBack.previewStyle.primaryColor }
                      : null,
                    equippedCardBack?.previewStyle?.borderColor
                      ? { borderColor: equippedCardBack.previewStyle.borderColor }
                      : null,
                  ]}
                >
                  <Image
                    source={CARD_BACK_IMAGE}
                    style={[
                      styles.drawDeckBackImage,
                      equippedCardBack?.id !== 'card_back_classic' && equippedCardBack?.previewStyle?.primaryColor
                        ? { tintColor: equippedCardBack.previewStyle.primaryColor }
                        : null,
                    ]}
                    resizeMode="cover"
                  />
                  <View style={styles.drawDeckBadge}>
                    <Text style={styles.drawDeckCount}>{gameState.deck.length}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Discard Pile: Dead center with clean border/elevation */}
            <View style={styles.discardContainer}>
              {topDiscardCard ? (
                <View style={styles.discardStackContainer}>
                  {cardMinus2 && (
                    <View
                      key={`d2_${cardMinus2.id}`}
                      style={[styles.discardLayerCard, styles.discardLayerMinus2]}
                    >
                      <CardView
                        card={cardMinus2}
                        size="large"
                        disabled
                        isPlayable={false}
                        style={{ opacity: 1 }}
                      />
                    </View>
                  )}
                  {cardMinus1 && (
                    <View
                      key={`d1_${cardMinus1.id}`}
                      style={[styles.discardLayerCard, styles.discardLayerMinus1]}
                    >
                      <CardView
                        card={cardMinus1}
                        size="large"
                        disabled
                        isPlayable={false}
                        style={{ opacity: 1 }}
                      />
                    </View>
                  )}
                  <View
                    key={`top_${topDiscardCard.id}`}
                    style={[styles.discardLayerCard, styles.discardLayerTop]}
                  >
                    <CardView
                      card={topDiscardCard}
                      size="large"
                      disabled
                      isPlayable={false}
                      activeColor={gameState.activeColor}
                      style={{ opacity: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.emptyDiscard}>
                  <Text style={styles.emptyDiscardText}>Empty</Text>
                </View>
              )}
            </View>
          </View>

          {/* Opponent 3 (Right Edge, Diagonal Fan) */}
          {opponentRight && (
            <View style={styles.clockPositionRight}>
              {renderOpponentBox(opponentRight, 'diagonal-right')}
            </View>
          )}
        </View>

        {/* ================================================================= */}
        {/* 4. PLAYER HAND & ACTION CONTROLS */}
        {/* ================================================================= */}
        {(() => {
          const visiblePlayerHand = isDealing
            ? myPlayer.hand.slice(0, dealtCardsCount[myPlayer.id] ?? 0)
            : pendingPenaltyCount[myPlayer.id]
            ? myPlayer.hand.slice(0, Math.max(0, myPlayer.hand.length - pendingPenaltyCount[myPlayer.id]))
            : myPlayer.hand;

          return (
            <View style={styles.playerSection}>
              {/* Player Avatar, Name & Coins pinned to bottom-left */}
              <View
                style={[
                  styles.playerBottomLeftBadge,
                  isMyTurn && !gameState.isGameOver && !isDealing && styles.playerBottomLeftBadgeActive,
                ]}
              >
                <View
                  style={[
                    styles.playerAvatarCircle,
                    { backgroundColor: myPlayerAvatar.bgColor },
                  ]}
                >
                  <Text style={styles.playerAvatarEmoji}>{myPlayerAvatar.emoji}</Text>
                </View>
                <View style={styles.playerInfoColumn}>
                  <View style={styles.playerNameCoinsRow}>
                    <Text style={styles.playerBottomName} numberOfLines={1}>
                      {myPlayer.name === 'You' ? 'You' : myPlayer.name}
                    </Text>
                    <View style={styles.playerCoinBadge}>
                      <Text style={styles.playerCoinIcon}>🪙</Text>
                      <Text style={styles.playerCoinText}>
                        {playerProfile?.coins !== undefined ? playerProfile.coins.toLocaleString() : '0'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.playerCardCountRow}>
                    <Text style={styles.playerCardCountText}>
                      {visiblePlayerHand.length} card{visiblePlayerHand.length === 1 ? '' : 's'}
                    </Text>
                    {isMyTurn && !gameState.isGameOver && !isDealing && (
                      <View style={styles.miniTurnBadge}>
                        <View style={styles.miniTurnDot} />
                        <Text style={styles.miniTurnText}>YOUR TURN</Text>
                      </View>
                    )}
                    {isMyTurn && !gameState.isGameOver && !isDealing && !gameState.privacyMask.isActive && (
                      <TurnTimerBadge seconds={turnTimeRemaining} size="compact" />
                    )}
                  </View>
                </View>
              </View>

              {/* CALL RIVAL! Buzzer button & Pass Turn pinned to bottom-right */}
              <View style={styles.playerBottomRightControls}>
                {/* Pass Turn Button (Available after drawing a card) */}
                {isHumanTurn && gameState.hasDrawnThisTurn && !isDealing && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePassTurn}
                    style={styles.passTurnBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Pass Turn"
                  >
                    <Text style={styles.passTurnBtnText}>Pass ➔</Text>
                  </TouchableOpacity>
                )}

                {/* Large 3D Circular CALL RIVAL! Buzzer Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleDeclareRival}
                  disabled={!isHumanTurn || isDealing}
                  style={[
                    styles.rivalBuzzerBtn,
                    (visiblePlayerHand.length <= 2 || rivalCountdown !== null) && styles.rivalBuzzerActive,
                    (!isHumanTurn || isDealing) && styles.rivalBuzzerDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Call Rival"
                >
                  <View style={styles.rivalBuzzerInner}>
                    <Text style={styles.rivalBuzzerIcon}>⚡</Text>
                    <Text style={styles.rivalBuzzerText}>
                      {rivalCountdown !== null ? `${rivalCountdown}s` : 'RIVAL!'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Dedicated Arcade Action Button: TAKE +X CARDS (Voluntary Draw Option) */}
              {isHumanTurn && !isDealing && !gameState.isGameOver && (gameState.pendingDrawCount || 0) > 0 && !pendingPairPlay && (
                <View style={styles.takePenaltyContainer}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.takePenaltyBtn}
                    onPress={handleTakePenaltyStack}
                    accessibilityRole="button"
                    accessibilityLabel={`Take ${gameState.pendingDrawCount} cards`}
                  >
                    <Text style={styles.takePenaltyIcon}>⚠️</Text>
                    <Text style={styles.takePenaltyText}>
                      TAKE +{gameState.pendingDrawCount} CARDS
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Floating Pair Play Quick-Action Pill */}
              {pendingPairPlay && isHumanTurn && !isDealing && !gameState.isGameOver && (
                <View style={styles.pairPlayPillContainer}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.pairPlayConfirmBtn}
                    onPress={() => executePairPlay(pendingPairPlay.card1, pendingPairPlay.card2)}
                  >
                    <Text style={styles.pairPlayConfirmText}>⚡ Play Pair (x2)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.pairPlaySingleBtn}
                    onPress={() => {
                      const c = pendingPairPlay.card1;
                      setPendingPairPlay(null);
                      executeSinglePlay(c);
                    }}
                  >
                    <Text style={styles.pairPlaySingleText}>Play Single</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.pairPlayDismissBtn}
                    onPress={() => setPendingPairPlay(null)}
                  >
                    <Text style={styles.pairPlayDismissText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Hand anchored to bottom-center with smooth fan overlap */}
              <FlatList
                horizontal
                data={visiblePlayerHand}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.handScrollList,
                  visiblePlayerHand.length <= 7 && styles.handScrollListCentered,
                ]}
                renderItem={({ item, index }) => {
                  const playable =
                    isHumanTurn &&
                    !isDealing &&
                    isValidMove(item, topDiscardCard, gameState.activeColor, gameState.pendingDrawCount || 0);
                  const overlapMargin = index === 0 ? 0 : getCardOverlapMargin(visiblePlayerHand.length);
                  const isPairSelected = Boolean(
                    pendingPairPlay &&
                      (item.id === pendingPairPlay.card1.id || item.id === pendingPairPlay.card2.id)
                  );

                  return (
                    <DraggableCard
                      key={item.id}
                      card={item}
                      isPlayable={playable}
                      disabled={!isHumanTurn || isDealing}
                      isSelected={isPairSelected}
                      zIndex={index + 1}
                      overlapMargin={overlapMargin}
                      onPlay={handleCardPress}
                    />
                  );
                }}
              />
            </View>
          );
        })()}

        {/* Prominent Pulsing Floating "CATCH RIVAL!" Button (2.5s penalty window) */}
        {catchPenaltyTarget &&
          catchPenaltyTarget.id !== myPlayer.id &&
          !gameState.privacyMask.isActive &&
          !gameState.isGameOver &&
          !isDealing && (
            <Animated.View
              style={[
                styles.catchRivalFloatingContainer,
                { transform: [{ scale: catchPulseAnim }] },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => executeCatchPenalty(myPlayer.id, catchPenaltyTarget.id)}
                style={({ pressed }) => [
                  styles.catchRivalFloatingBtn,
                  pressed && styles.catchRivalFloatingBtnPressed,
                ]}
              >
                <Text style={styles.catchRivalFloatingBtnText}>
                  CATCH RIVAL!
                </Text>
              </Pressable>
            </Animated.View>
          )}

        {/* ================================================================= */}
        {/* 5. MODALS */}
        {/* ================================================================= */}
        {/* Color Picker for Wild Cards */}
        <ColorPickerModal
          visible={isColorPickerOpen || gameState.pendingColorChoice}
          cardName={selectedWildCard?.value || gameState.pendingWildCard?.value || 'Wild Card'}
          onSelectColor={handleSelectWildColor}
        />

        {/* Pass and Play Privacy Shield */}
        <PrivacyMaskModal
          visible={gameState.privacyMask.isActive}
          targetPlayerName={gameState.privacyMask.targetPlayerName}
          onDismiss={() => {
            hapticsService.cardSnap();
            setGameState((prev) => dismissPrivacyMask(prev));
          }}
        />

        {/* Multiplayer Lobby Modal */}
        <MultiplayerLobbyModal
          visible={isLobbyModalOpen}
          onClose={() => setIsLobbyModalOpen(false)}
          onGameStart={(initialState, playerId, roomCode) => {
            setGameState(initialState);
            setLocalOnlinePlayerId(playerId);
            setOnlineRoomCode(roomCode);
            setIsLobbyModalOpen(false);
          }}
        />

        {/* Modes Selection Modal */}
        <ModesModal
          visible={isModesModalOpen}
          onClose={() => setIsModesModalOpen(false)}
          onSelectPreset={(preset) => handleStartGame(preset)}
          onOpenMultiplayer={() => setIsLobbyModalOpen(true)}
          onGoHome={handleExitToHome}
        />

        {/* Game Over Victory Screen */}
        <GameOverModal
          visible={gameState.isGameOver}
          winner={gameState.winner}
          turnCount={gameState.turnCount}
          players={gameState.players}
          localPlayerId={myPlayer.id}
          mode={isOnlineMode ? 'online' : gameState.gameMode === 'vs_bot' ? 'bot' : 'pass_and_play'}
          gameMode={gameState.gameMode}
          isOnlineMode={isOnlineMode}
          matchRewards={matchRewards}
          onPlayAgain={handlePlayAgain}
          onQuitRoom={handleQuitGame}
          onPlayWithMoreBots={() => handleStartGame('vs_bot_4p')}
          onPlay1v1={() => handleStartGame('vs_bot_2p')}
          onSelectPreset={(preset) => handleStartGame(preset)}
          onMainMenu={handleExitToHome}
        />

        {/* Styled In-Game Leave Confirmation Modal */}
        <LeaveConfirmationModal
          visible={isLeaveModalOpen}
          isOnlineMode={isOnlineMode}
          onCancel={() => {
            hapticsService.cardSnap();
            setIsLeaveModalOpen(false);
          }}
          onConfirmLeave={async () => {
            setIsLeaveModalOpen(false);
            await handleQuitGame();
          }}
        />

        {/* In-Game Settings Modal */}
        <SettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        {/* Network Reconnecting Amber Banner */}
        {isReconnecting && isOnlineMode && (
          <View style={styles.reconnectingBannerOverlay} pointerEvents="none">
            <View style={styles.reconnectingBannerBadge}>
              <ActivityIndicator size="small" color="#B45309" />
              <Text style={styles.reconnectingBannerText}>Reconnecting to match...</Text>
            </View>
          </View>
        )}

        {/* Quick Feedback Banner Overlay */}
        {Boolean(quickBannerMessage) && (
          <View style={styles.quickBannerOverlay} pointerEvents="none">
            <View style={styles.quickBannerBadge}>
              <Text style={styles.quickBannerIcon}>⊘</Text>
              <Text style={styles.quickBannerText}>{quickBannerMessage}</Text>
            </View>
          </View>
        )}

        {/* Active Flying Cards Overlay */}
        {flyingCards.map((card) => (
          <FlyingCard
            key={card.id}
            {...card}
            onComplete={handleFlyingCardComplete}
          />
        ))}

        {/* Global Error & Network Toast Notification Banner */}
        <ErrorToast />
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scenicBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scenicOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 4,
    marginRight: 10,
  },
  leaveHeaderIcon: {
    fontSize: 13,
  },
  leaveHeaderText: {
    ...FONT_CARTOON_BOLD,
    color: '#F8FAFC',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  reconnectingBannerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  reconnectingBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  reconnectingBannerText: {
    ...FONT_CARTOON_BOLD,
    color: '#92400E',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  quickBannerOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  quickBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  quickBannerIcon: {
    fontSize: 16,
    color: '#38BDF8',
  },
  quickBannerText: {
    ...FONT_CARTOON_BOLD,
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  homeIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  homeIconBtnText: {
    fontSize: 15,
  },
  headerLogo: {
    width: 110,
    height: 32,
  },
  onlineRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginRight: 5,
  },
  onlineRoomText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    fontSize: 13,
  },
  turnStatusBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 15,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  turnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  activeColorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeColorLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  activeColorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  activeColorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  opponentsSection: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
    backgroundColor: 'transparent',
  },
  topOpponentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  opponentsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  opponentsScrollCentered: {
    minWidth: '100%',
    justifyContent: 'center',
  },
  opponentCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 3,
    minWidth: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  opponentCardSingle: {
    minWidth: 115,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  opponentCardActive: {
    borderColor: '#10B981',
    borderWidth: 2.5,
    backgroundColor: 'rgba(6, 95, 70, 0.55)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 6,
  },
  opponentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
    justifyContent: 'center',
  },
  opponentAvatarBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  opponentAvatarEmoji: {
    fontSize: 11,
  },
  opponentName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 75,
  },
  opponentCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  opponentCountBadgeRival: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
  },
  opponentCountBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  mutedBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mutedBadgeText: {
    fontSize: 9,
  },
  opponentFanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    minHeight: 38,
    marginTop: -3,
  },
  opponentCardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  activeOpponentCardWrapper: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 6,
  },
  opponentOverflowPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  opponentOverflowPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  opponentEmptyText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
    paddingVertical: 8,
  },
  rivalDeclaredBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rivalDeclaredText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#B45309',
  },
  catchRivalBtn: {
    marginTop: 4,
    backgroundColor: '#EF4444',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  catchRivalText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arenaSection: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginTop: 0,
    zIndex: 10,
  },
  arenaSectionCentered: {
    justifyContent: 'center',
  },
  clockPositionLeft: {
    position: 'absolute',
    left: 14,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 15,
  },
  clockPositionRight: {
    position: 'absolute',
    right: 14,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 15,
  },
  sideOpponentCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 4,
    width: 82,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
    alignItems: 'center',
    zIndex: 15,
  },
  sideOpponentInfo: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  sideOpponentName: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 72,
    textAlign: 'center',
  },
  sideOpponentFanContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    minHeight: 50,
  },
  sideCardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  sideOverflowPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
  },
  sideOverflowPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  centerTableArena: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 154,
    transform: [{ translateX: -110 }, { translateY: -77 }],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'visible',
  },
  tableFeltMat: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    overflow: 'visible',
  },
  turnDirectionRingContainer: {
    position: 'absolute',
    width: 220,
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  turnDirectionRing: {
    width: 206,
    height: 144,
    borderRadius: 72,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderStyle: 'dashed',
    position: 'relative',
  },
  flowArrowTop: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  flowArrowRight: {
    position: 'absolute',
    right: -9,
    top: '50%',
    marginTop: -9,
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  flowArrowBottom: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  flowArrowLeft: {
    position: 'absolute',
    left: -9,
    top: '50%',
    marginTop: -9,
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '270deg' }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  flowArrowText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  drawDeckAbsoluteAnchor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -98,
    marginTop: -46,
    transform: [{ rotate: '-4deg' }],
    zIndex: 15,
  },
  deckTouchArea: {
    position: 'relative',
    width: 63,
    height: 92,
  },
  deckLayerCard: {
    position: 'absolute',
    width: 63,
    height: 92,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  deckLayer2: {
    top: -2.5,
    left: -2.5,
    zIndex: 2,
    opacity: 0.9,
  },
  drawDeckCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 63,
    height: 92,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  drawDeckDisabled: {
    opacity: 0.7,
  },
  drawDeckBackImage: {
    width: '100%',
    height: '100%',
  },
  drawDeckBadge: {
    position: 'absolute',
    bottom: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  drawDeckCount: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
  },
  discardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    overflow: 'visible',
  },
  discardStackContainer: {
    width: 78,
    height: 114,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 8,
  },
  discardLayerCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 78,
    height: 114,
  },
  discardLayerMinus2: {
    zIndex: 1,
    opacity: 0.88,
    transform: [{ rotate: '-7deg' }, { translateX: -5 }, { translateY: 2 }],
  },
  discardLayerMinus1: {
    zIndex: 2,
    opacity: 0.95,
    transform: [{ rotate: '5deg' }, { translateX: 5 }, { translateY: -3 }],
  },
  discardLayerTop: {
    zIndex: 3,
    transform: [{ rotate: '-1deg' }],
  },
  emptyDiscard: {
    width: 78,
    height: 114,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDiscardText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  playerSection: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
    zIndex: 20,
    position: 'relative',
    minHeight: 94,
    justifyContent: 'flex-end',
  },
  playerBottomLeftBadge: {
    position: 'absolute',
    bottom: 2,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 18,
    paddingVertical: 4,
    paddingHorizontal: 7,
    gap: 6,
    zIndex: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  playerBottomLeftBadgeActive: {
    borderColor: '#10B981',
    borderWidth: 2.5,
    backgroundColor: 'rgba(6, 95, 70, 0.75)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  miniTurnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    gap: 3,
  },
  miniTurnDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  miniTurnText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.4,
  },
  playerAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  playerAvatarEmoji: {
    fontSize: 14,
  },
  playerInfoColumn: {
    justifyContent: 'center',
  },
  playerNameCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerBottomName: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#FFFFFF',
    maxWidth: 80,
  },
  playerCoinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    gap: 2,
  },
  playerCoinIcon: {
    fontSize: 9,
  },
  playerCoinText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 9.5,
    color: '#92400E',
  },
  playerCardCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerCardCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  playerBottomRightControls: {
    position: 'absolute',
    bottom: 2,
    right: 8,
    alignItems: 'center',
    gap: 5,
    zIndex: 35,
  },
  rivalBuzzerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF4444',
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B91C1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  rivalBuzzerActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#B45309',
    shadowColor: '#F59E0B',
    transform: [{ scale: 1.05 }],
  },
  rivalBuzzerDisabled: {
    opacity: 0.75,
  },
  rivalBuzzerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rivalBuzzerIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  rivalBuzzerText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  passTurnBtn: {
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  passTurnBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#FFFFFF',
  },
  handScrollList: {
    paddingLeft: 96,
    paddingRight: 84,
    paddingTop: 2,
    paddingBottom: 0,
    alignItems: 'center',
  },
  handScrollListCentered: {
    minWidth: '100%',
    justifyContent: 'center',
  },
  catchRivalFloatingContainer: {
    position: 'absolute',
    bottom: 78,
    alignSelf: 'center',
    zIndex: 99,
  },
  catchRivalFloatingBtn: {
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#B91C1C',
    borderBottomWidth: 4,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  catchRivalFloatingBtnPressed: {
    transform: [{ scale: 0.95 }],
    borderBottomWidth: 1,
    marginTop: 3,
  },
  catchRivalFloatingBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 1,
  },
  pairPlayPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFDF7',
    borderWidth: 2.5,
    borderColor: '#E2D9C8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 100,
  },
  pairPlayConfirmBtn: {
    backgroundColor: '#F59E0B',
    borderBottomWidth: 3,
    borderBottomColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pairPlayConfirmText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#FFFFFF',
  },
  pairPlaySingleBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderBottomWidth: 3,
    borderBottomColor: '#94A3B8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pairPlaySingleText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#334155',
  },
  pairPlayDismissBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  pairPlayDismissText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#94A3B8',
  },
  floatingStackBadgeContainer: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  floatingStackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#FEF08A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 9,
  },
  floatingStackIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  floatingStackText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textShadowColor: '#7F1D1D',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  takePenaltyContainer: {
    position: 'absolute',
    top: -46,
    alignSelf: 'center',
    zIndex: 55,
  },
  takePenaltyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#FEF08A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 10,
  },
  takePenaltyIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  takePenaltyText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textShadowColor: '#7F1D1D',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
});
