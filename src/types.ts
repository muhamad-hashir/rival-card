// src/types.ts - Core types and constants for Rival Card

export type StandardColor = 'red' | 'blue' | 'green' | 'yellow';
export type CardColor = StandardColor | 'wild';

export type NumberCardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type StandardActionValue = 'skip' | 'reverse' | 'draw2';
export type WildActionValue = 'wild' | 'wild_draw4' | 'mute' | 'rival_swap' | 'shield' | 'mirror';
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
  avatarId?: string;
  level?: number;
  countsTowardCareerStats?: boolean;
  botDifficulty?: 'normal' | 'soft';
  consecutiveMissedTurns?: number;
  isBotControlled?: boolean;
  isDisconnected?: boolean;
  hasForfeited?: boolean;
  teamId?: 'A' | 'B';
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
  | 'SHIELD_BLOCK'
  | 'MIRROR_REFLECT'
  | 'RESHUFFLE_DECK'
  | 'DISMISS_PRIVACY_MASK'
  | 'MATCH_TIMEOUT';

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

export interface SeriesPlayerStats {
  playerId: string;
  name: string;
  avatarId?: string;
  wins: number;
  totalPoints: number;
  roundPlacements: number[];
  isActive: boolean;
}

export interface SeriesRoundResult {
  matchNumber: number;
  winnerId: string;
  winnerName: string;
  placements: Array<{
    playerId: string;
    name: string;
    rank: number;
    cardsLeft: number;
    pointsEarned: number;
  }>;
}

export interface SeriesState {
  isPrivateSeries: boolean;
  currentMatchNumber: number;
  totalMatches: number;
  hostPlayerId: string;
  playerStats: Record<string, SeriesPlayerStats>;
  roundResults: SeriesRoundResult[];
  seriesEndedEarly?: boolean;
  endedReason?: string;
}

export type DefenseAttackType = 'draw2' | 'wild_draw4' | 'skip' | 'mute' | 'rival_swap';

export interface PendingDefenseState {
  attackerIndex: number;
  targetIndex: number;
  attackType: DefenseAttackType;
  drawPenalty: number; // e.g. 2, 4, or stacked total like 6/8
  mirrorBounceCount: number; // 0 = initial attack, 1 = reflected once (allows 1 Counter-Mirror)
  expiresAt: number; // Date.now() + 3000
  originalTargetIndex?: number;
  pairCount?: number;
  defenseEventId?: string;
}

export interface DefenseBannerState {
  id: string;
  type: 'shield' | 'mirror' | 'counter_mirror';
  message: string;
  timestamp: number;
}

export interface TimeoutStandingBreakdown {
  playerId: string;
  cardCount: number;
  priorityScore: number;
  tier1Count: number; // Special cards (Swap, Mute, Shield, Mirror), +4, and Wild (10 pts each)
  tier2Count: number; // Action cards: Skip, Reverse, +2 (5 pts each)
  tier3Count: number; // Number cards: 0-9 (1 pt each)
  highestTier: 0 | 1 | 2 | 3; // 3 = Tier 1, 2 = Tier 2, 1 = Tier 3, 0 = empty hand
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
  pendingDrawCount?: number;
  allowStacking?: boolean;
  pendingDefense?: PendingDefenseState | null;
  lastDefenseBanner?: DefenseBannerState | null;
  lastRivalCalledBy?: string;
  lastRivalCalledName?: string;
  lastRivalCallTimestamp?: number;
  seriesState?: SeriesState;
  matchDurationSeconds?: number;
  matchStartedAt?: number;
  matchTimeRemainingMs?: number;
  endedByTimeout?: boolean;
  timeoutUsedTieBreaker?: boolean;
  timeoutStandings?: TimeoutStandingBreakdown[];
  is2v2?: boolean;
  isRecoveryMatch?: boolean;
  forfeitedByPlayerId?: string;
  disconnectOutcomeReason?: string;
}
