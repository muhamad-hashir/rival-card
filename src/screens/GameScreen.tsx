// src/screens/GameScreen.tsx - Main Game Screen for Rival Card with Mobile-Native Polish & Supabase Realtime Multiplayer
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
} from '../gameEngine';
import { CardView } from '../components/CardView';
import { DraggableCard } from '../components/DraggableCard';
import { ColorPickerModal } from '../components/ColorPickerModal';
import { PrivacyMaskModal } from '../components/PrivacyMaskModal';
import { GameOverModal } from '../components/GameOverModal';
import { MultiplayerLobbyModal } from '../components/MultiplayerLobbyModal';
import { ModesModal } from '../components/ModesModal';
import { TauntBar } from '../components/TauntBar';
import { FlyingCard, FlyingCardData } from '../components/FlyingCard';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { multiplayerService, TauntMessage } from '../services/supabase';
import { COLOR_HEX } from '../types';
import type { Card, GameMode, GameState, Player, StandardColor } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCENIC_BACKGROUND = require('../../assets/background1.png');
const CARD_BACK_IMAGE = require('../../assets/card_back.png');

export type SetupPreset = 'vs_bot_2p' | 'vs_bot_4p' | 'pass_play_2p' | 'pass_play_3p';

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
  const [currentPresetKey, setCurrentPresetKey] = useState<SetupPreset>(initialPresetKey);
  const [gameState, setGameState] = useState<GameState>(() =>
    initialGameState || createGame(PRESETS[initialPresetKey].players, PRESETS[initialPresetKey].mode)
  );

  // Sound mute state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(soundService.getMuted());

  // Wild Card pending selection
  const [selectedWildCard, setSelectedWildCard] = useState<Card | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // 3-second RIVAL countdown tracking
  const [rivalCountdown, setRivalCountdown] = useState<number | null>(null);
  const rivalTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Multiplayer Online & Modes states
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [isModesModalOpen, setIsModesModalOpen] = useState(false);
  const [onlineRoomCode, setOnlineRoomCode] = useState<string | null>(initialOnlineRoomCode);
  const [localOnlinePlayerId, setLocalOnlinePlayerId] = useState<string | null>(initialLocalOnlinePlayerId);
  const [activeTaunt, setActiveTaunt] = useState<TauntMessage | null>(null);

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

  const isMyTurn = isOnlineMode
    ? currentPlayer.id === localOnlinePlayerId
    : currentPlayer.id === myPlayer.id;
  const isHumanTurn = isMyTurn && !gameState.privacyMask.isActive && !gameState.isGameOver;

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

  // Launch a flying card animation from Draw Pile to target hand with 320ms travel time
  const triggerFlyingCard = useCallback(
    (target: 'player' | 'opponent', onArrival?: () => void) => {
      const id = `fly_${Date.now()}_${Math.random()}`;
      const startX = 82; // Center of deck positioned at mid-left
      const startY = SCREEN_HEIGHT * 0.44;
      const targetX = SCREEN_WIDTH * 0.5;
      const targetY = target === 'player' ? SCREEN_HEIGHT - 65 : 65;
      const targetScale = target === 'player' ? 1.0 : 0.65;

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
    []
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
        const isHuman = playerId === myPlayer.id || pIdx === 0;
        const currentFlight = flightIndex++;

        setTimeout(() => {
          triggerFlyingCard(isHuman ? 'player' : 'opponent', () => {
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
  }, [myPlayer.id, triggerFlyingCard]);

  // Trigger dealing animation on initial match mount
  useEffect(() => {
    runDealingAnimation(PRESETS[initialPresetKey].players);
  }, [initialPresetKey, runDealingAnimation]);

  // Restart match with current or new preset
  const handleStartGame = useCallback((presetKey: SetupPreset) => {
    setCurrentPresetKey(presetKey);
    const preset = PRESETS[presetKey];
    setGameState(createGame(preset.players, preset.mode));
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
    runDealingAnimation(preset.players);
  }, [runDealingAnimation]);

  // Online Multiplayer real-time state synchronization listener
  useEffect(() => {
    if (!isOnlineMode) return;

    multiplayerService.setCallbacks({
      onGameStateUpdate: (remoteState, senderId) => {
        if (senderId !== localOnlinePlayerId) {
          setGameState(remoteState);
          if (remoteState.isGameOver) {
            soundService.playWinChime();
            hapticsService.victory();
          } else {
            soundService.playCardSnap();
            hapticsService.cardSnap();
          }
        }
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
  }, [isOnlineMode, localOnlinePlayerId]);

  // Leave active online multiplayer room
  const handleLeaveRoom = async () => {
    hapticsService.cardSnap();
    await multiplayerService.leaveRoom();
    setOnlineRoomCode(null);
    setLocalOnlinePlayerId(null);
    handleStartGame('vs_bot_2p');
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
            const nextState = playCard(gameState, currentPlayer.id, drawnCard.id, { chosenColor });
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

        // Pre-declare RIVAL if playing second-to-last card
        if (currentPlayer.hand.length === 2 && playableCards.length > 0) {
          stateForBot = declareRival(stateForBot, currentPlayer.id);
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
                triggerFlyingCard(victim.isBot ? 'opponent' : 'player', () => {
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
          triggerFlyingCard('opponent', () => {
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
              triggerFlyingCard(victim.isBot ? 'opponent' : 'player', () => {
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
                triggerFlyingCard(victim.isBot ? 'opponent' : 'player', () => {
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

  // Declare RIVAL!
  const handleDeclareRival = () => {
    if (!myPlayer || myPlayer.isBot) return;
    const nextState = declareRival(gameState, myPlayer.id);
    hapticsService.rivalCallout();
    soundService.playRivalCallout();
    commitGameState(nextState, `${myPlayer.name} declared RIVAL!`);
    if (rivalTimerRef.current) {
      clearInterval(rivalTimerRef.current);
      rivalTimerRef.current = null;
    }
    setRivalCountdown(null);
  };

  // Catch Opponent who forgot to declare RIVAL!
  const handleCatchRival = (accusedPlayer: Player) => {
    if (accusedPlayer.hand.length !== 1 || accusedPlayer.hasDeclaredRival) return;
    const nextState = catchRival(gameState, myPlayer.id, accusedPlayer.id);
    hapticsService.rivalCatch();
    soundService.playPenalty();
    commitGameState(nextState, `${myPlayer.name} caught ${accusedPlayer.name}!`);
  };

  // Opponents list (all players except local player)
  const opponents = gameState.players.filter((p) => p.id !== myPlayer.id);

  // Latest game event
  const latestLog = gameState.logs[gameState.logs.length - 1];

  return (
    <ImageBackground
      source={SCENIC_BACKGROUND}
      style={styles.scenicBackground}
      resizeMode="cover"
    >
      <View style={styles.scenicOverlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* ================================================================= */}
            {/* 1. TOP HEADER & STATUS BAR */}
            {/* ================================================================= */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {Boolean(onGoHome) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticsService.cardSnap();
                      if (isOnlineMode) {
                        Alert.alert('Leave Online Match?', 'Are you sure you want to return to home screen?', [
                          {
                            text: 'Leave',
                            style: 'destructive',
                            onPress: async () => {
                              await handleLeaveRoom();
                              handleExitToHome();
                            },
                          },
                          { text: 'Stay', style: 'cancel' },
                        ]);
                      } else {
                        handleExitToHome();
                      }
                    }}
                    style={styles.homeIconBtn}
                  >
                    <Text style={styles.homeIconBtnText}>🏠</Text>
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
        {/* 2. OPPONENTS ROW */}
        {/* ================================================================= */}
        <View style={styles.opponentsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.opponentsScroll,
              opponents.length <= 2 && styles.opponentsScrollCentered,
            ]}
          >
            {opponents.map((opp) => {
              const isOppTurn = gameState.players[gameState.currentTurnIndex].id === opp.id;
              const isCatchable = opp.hand.length === 1 && !opp.hasDeclaredRival;
              const oppVisibleCount = isDealing
                ? (dealtCardsCount[opp.id] ?? 0)
                : pendingPenaltyCount[opp.id]
                ? Math.max(0, opp.hand.length - pendingPenaltyCount[opp.id])
                : opp.hand.length;
              const fanCardCount = Math.min(oppVisibleCount, 6);

              return (
                <View
                  key={opp.id}
                  style={[
                    styles.opponentCard,
                    isOppTurn && styles.opponentCardActive,
                    opponents.length === 1 && styles.opponentCardSingle,
                  ]}
                >
                  {/* Opponent Top Row (Name, Count Badge, Muted, Rival) */}
                  <View style={styles.opponentTopRow}>
                    <Text style={styles.opponentName} numberOfLines={1}>
                      {opp.name}
                    </Text>
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
                          <CardView isFaceDown size="small" disabled />
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
            })}
          </ScrollView>
        </View>

        {/* ================================================================= */}
        {/* 3. PLAY ARENA (Draw Deck on Upper/Mid-Left + Discard Pile Centered) */}
        {/* ================================================================= */}
        <View style={styles.arenaSection}>
          {/* Draw Pile (Positioned Upper-Left / Mid-Left with 3D Stack) */}
          <View style={styles.deckAnchor}>
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
                {/* 3D Physical Stack Layer 3 (Bottom-most offset edge) */}
                {gameState.deck.length > 4 && (
                  <View style={[styles.deckLayerCard, styles.deckLayer3]}>
                    <Image
                      source={CARD_BACK_IMAGE}
                      style={styles.drawDeckBackImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* 3D Physical Stack Layer 2 (Middle offset edge) */}
                {gameState.deck.length > 2 && (
                  <View style={[styles.deckLayerCard, styles.deckLayer2]}>
                    <Image
                      source={CARD_BACK_IMAGE}
                      style={styles.drawDeckBackImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Active Top Card Layer 1 */}
                <View style={styles.drawDeckCard}>
                  <Image
                    source={CARD_BACK_IMAGE}
                    style={styles.drawDeckBackImage}
                    resizeMode="cover"
                  />
                  <View style={styles.drawDeckBadge}>
                    <Text style={styles.drawDeckCount}>{gameState.deck.length}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={styles.deckLabel}>Draw Pile</Text>
            </View>
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
                  <Text style={styles.playerBadgeName}>
                    {myPlayer.name === 'You' ? 'You' : myPlayer.name} • {visiblePlayerHand.length} card{visiblePlayerHand.length === 1 ? '' : 's'}
                  </Text>
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
          onPlayAgain={() => {
            if (isOnlineMode) {
              handleLeaveRoom();
            } else {
              handleStartGame(currentPresetKey);
            }
          }}
          onResetMode={() => {
            if (isOnlineMode) {
              handleLeaveRoom();
            } else {
              setIsModesModalOpen(true);
            }
          }}
        />
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
    paddingVertical: 4,
    backgroundColor: 'transparent',
    zIndex: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    zIndex: 10,
  },
  deckAnchor: {
    position: 'absolute',
    left: 40,
    top: '50%',
    transform: [{ translateY: -65 }],
    zIndex: 12,
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
    flex: 1,
    maxWidth: 320,
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
});
