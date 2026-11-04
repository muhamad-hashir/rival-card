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
  isValidMove,
  isWildCard,
  makeBotMove,
  pickBestBotCard,
  playCard,
  playerDrawCard,
  playerPassTurn,
  TURN_DURATION,
} from '../gameEngine';
import { CardView } from '../components/CardView';
import { DraggableCard } from '../components/DraggableCard';
import { ColorPickerModal } from '../components/ColorPickerModal';
import { PrivacyMaskModal } from '../components/PrivacyMaskModal';
import { GameOverModal } from '../components/GameOverModal';
import { LeaveConfirmationModal } from '../components/LeaveConfirmationModal';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ModesModal } from '../components/ModesModal';
import { TauntBar } from '../components/TauntBar';
import { TurnTimerBadge } from '../components/TurnTimerBadge';
import { FlyingCard, FlyingCardData } from '../components/FlyingCard';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { playerProfileService, getAvatarConfig, AwardRewardsResult } from '../services/playerProfileService';
import { shopService, ShopItem } from '../services/shopService';
import {
  multiplayerService,
  TauntMessage,
  saveActiveMatchSession,
  clearActiveMatchSession,
} from '../services/multiplayerService';
import { COLOR_HEX } from '../types';
import type { Card, GameMode, GameState, Player, StandardColor } from '../types';
import { FONT_CARTOON_BOLD, FONT_CARTOON_HEAVY } from '../styles/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCENIC_BACKGROUND = require('../../assets/background1.png');
const CARD_BACK_IMAGE = require('../../assets/card_back.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

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
  if (cardCount === 2) return -26;
  if (cardCount === 3) return -32;
  if (cardCount === 4) return -36;
  if (cardCount === 5) return -39;
  if (cardCount <= 7) return -42;
  if (cardCount <= 9) return -45;
  return -48;
}

export interface GameScreenProps {
  initialPresetKey?: SetupPreset;
  initialGameState?: GameState;
  initialOnlineRoomCode?: string | null;
  initialLocalOnlinePlayerId?: string | null;
  onGoHome?: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  initialPresetKey = 'vs_bot_2p',
  initialGameState,
  initialOnlineRoomCode = null,
  initialLocalOnlinePlayerId = null,
  onGoHome,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [currentPresetKey, setCurrentPresetKey] = useState<SetupPreset>(initialPresetKey);
  const [gameState, setGameState] = useState<GameState>(() =>
    initialGameState ||
    createGame(getPresetPlayers(initialPresetKey), PRESETS[initialPresetKey].mode)
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
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [onlineRoomCode, setOnlineRoomCode] = useState<string | null>(initialOnlineRoomCode);
  const [localOnlinePlayerId, setLocalOnlinePlayerId] = useState<string | null>(initialLocalOnlinePlayerId);
  const [activeTaunt, setActiveTaunt] = useState<TauntMessage | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [matchRewards, setMatchRewards] = useState<AwardRewardsResult | null>(null);

  // Equipped Cosmetics from Shop
  const [equippedScenery, setEquippedScenery] = useState<ShopItem | null>(null);
  const [equippedCardBack, setEquippedCardBack] = useState<ShopItem | null>(null);

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
    }
  }, [gameState, showQuickBanner, isReconnecting, matchRewards, catchPenaltyTarget]);

  // Cleanup catch timers on unmount
  useEffect(() => {
    return () => {
      if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
      if (botCatchTimerRef.current) clearTimeout(botCatchTimerRef.current);
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

  // Handle returning to home screen with portrait orientation lock
  const handleExitToHome = async () => {
    try {
      await clearActiveMatchSession();
      if (isOnlineMode) {
        await multiplayerService.leaveRoom();
      }
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      // Fallback
    }
    onGoHome?.();
  };

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

  // 4-Player Clock Seating Positions:
  // 6 O'Clock: myPlayer (Bottom)
  // 9 O'Clock: Opponent 1 (Left Edge, e.g., CyberBot)
  // 12 O'Clock: Opponent 2 (Top Center, e.g., NovaBot)
  // 3 O'Clock: Opponent 3 (Right Edge, e.g., EchoBot)
  // In 2-Player matches, Opponent 1 is centered at 12 O'Clock.
  const isFourPlayer = gameState.players.length === 4;
  const myPlayerIndex = gameState.players.findIndex((p) => p.id === myPlayer.id);

  const opponentLeft: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 1) % 4]
    : null;
  const opponentTop: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 2) % 4]
    : gameState.players.length === 2
    ? gameState.players[(myPlayerIndex + 1) % 2]
    : null;
  const opponentRight: Player | null = isFourPlayer
    ? gameState.players[(myPlayerIndex + 3) % 4]
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
      playerProfileService
        .awardMatchRewards(isWinner, turns)
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
  }, [gameState.isGameOver, gameState.winner, gameState.turnCount, myPlayer.id]);

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

  // Toggle Audio
  const handleToggleSound = () => {
    const newMute = soundService.toggleMute();
    setIsAudioMuted(newMute);
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
      } else if (isFourPlayer && (target === opponentLeft?.id || target === 'left')) {
        // 9 O'Clock (Left Edge): Opponent 1
        targetX = 65;
        targetY = screenH * 0.44;
        targetScale = 0.65;
      } else if (isFourPlayer && (target === opponentRight?.id || target === 'right')) {
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
    [isFourPlayer, myPlayer.id, opponentLeft?.id, opponentRight?.id, windowWidth, windowHeight]
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
    setGameState(createGame(players, preset.mode));
    setSelectedWildCard(null);
    setIsColorPickerOpen(false);
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

  // Online Multiplayer real-time state synchronization listener
  useEffect(() => {
    if (!isOnlineMode) return;

    multiplayerService.setCallbacks({
      onGameStateUpdate: (remoteState, senderId) => {
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
            if (wasGameOver) {
              setSelectedWildCard(null);
              setIsColorPickerOpen(false);
              setRivalCountdown(null);
              runDealingAnimation(remoteState.players);
            }
          }
        }
      },
      onReconnecting: (_attempt) => {
        setIsReconnecting(true);
      },
      onReconnected: () => {
        setIsReconnecting(false);
        showQuickBanner('Reconnected to match!');
      },
      onStateSnapshotRequested: (requesterId) => {
        if (isOnlineMode && (multiplayerService.getMyPlayer()?.isHost || myPlayer.id !== requesterId)) {
          multiplayerService.broadcastStateSnapshot(gameState, requesterId);
        }
      },
      onStateSnapshotReceived: (syncedState) => {
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
    });
  }, [
    isOnlineMode,
    localOnlinePlayerId,
    runDealingAnimation,
    gameState,
    myPlayer.id,
    showQuickBanner,
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
    setIsBotProcessing(false);
    setIsHumanDrawing(false);

    if (isOnlineMode) {
      const playerConfigs = gameState.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: false,
      }));
      const freshState = createGame(playerConfigs, 'multiplayer');
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
  const handleQuitGame = async () => {
    hapticsService.cardSnap();
    await clearActiveMatchSession();
    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
    setSelectedWildCard(null);
    setIsColorPickerOpen(false);
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
  };

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

    // Step 2: If bot has already drawn this turn, pause 800ms to deliberate before playing or passing
    if (gameState.hasDrawnThisTurn) {
      const postDrawTimer = setTimeout(() => {
        setIsBotProcessing(true);
        try {
          const drawnCard = gameState.drawnCard;
          if (drawnCard && isValidMove(drawnCard, topDiscardCard, gameState.activeColor)) {
            const chosenColor = isWildCard(drawnCard)
              ? getDominantColor(currentPlayer.hand.filter((c) => c.id !== drawnCard.id))
              : undefined;
            let stateToPlay = gameState;
            if (currentPlayer.hand.length === 2 && Math.random() < 0.75) {
              stateToPlay = declareRival(stateToPlay, currentPlayer.id);
            }
            const nextState = playCard(stateToPlay, currentPlayer.id, drawnCard.id, { chosenColor });
            soundService.playCardSnap();
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
      }, 800);

      return () => clearTimeout(postDrawTimer);
    }

    // Step 1: Initial "thinking" delay (1400ms) so the player clearly sees "RivalBot's turn..."
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

        const playableCards = currentPlayer.hand.filter((c) =>
          isValidMove(c, topDiscardCard, stateForBot.activeColor)
        );

        // Pre-declare RIVAL if playing second-to-last card (with 75% memory rate)
        if (currentPlayer.hand.length === 2 && playableCards.length > 0) {
          const botRemembers = Math.random() < 0.75;
          if (botRemembers) {
            stateForBot = declareRival(stateForBot, currentPlayer.id);
          }
        }

        if (playableCards.length > 0) {
          const chosenCard = pickBestBotCard(playableCards, stateForBot, currentPlayer);
          const chosenColor = isWildCard(chosenCard)
            ? getDominantColor(currentPlayer.hand.filter((c) => c.id !== chosenCard.id))
            : undefined;

          // If action card causes draw on victim (+2, +4)
          const targetIndex = (stateForBot.currentTurnIndex + stateForBot.direction + stateForBot.players.length) % stateForBot.players.length;
          const victim = stateForBot.players[targetIndex];
          const penaltyCards = chosenCard.value === 'draw2' ? 2 : chosenCard.value === 'wild_draw4' ? 4 : 0;

          if (penaltyCards > 0 && victim) {
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

          const nextState = playCard(stateForBot, currentPlayer.id, chosenCard.id, { chosenColor });
          if (nextState.isGameOver) {
            soundService.playWinChime();
          } else {
            soundService.playCardSnap();
          }
          commitGameState(nextState, `${currentPlayer.name} played ${chosenCard.color} ${chosenCard.value}`);
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
    }, 1400);

    return () => clearTimeout(thinkingTimer);
  }, [
    isOnlineMode,
    currentPlayer,
    gameState,
    topDiscardCard,
    isDealing,
    isBotProcessing,
    triggerFlyingCard,
  ]);

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
        if (victim) {
          setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: 2 }));
          for (let i = 0; i < 2; i++) {
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

      commitGameState(nextState, `${myPlayer.name} played ${card.color} ${card.value}`);
    } catch (err: any) {
      hapticsService.invalidMove();
      soundService.playError();
      Alert.alert('Move Error', err?.message || 'Unable to play card');
    }
  };

  // Color Selection for Wild Cards
  const handleSelectWildColor = (color: StandardColor) => {
    setIsColorPickerOpen(false);

    if (gameState.pendingColorChoice) {
      const nextState = chooseWildColor(gameState, myPlayer.id, color);
      hapticsService.validPlay();
      soundService.playCardSnap();

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
          if (victim) {
            setPendingPenaltyCount((prev) => ({ ...prev, [victim.id]: 4 }));
            for (let i = 0; i < 4; i++) {
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

  // Draw Card from Deck: Spawn flying card and commit to state only upon landing
  const handleDrawCard = () => {
    if (!isHumanTurn || isHumanDrawing || isDealing) return;
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
        commitGameState(nextState, `${myPlayer.name} drew a card`);
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

  // Helper to render an opponent in horizontal layout (12 O'Clock Top Center) or compact vertical stack (9 O'Clock Left / 3 O'Clock Right)
  const renderOpponentBox = (opp: Player, layout: 'horizontal' | 'vertical') => {
    const isOppTurn = gameState.players[gameState.currentTurnIndex].id === opp.id;
    const isCatchable = opp.hand.length === 1 && !opp.hasDeclaredRival;
    const oppVisibleCount = isDealing
      ? (dealtCardsCount[opp.id] ?? 0)
      : pendingPenaltyCount[opp.id]
      ? Math.max(0, opp.hand.length - pendingPenaltyCount[opp.id])
      : opp.hand.length;

    if (layout === 'vertical') {
      const fanCardCount = Math.min(oppVisibleCount, 4);
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
            <Text style={styles.opponentAvatarEmoji}>
              {getAvatarConfig(opp.avatarId).emoji}
            </Text>
            <Text style={styles.sideOpponentName} numberOfLines={1}>
              {opp.name}
            </Text>
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

          {/* Compact Vertical Stack of Card Backs */}
          <View style={styles.sideOpponentFanContainer}>
            {fanCardCount > 0 ? (
              Array.from({ length: fanCardCount }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sideCardWrapper,
                    {
                      marginTop: idx === 0 ? 0 : -38,
                      zIndex: idx + 1,
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
          <Text style={styles.opponentAvatarEmoji}>
            {getAvatarConfig(opp.avatarId).emoji}
          </Text>
          <Text style={styles.opponentName} numberOfLines={1}>
            {opp.name}
          </Text>
          {isOppTurn && !gameState.isGameOver && !isDealing && (
            <TurnTimerBadge seconds={turnTimeRemaining} />
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

        {/* Physical Face-Down Cards Fan */}
        <View style={styles.opponentFanContainer}>
          {fanCardCount > 0 ? (
            Array.from({ length: fanCardCount }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.opponentCardWrapper,
                  {
                    marginLeft: idx === 0 ? 0 : -27,
                    zIndex: idx + 1,
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
        <SafeAreaView style={styles.safeArea}>
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
            {/* Audio Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleToggleSound}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>{isAudioMuted ? '🔇' : '🔊'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Turn & Active Color Status Banner */}
        <View style={styles.turnStatusBar}>
          <View style={styles.turnIndicator}>
            <View
              style={[
                styles.turnDot,
                {
                  backgroundColor: isOnlineMode
                    ? isMyTurn
                      ? '#10B981'
                      : '#F59E0B'
                    : currentPlayer.isBot
                    ? '#F59E0B'
                    : '#10B981',
                },
              ]}
            />
            <Text style={styles.turnText}>
              {isOnlineMode
                ? isMyTurn
                  ? '🟢 Your Turn (Play or Draw)'
                  : `⏳ ${currentPlayer.name}'s turn...`
                : currentPlayer.isBot
                ? `${currentPlayer.name}'s turn...`
                : currentPlayer.name === 'You'
                ? '🟢 Your Turn (Play or Draw)'
                : `${currentPlayer.name}'s Turn`}
            </Text>
          </View>

          <View style={styles.activeColorContainer}>
            <Text style={styles.activeColorLabel}>ACTIVE COLOR:</Text>
            <View
              style={[
                styles.activeColorBadge,
                { backgroundColor: COLOR_HEX[gameState.activeColor] },
              ]}
            >
              <Text style={styles.activeColorText}>
                {gameState.activeColor.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 2. 12 O'CLOCK POSITION (TOP OPPONENT) */}
        {/* ================================================================= */}
        <View style={styles.opponentsSection}>
          {isFourPlayer && opponentTop ? (
            <View style={styles.topOpponentContainer}>
              {renderOpponentBox(opponentTop, 'horizontal')}
            </View>
          ) : opponents.length === 1 ? (
            <View style={styles.topOpponentContainer}>
              {renderOpponentBox(opponents[0], 'horizontal')}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.opponentsScroll,
                styles.opponentsScrollCentered,
              ]}
            >
              {opponents.map((opp) => renderOpponentBox(opp, 'horizontal'))}
            </ScrollView>
          )}
        </View>

        {/* ================================================================= */}
        {/* 3. PLAY ARENA (9 O'Clock Left, Center Table Arena, 3 O'Clock Right) */}
        {/* ================================================================= */}
        <View style={[styles.arenaSection, !isFourPlayer && styles.arenaSectionCentered]}>
          {/* 9 O'Clock (Left Edge): Opponent 1 (e.g., CyberBot) */}
          {isFourPlayer && opponentLeft && (
            <View style={styles.clockPositionLeft}>
              {renderOpponentBox(opponentLeft, 'vertical')}
            </View>
          )}

          {/* Center Table: Draw Pile & Discard Pile with clear visual spacing */}
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
            {/* Draw Pile (3D Stack) */}
            <View style={styles.deckContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDrawCard}
                disabled={!isHumanTurn || gameState.hasDrawnThisTurn}
                style={[
                  styles.deckTouchArea,
                  (!isHumanTurn || gameState.hasDrawnThisTurn) && styles.drawDeckDisabled,
                ]}
              >
                {/* 3D Physical Stack Layer 3 */}
                {gameState.deck.length > 4 && (
                  <View
                    style={[
                      styles.deckLayerCard,
                      styles.deckLayer3,
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

                {/* Active Top Card Layer 1 */}
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
              <Text style={styles.deckLabel}>Draw Pile</Text>
            </View>

            {/* Active Discard Pile (Center Table with 3D Stack) */}
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

          {/* 3 O'Clock (Right Edge): Opponent 3 (e.g., EchoBot) */}
          {isFourPlayer && opponentRight && (
            <View style={styles.clockPositionRight}>
              {renderOpponentBox(opponentRight, 'vertical')}
            </View>
          )}
        </View>

        {/* Mid Controls Row: Live Event Ticker + Real-time Quick Taunt Bar */}
        <View style={styles.midControlsRow}>
          <View style={styles.tickerContainer}>
            <Text style={styles.tickerIcon}>📢</Text>
            <Text style={styles.tickerText} numberOfLines={1}>
              {latestLog?.message || 'Match in progress'}
            </Text>
          </View>

          <View style={styles.tauntSection}>
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
          </View>
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
              {/* Floating Compact Pill Matching RivalBot's Minimal Style */}
              <View style={styles.playerFloatingBadge}>
                <View style={styles.playerBadgeRow}>
                  <Text style={styles.playerAvatarEmoji}>
                    {getAvatarConfig(myPlayer.avatarId).emoji}
                  </Text>
                  <Text style={styles.playerBadgeName}>
                    {myPlayer.name === 'You' ? 'You' : myPlayer.name} • {visiblePlayerHand.length} card{visiblePlayerHand.length === 1 ? '' : 's'}
                  </Text>
                  {isMyTurn && !gameState.isGameOver && !isDealing && !gameState.privacyMask.isActive && (
                    <TurnTimerBadge seconds={turnTimeRemaining} />
                  )}
                  {isDealing ? (
                    <Text style={styles.dragHintWaitingText}>• Dealing cards...</Text>
                  ) : isHumanTurn ? (
                    <Text style={styles.dragHintText}>• Your Turn (drag/tap)</Text>
                  ) : (
                    <Text style={styles.dragHintWaitingText}>
                      {isOnlineMode ? '• Waiting for turn' : '• Bot taking turn'}
                    </Text>
                  )}
                </View>

                {/* Quick Actions (Call RIVAL & Pass Turn) */}
                <View style={styles.actionButtonsRow}>
                  {/* RIVAL Callout Button */}
                  {isHumanTurn && !isDealing && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleDeclareRival}
                      style={[
                        styles.rivalCalloutBtn,
                        (visiblePlayerHand.length <= 2 || rivalCountdown !== null) &&
                          styles.rivalCalloutActive,
                      ]}
                    >
                      <Text style={styles.rivalCalloutBtnText}>
                        ⚡ CALL RIVAL! {rivalCountdown !== null ? `(${rivalCountdown}s)` : ''}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Pass Turn Button (Available after drawing a card) */}
                  {isHumanTurn && gameState.hasDrawnThisTurn && !isDealing && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePassTurn}
                      style={styles.passTurnBtn}
                    >
                      <Text style={styles.passTurnBtnText}>Pass Turn ➔</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Horizontal Card List Sitting Directly Over Scenic Background */}
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
                    isHumanTurn && !isDealing && isValidMove(item, topDiscardCard, gameState.activeColor);
                  const overlapMargin = index === 0 ? 0 : getCardOverlapMargin(visiblePlayerHand.length);

                  return (
                    <DraggableCard
                      key={item.id}
                      card={item}
                      isPlayable={playable}
                      disabled={!isHumanTurn || isDealing}
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
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
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
    justifyContent: 'space-between',
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
    paddingVertical: 2,
    backgroundColor: 'transparent',
    zIndex: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 12,
    padding: 6,
    minWidth: 110,
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
    minWidth: 130,
    paddingHorizontal: 12,
  },
  opponentCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(30, 58, 138, 0.7)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  opponentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
    justifyContent: 'center',
  },
  opponentAvatarEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  opponentName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 80,
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
    paddingVertical: 2,
    minHeight: 52,
  },
  opponentCardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
    paddingVertical: 14,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    zIndex: 10,
  },
  arenaSectionCentered: {
    justifyContent: 'center',
  },
  centerTableArena: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    zIndex: 10,
  },
  tableFeltMat: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  clockPositionLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 15,
  },
  clockPositionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 15,
  },
  sideOpponentCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 6,
    width: 88,
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
    gap: 3,
    marginBottom: 3,
  },
  sideOpponentName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 78,
    textAlign: 'center',
  },
  sideOpponentFanContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 58,
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
  deckContainer: {
    alignItems: 'center',
  },
  deckTouchArea: {
    position: 'relative',
    width: 84,
    height: 122,
  },
  deckLayerCard: {
    position: 'absolute',
    width: 84,
    height: 122,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  deckLayer3: {
    top: -6,
    left: -6,
    zIndex: 1,
    opacity: 0.75,
  },
  deckLayer2: {
    top: -3,
    left: -3,
    zIndex: 2,
    opacity: 0.9,
  },
  drawDeckCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 84,
    height: 122,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: '#0F172A',
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
    bottom: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  drawDeckCount: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
  },
  deckLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  discardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  discardStackContainer: {
    width: 92,
    height: 138,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardLayerCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 92,
    height: 138,
  },
  discardLayerMinus2: {
    zIndex: 1,
    opacity: 0.88,
    transform: [{ rotate: '-7deg' }, { translateX: -6 }, { translateY: 2 }],
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
    width: 92,
    height: 138,
    borderRadius: 12,
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
  midControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
    marginVertical: 2,
    zIndex: 14,
  },
  tickerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tickerIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  tickerText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
    flex: 1,
  },
  tauntSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  playerSection: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: 2,
    paddingBottom: 6,
    zIndex: 20,
    alignItems: 'center',
  },
  playerFloatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 10,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  playerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatarEmoji: {
    fontSize: 13,
    marginRight: 4,
  },
  playerBadgeName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  dragHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#34D399',
    marginLeft: 8,
  },
  dragHintWaitingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginLeft: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rivalCalloutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: 6,
  },
  rivalCalloutActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#FBBF24',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  rivalCalloutBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  passTurnBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  passTurnBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  handScrollList: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handScrollListCentered: {
    minWidth: '100%',
    justifyContent: 'center',
  },
  catchRivalFloatingContainer: {
    position: 'absolute',
    bottom: 95,
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
});
