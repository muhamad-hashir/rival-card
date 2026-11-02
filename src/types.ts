// src/types.ts - Core types and constants for Rival Card

export type StandardColor = 'red' | 'blue' | 'green' | 'yellow';
export type CardColor = StandardColor | 'wild';

export type NumberCardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type StandardActionValue = 'skip' | 'reverse' | 'draw2';
export type WildActionValue = 'wild' | 'wild_draw4' | 'mute' | 'rival_swap';
export type CardValue = NumberCardValue | StandardActionValue | WildActionValue;

export const STANDARD_COLORS: readonly StandardColor[] = ['red', 'blue', 'green', 'yellow'] as const;

export const COLOR_HEX: Record<CardColor, string> = {
  red: '#EF4444',
  blue: '#2563EB',
  green: '#16A34A',
  yellow: '#EAB308',
  wild: '#1E293B',
};

export const COLOR_LABELS: Record<CardColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  wild: 'Wild',
};

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
  scoreValue: number;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  isMuted: boolean;
  mutedRoundsRemaining: number;
  hasDeclaredRival: boolean;
}

export type TurnDirection = 1 | -1;

export type GameMode = 'pass_and_play' | 'vs_bot' | 'multiplayer';

export interface PrivacyMaskState {
  isActive: boolean;
  targetPlayerId: string;
  targetPlayerName: string;
  promptText: string;
}

export type GameActionType =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'PASS_TURN'
  | 'CHOOSE_COLOR'
  | 'DECLARE_RIVAL'
  | 'CATCH_RIVAL'
  | 'SWAP_HANDS'
  | 'MUTE_PLAYER'
  | 'RESHUFFLE_DECK'
  | 'DISMISS_PRIVACY_MASK';

export interface GameEventLog {
  id: string;
  timestamp: number;
  playerId?: string;
  playerName?: string;
  actionType: GameActionType;
  card?: Card;
  chosenColor?: StandardColor;
  targetPlayerId?: string;
  targetPlayerName?: string;
  message: string;
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentTurnIndex: number;
  direction: TurnDirection;
  activeColor: StandardColor;
  winner: Player | null;
  isGameOver: boolean;
  gameMode: GameMode;
  hasDrawnThisTurn: boolean;
  drawnCard: Card | null;
  pendingColorChoice: boolean;
  pendingWildCard: Card | null;
  privacyMask: PrivacyMaskState;
  logs: GameEventLog[];
  turnCount: number;
  lastActionTimestamp?: number;
}
