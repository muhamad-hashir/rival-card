// src/services/multiplayerService.ts - Online Multiplayer Realtime Service with Session Persistence & Auto-Reconnection
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, safeStorage } from './supabase';
import type { GameState, Player } from '../types';

export const ACTIVE_MATCH_STORAGE_KEY = '@rivalcard:active_online_match';
export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 4;

/**
 * Pure helper to add or update a player in a private room while enforcing MAX_ROOM_PLAYERS.
 */
export function addPlayerToRoom(
  players: RoomPlayer[],
  incomingPlayer: RoomPlayer,
  maxPlayers: number = MAX_ROOM_PLAYERS
): { players: RoomPlayer[]; accepted: boolean } {
  const existingIndex = players.findIndex((p) => p.id === incomingPlayer.id);
  if (existingIndex !== -1) {
    const updated = [...players];
    updated[existingIndex] = incomingPlayer;
    return { players: updated, accepted: true };
  }

  if (players.length >= maxPlayers) {
    return { players, accepted: false };
  }

  return { players: [...players, incomingPlayer], accepted: true };
}

/**
 * Strictly resolve the local client's perspective player in an online match by authenticated user ID.
 * Never derives the local hand from `currentTurnIndex` so opponents' turns never swap the local tray.
 */
export function resolveOnlinePerspectivePlayer(
  players: readonly Player[],
  localUserId: string | null | undefined
): Player {
  if (localUserId) {
    const matched = players.find((p) => p.id === localUserId);
    if (matched) return matched;
  }
  return players.find((p) => !p.isBot) || players[0];
}

/**
 * Checks whether the current active turn in an online match belongs strictly to the authenticated local user.
 */
export function isOnlineLocalPlayerTurn(
  state: Pick<GameState, 'players' | 'currentTurnIndex' | 'gameMode'>,
  localUserId: string | null | undefined
): boolean {
  if (state.gameMode !== 'multiplayer' || !localUserId) return false;
  const activePlayer = state.players[state.currentTurnIndex];
  return Boolean(activePlayer && activePlayer.id === localUserId && !activePlayer.isBot);
}

export interface ActiveMatchSession {
  roomId: string;
  playerId: string;
  timestamp: number;
}

/**
 * Cache current active match session in persistent storage.
 */
export async function saveActiveMatchSession(roomId: string, playerId: string): Promise<void> {
  const session: ActiveMatchSession = {
    roomId,
    playerId,
    timestamp: Date.now(),
  };
  await safeStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Read cached active match session from persistent storage.
 */
export async function getActiveMatchSession(): Promise<ActiveMatchSession | null> {
  const raw = await safeStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.roomId === 'string' && typeof parsed.playerId === 'string') {
      return parsed as ActiveMatchSession;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Clear cached active match session from persistent storage.
 */
export async function clearActiveMatchSession(): Promise<void> {
  await safeStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  avatarId?: string;
}

export interface TauntMessage {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface RivalCalloutEvent {
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface MultiplayerCallbacks {
  onConnectionChange?: (status: ConnectionStatus) => void;
  onRoomPlayersUpdate?: (players: RoomPlayer[]) => void;
  onGameStarted?: (initialState: GameState) => void;
  onGameStateUpdate?: (state: GameState, senderId: string, actionDescription: string) => void;
  onTauntReceived?: (taunt: TauntMessage) => void;
  onRivalCalled?: (event: RivalCalloutEvent) => void;
  onSeriesNextMatch?: (nextState: GameState, isNewSeries: boolean) => void;
  onPlayerLeft?: (playerId: string, playerName: string) => void;
  onError?: (errorMessage: string) => void;
  onReconnecting?: (attempt: number) => void;
  onReconnected?: () => void;
  onStateSnapshotRequested?: (requesterId: string) => void;
  onStateSnapshotReceived?: (state: GameState) => void;
}

/**
 * Generate a random 4-digit room code between 1000 and 9999.
 */
export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Service managing Supabase Realtime channel subscriptions, room lobbies,
 * turns, card synchronization, auto-reconnection, and live quick taunts.
 */
export class MultiplayerService {
  private channel: RealtimeChannel | null = null;
  private currentRoomCode: string | null = null;
  private myPlayer: RoomPlayer | null = null;
  private roomPlayers: RoomPlayer[] = [];
  private callbacks: MultiplayerCallbacks = {};
  private connectionStatus: ConnectionStatus = 'disconnected';

  // Auto-Reconnection & Backoff State
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isExplicitlyLeaving: boolean = false;

  public getRoomCode(): string | null {
    return this.currentRoomCode;
  }

  public getMyPlayer(): RoomPlayer | null {
    return this.myPlayer;
  }

  public getRoomPlayers(): RoomPlayer[] {
    return [...this.roomPlayers];
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getIsReconnecting(): boolean {
    return this.isReconnecting;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public setCallbacks(callbacks: MultiplayerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.callbacks.onConnectionChange?.(status);
  }

  /**
   * Host a new multiplayer room with a 4-digit room code.
   */
  public async createRoom(
    playerInfo: { id: string; name: string; avatarId?: string },
    preferredCode?: string
  ): Promise<string> {
    await this.leaveRoom();

    const code = preferredCode || generateRoomCode();
    this.currentRoomCode = code;
    this.myPlayer = {
      id: playerInfo.id,
      name: playerInfo.name,
      isHost: true,
      joinedAt: Date.now(),
      avatarId: playerInfo.avatarId,
    };
    this.roomPlayers = [this.myPlayer];
    this.isExplicitlyLeaving = false;

    // Cache active session
    await saveActiveMatchSession(code, playerInfo.id);

    this.setStatus('connecting');
    this.setupChannel(code, true);

    return code;
  }

  /**
   * Join an existing multiplayer room using its 4-digit room code.
   */
  public async joinRoom(
    roomCode: string,
    playerInfo: { id: string; name: string; avatarId?: string }
  ): Promise<boolean> {
    await this.leaveRoom();

    const cleanCode = roomCode.trim();
    if (!/^\d{4}$/.test(cleanCode)) {
      this.callbacks.onError?.('Room code must be a 4-digit number.');
      return false;
    }

    this.currentRoomCode = cleanCode;
    this.myPlayer = {
      id: playerInfo.id,
      name: playerInfo.name,
      isHost: false,
      joinedAt: Date.now(),
      avatarId: playerInfo.avatarId,
    };
    this.roomPlayers = [this.myPlayer];
    this.isExplicitlyLeaving = false;

    // Cache active session
    await saveActiveMatchSession(cleanCode, playerInfo.id);

    this.setStatus('connecting');
    this.setupChannel(cleanCode, false);

    return true;
  }

  /**
   * Sets up Supabase Realtime channel listeners and subscriptions.
   */
  private setupChannel(roomCode: string, isHost: boolean): void {
    const channelName = `rival_room_${roomCode}`;

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    // 1. New Player Joined Lobby
    this.channel.on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      const incomingPlayer = payload?.player as RoomPlayer;
      if (!incomingPlayer) return;

      const { players: nextPlayers, accepted } = addPlayerToRoom(
        this.roomPlayers,
        incomingPlayer,
        MAX_ROOM_PLAYERS
      );

      if (!accepted) {
        if (this.myPlayer?.isHost && this.channel) {
          this.channel
            .send({
              type: 'broadcast',
              event: 'room_full',
              payload: {
                targetId: incomingPlayer.id,
                message: `Room is full (maximum ${MAX_ROOM_PLAYERS} players).`,
              },
            })
            .catch(() => {});
          this.broadcastRoomPlayers();
        }
        return;
      }

      if (nextPlayers !== this.roomPlayers) {
        this.roomPlayers = nextPlayers;
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);
      }

      // If host, broadcast authoritative list
      if (this.myPlayer?.isHost) {
        this.broadcastRoomPlayers();
      }
    });

    // 1b. Room Capacity Rejection
    this.channel.on('broadcast', { event: 'room_full' }, async ({ payload }) => {
      const targetId = payload?.targetId as string | undefined;
      if (targetId && this.myPlayer?.id && targetId !== this.myPlayer.id) {
        return;
      }
      const message =
        (payload?.message as string | undefined) ||
        `Room is full (maximum ${MAX_ROOM_PLAYERS} players).`;
      await this.leaveRoom();
      this.callbacks.onError?.(message);
    });

    // 2. Authoritative Room Players List (from Host)
    this.channel.on('broadcast', { event: 'room_players_sync' }, ({ payload }) => {
      const players = payload?.players as RoomPlayer[];
      if (Array.isArray(players)) {
        this.roomPlayers = players.slice(0, MAX_ROOM_PLAYERS);
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);
      }
    });

    // 3. Game Started by Host
    this.channel.on('broadcast', { event: 'game_start' }, ({ payload }) => {
      const initialState = payload?.initialState as GameState;
      if (initialState) {
        this.callbacks.onGameStarted?.(initialState);
      }
    });

    // 4. In-Game State Action Sync (Card played, drawn, passed, color chosen, rival declared)
    this.channel.on('broadcast', { event: 'game_state_action' }, ({ payload }) => {
      const state = payload?.state as GameState;
      const senderId = payload?.senderId as string;
      const actionDescription = (payload?.actionDescription as string) || 'Opponent made a move';

      if (state) {
        this.callbacks.onGameStateUpdate?.(state, senderId, actionDescription);
      }
    });

    // 5. State Snapshot Request (sent by reconnecting player)
    this.channel.on('broadcast', { event: 'request_state_snapshot' }, ({ payload }) => {
      const requesterId = payload?.requesterId as string;
      if (requesterId && requesterId !== this.myPlayer?.id) {
        this.callbacks.onStateSnapshotRequested?.(requesterId);
      }
    });

    // 6. Authoritative State Snapshot (received by reconnecting player)
    this.channel.on('broadcast', { event: 'state_snapshot' }, ({ payload }) => {
      const targetId = payload?.targetId as string;
      const state = payload?.state as GameState;

      if (state && (!targetId || targetId === this.myPlayer?.id)) {
        this.callbacks.onStateSnapshotReceived?.(state);
        this.callbacks.onGameStateUpdate?.(state, 'host', 'Authoritative state recovered');
        if (this.isReconnecting) {
          this.isReconnecting = false;
          this.callbacks.onReconnected?.();
        }
      }
    });

    // 7. Live Taunt Emote
    this.channel.on('broadcast', { event: 'player_taunt' }, ({ payload }) => {
      const taunt = payload as TauntMessage;
      if (taunt && taunt.emoji) {
        this.callbacks.onTauntReceived?.(taunt);
      }
    });

    // 7b. Opponent RIVAL! Callout Audio Cue Event
    this.channel.on('broadcast', { event: 'rival_called' }, ({ payload }) => {
      const playerId = payload?.playerId as string;
      const playerName = (payload?.playerName as string) || 'Opponent';
      const timestamp = typeof payload?.timestamp === 'number' ? payload.timestamp : Date.now();
      if (playerId) {
        this.callbacks.onRivalCalled?.({ playerId, playerName, timestamp });
      }
    });

    // 7c. Private Room Series: Host Advances to Next Match (or New 5-Match Series)
    this.channel.on('broadcast', { event: 'series_next_match' }, ({ payload }) => {
      const nextState = payload?.nextState as GameState;
      const isNewSeries = Boolean(payload?.isNewSeries);
      if (nextState) {
        this.callbacks.onSeriesNextMatch?.(nextState, isNewSeries);
      }
    });

    // 8. Player Left Room
    this.channel.on('broadcast', { event: 'player_left' }, ({ payload }) => {
      const playerId = payload?.playerId as string;
      const playerName = payload?.playerName as string;
      if (playerId) {
        this.roomPlayers = this.roomPlayers.filter((p) => p.id !== playerId);
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);
        this.callbacks.onPlayerLeft?.(playerId, playerName);
      }
    });

    // Subscribe to channel with connection monitoring
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setStatus('connected');
        const wasReconnecting = this.isReconnecting;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);

        // If guest just joined, announce arrival to host
        if (!isHost && this.myPlayer) {
          this.channel?.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: { player: this.myPlayer },
          });
        }

        // If recovering from connection drop, announce reconnected and request snapshot
        if (wasReconnecting) {
          this.callbacks.onReconnected?.();
          this.requestStateSnapshot();
        }
      } else if (status === 'CLOSED') {
        this.setStatus('disconnected');
        if (!this.isExplicitlyLeaving && this.currentRoomCode) {
          this.triggerReconnect();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setStatus('error');
        if (!this.isExplicitlyLeaving && this.currentRoomCode) {
          this.triggerReconnect();
        }
      }
    });
  }

  /**
   * Triggers automatic reconnection with exponential backoff (1s, 2s, 4s).
   */
  public triggerReconnect(): void {
    if (!this.currentRoomCode || this.isExplicitlyLeaving || this.isReconnecting) return;

    this.isReconnecting = true;
    this.callbacks.onReconnecting?.(this.reconnectAttempts + 1);

    const backoffDelays = [1000, 2000, 4000];
    const delay = backoffDelays[Math.min(this.reconnectAttempts, backoffDelays.length - 1)];

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts += 1;
      await this.reconnect();
    }, delay);
  }

  /**
   * Reconnects to the active room channel.
   */
  public async reconnect(): Promise<void> {
    if (!this.currentRoomCode || !this.myPlayer) return;

    try {
      if (this.channel) {
        try {
          await supabase.removeChannel(this.channel);
        } catch {
          // ignore
        }
        this.channel = null;
      }

      this.setStatus('connecting');
      this.setupChannel(this.currentRoomCode, this.myPlayer.isHost);
    } catch (err) {
      console.warn('Reconnection attempt failed:', err);
      this.triggerReconnect();
    }
  }

  /**
   * Request latest authoritative state snapshot from the room host.
   */
  public async requestStateSnapshot(): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected' || !this.myPlayer) return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'request_state_snapshot',
        payload: { requesterId: this.myPlayer.id },
      });
    } catch (err: any) {
      console.warn('Failed to send request_state_snapshot:', err?.message || err);
    }
  }

  /**
   * Broadcast authoritative state snapshot (invoked by host when peer reconnects).
   */
  public async broadcastStateSnapshot(state: GameState, targetPlayerId?: string): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'state_snapshot',
        payload: {
          state,
          targetId: targetPlayerId,
          senderId: this.myPlayer?.id,
        },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast state snapshot:', err?.message || err);
    }
  }

  /**
   * Broadcast updated room players list (invoked by Host).
   */
  public async broadcastRoomPlayers(): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'room_players_sync',
        payload: { players: this.roomPlayers },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast room players:', err?.message || err);
    }
  }

  /**
   * Start the multiplayer match and broadcast initial game state (Host only).
   */
  public async startGame(initialState: GameState): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'game_start',
        payload: { initialState },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast game start:', err?.message || err);
    }
  }

  /**
   * Broadcast updated game state after a card play, draw, pass, color choice, or rival action.
   */
  public async broadcastGameState(
    state: GameState,
    actionDescription: string = 'Move completed'
  ): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'game_state_action',
        payload: {
          state,
          senderId: this.myPlayer?.id || '',
          actionDescription,
        },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast game state:', err?.message || err);
    }
  }

  /**
   * Broadcast a live taunt emote to all players in the room.
   */
  public async broadcastTaunt(emoji: string): Promise<TauntMessage | null> {
    if (!this.channel || this.connectionStatus !== 'connected' || !this.myPlayer) {
      return null;
    }

    const taunt: TauntMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      senderId: this.myPlayer.id,
      senderName: this.myPlayer.name,
      timestamp: Date.now(),
    };

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'player_taunt',
        payload: taunt,
      });
      return taunt;
    } catch (err: any) {
      console.warn('Failed to broadcast taunt:', err?.message || err);
      return null;
    }
  }

  /**
   * Broadcast a RIVAL! callout cue so all connected opponents hear the callout SFX.
   */
  public async broadcastRivalCallout(playerId: string, playerName: string): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'rival_called',
        payload: {
          playerId,
          playerName,
          timestamp: Date.now(),
        },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast rival callout:', err?.message || err);
    }
  }

  /**
   * Broadcast next match state for a Private Room 5-Match Series (or fresh 5-Match Series restart).
   */
  public async broadcastSeriesNextMatch(
    nextState: GameState,
    isNewSeries: boolean = false
  ): Promise<void> {
    if (!this.channel || this.connectionStatus !== 'connected') return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'series_next_match',
        payload: {
          nextState,
          isNewSeries,
        },
      });
    } catch (err: any) {
      console.warn('Failed to broadcast series_next_match:', err?.message || err);
    }
  }

  /**
   * Leave the current room, clear cached session, and unsubscribe channel.
   */
  public async leaveRoom(): Promise<void> {
    this.isExplicitlyLeaving = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.setStatus('disconnected');

    const activeChannel = this.channel;
    const departingPlayer = this.myPlayer;

    this.channel = null;
    this.currentRoomCode = null;
    this.myPlayer = null;
    this.roomPlayers = [];

    clearActiveMatchSession().catch(() => {});

    if (activeChannel) {
      if (departingPlayer) {
        try {
          await activeChannel.send({
            type: 'broadcast',
            event: 'player_left',
            payload: {
              playerId: departingPlayer.id,
              playerName: departingPlayer.name,
            },
          });
        } catch {
          // Ignore during cleanup
        }
      }

      try {
        await supabase.removeChannel(activeChannel);
      } catch {
        // Ignore channel removal errors
      }
    }

    this.isExplicitlyLeaving = false;
  }
}

export const multiplayerService = new MultiplayerService();
