// src/services/matchmakingService.ts - Quick Match 1v1 Auto-Matchmaking Service using Supabase Realtime & Presence
import { supabase, generateRoomCode, multiplayerService } from './supabase';
import { createGame } from '../gameEngine';
import type { GameState } from '../types';

export interface QueuedPlayer {
  id: string;
  name: string;
  avatarId: string;
}

export interface MatchFoundResult {
  initialState: GameState;
  myPlayerId: string;
  roomCode: string;
  isBotMatch: boolean;
  opponentName: string;
  opponentAvatarId: string;
}

export type MatchmakingStatus = 'idle' | 'searching' | 'matched';

export interface MatchmakingCallbacks {
  onStatusChange?: (status: MatchmakingStatus) => void;
  onTick?: (seconds: number) => void;
  onMatchFound?: (result: MatchFoundResult) => void;
  onError?: (errorMessage: string) => void;
}

export class MatchmakingService {
  private status: MatchmakingStatus = 'idle';
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private elapsedSeconds: number = 0;
  private callbacks: MatchmakingCallbacks = {};
  private activePlayer: QueuedPlayer | null = null;
  private isProcessingMatch: boolean = false;

  public getStatus(): MatchmakingStatus {
    return this.status;
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public getActivePlayer(): QueuedPlayer | null {
    return this.activePlayer;
  }

  /**
   * Starts searching for a 1v1 match in the matchmaking queue.
   * Auto-falls back to RivalBot after timeoutSeconds (default: 12 seconds).
   */
  public async startMatchmaking(
    player: QueuedPlayer,
    callbacks: MatchmakingCallbacks,
    timeoutSeconds: number = 12
  ): Promise<void> {
    await this.cancelMatchmaking();

    this.activePlayer = player;
    this.callbacks = callbacks;
    this.status = 'searching';
    this.elapsedSeconds = 0;
    this.isProcessingMatch = false;

    this.callbacks.onStatusChange?.('searching');
    this.callbacks.onTick?.(0);

    // 1. Ticker interval (1s)
    this.intervalTimer = setInterval(() => {
      this.elapsedSeconds += 1;
      this.callbacks.onTick?.(this.elapsedSeconds);
    }, 1000);

    // 2. 12-second Fallback Timer
    this.timer = setTimeout(() => {
      this.handleBotFallback();
    }, timeoutSeconds * 1000);

    // 3. Connect to Supabase Realtime channel
    try {
      this.setupChannel(player);
    } catch (err: any) {
      console.warn('Matchmaking channel setup warning:', err?.message || err);
    }
  }

  /**
   * Subscribes to the matchmaking channel and listens for queue peers & match broadcasts.
   */
  private setupChannel(player: QueuedPlayer): void {
    const channelName = 'matchmaking:1v1';
    this.channel = supabase.channel(channelName, {
      config: {
        presence: { key: player.id },
        broadcast: { self: false },
      },
    });

    // Handle broadcast match_created
    this.channel.on('broadcast', { event: 'match_created' }, async ({ payload }) => {
      if (this.isProcessingMatch || this.status !== 'searching') return;

      if (payload?.targetId === player.id) {
        this.isProcessingMatch = true;
        this.status = 'matched';
        this.callbacks.onStatusChange?.('matched');

        const roomCode = payload.roomCode as string;
        const initialState = payload.initialState as GameState;
        const coordinator = payload.coordinator as QueuedPlayer;

        await this.cleanupChannel();

        try {
          await multiplayerService.joinRoom(roomCode, {
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
          });
        } catch {
          // Join room fallback
        }

        this.callbacks.onMatchFound?.({
          initialState,
          myPlayerId: player.id,
          roomCode,
          isBotMatch: false,
          opponentName: coordinator?.name || 'Rival',
          opponentAvatarId: coordinator?.avatarId || 'avatar_1',
        });
      }
    });

    // Handle Presence sync
    this.channel.on('presence', { event: 'sync' }, () => {
      this.evaluatePresence(player);
    });

    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await this.channel?.track({
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
            queuedAt: Date.now(),
          });
        } catch {
          // Ignore track errors in test or restricted networks
        }
      }
    });
  }

  /**
   * Inspects Presence state and pairs with candidate opponent if found.
   */
  private async evaluatePresence(player: QueuedPlayer): Promise<void> {
    if (this.isProcessingMatch || this.status !== 'searching' || !this.channel) return;

    const presenceState = this.channel.presenceState();
    const candidateOpponents: QueuedPlayer[] = [];

    for (const key of Object.keys(presenceState)) {
      if (key !== player.id) {
        const presences = presenceState[key] as any[];
        if (Array.isArray(presences) && presences.length > 0) {
          const opp = presences[0];
          if (opp && opp.id && opp.id !== player.id) {
            candidateOpponents.push({
              id: opp.id,
              name: opp.name || 'Rival',
              avatarId: opp.avatarId || 'avatar_1',
            });
          }
        }
      }
    }

    if (candidateOpponents.length === 0) return;

    // Pick first candidate opponent
    const opponent = candidateOpponents[0];

    // Deterministic Coordinator: player with alphabetically smaller ID coordinates the room
    const isCoordinator = player.id < opponent.id;

    if (isCoordinator) {
      this.isProcessingMatch = true;
      this.status = 'matched';
      this.callbacks.onStatusChange?.('matched');

      const roomCode = generateRoomCode();
      const initialState = createGame(
        [
          { id: player.id, name: player.name, avatarId: player.avatarId, isBot: false },
          { id: opponent.id, name: opponent.name, avatarId: opponent.avatarId, isBot: false },
        ],
        'multiplayer'
      );

      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'match_created',
          payload: {
            coordinator: player,
            targetId: opponent.id,
            roomCode,
            initialState,
          },
        });
      } catch (err: any) {
        console.warn('Failed to broadcast match_created:', err?.message || err);
      }

      await this.cleanupChannel();

      try {
        await multiplayerService.createRoom(
          { id: player.id, name: player.name, avatarId: player.avatarId },
          roomCode
        );
      } catch {
        // Room creation fallback
      }

      this.callbacks.onMatchFound?.({
        initialState,
        myPlayerId: player.id,
        roomCode,
        isBotMatch: false,
        opponentName: opponent.name,
        opponentAvatarId: opponent.avatarId,
      });
    }
  }

  /**
   * 12-Second Fallback: Exits queue cleanly and launches a match seeded with RivalBot.
   */
  public async handleBotFallback(): Promise<void> {
    if (this.isProcessingMatch || this.status !== 'searching' || !this.activePlayer) return;

    this.isProcessingMatch = true;
    this.status = 'matched';
    this.callbacks.onStatusChange?.('matched');

    const player = this.activePlayer;
    // Clean up channel asynchronously without blocking game launch
    this.cleanupChannel().catch(() => {});

    const botOpponent = {
      id: 'bot_rival',
      name: 'RivalBot 🤖',
      isBot: true,
      avatarId: 'avatar_2',
    };

    const initialState = createGame(
      [
        { id: player.id, name: player.name, avatarId: player.avatarId, isBot: false },
        botOpponent,
      ],
      'vs_bot'
    );

    this.callbacks.onMatchFound?.({
      initialState,
      myPlayerId: player.id,
      roomCode: 'BOT_MATCH',
      isBotMatch: true,
      opponentName: botOpponent.name,
      opponentAvatarId: botOpponent.avatarId,
    });
  }

  /**
   * Cancels matchmaking queue, clears timers, and untracks presence.
   */
  public async cancelMatchmaking(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    await this.cleanupChannel();

    this.status = 'idle';
    this.activePlayer = null;
    this.isProcessingMatch = false;
    this.elapsedSeconds = 0;
    this.callbacks.onStatusChange?.('idle');
  }

  private async cleanupChannel(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    const chan = this.channel;
    this.channel = null;

    if (chan) {
      try {
        chan.untrack().catch?.(() => {});
      } catch {
        // ignore
      }
      try {
        supabase.removeChannel(chan).catch?.(() => {});
      } catch {
        // ignore
      }
    }
  }
}

export const matchmakingService = new MatchmakingService();
