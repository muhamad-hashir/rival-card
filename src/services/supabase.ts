// src/services/supabase.ts - Supabase Realtime Client & Multiplayer Game Service
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { GameState, Player, StandardColor } from '../types';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://diprmtxrlynniqacapmz.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_aejGXlQ3gcemdzCdVBt99Q_WBtxUoYQ';

// Safe Storage Adapter with automatic graceful fallback to memoryStore
// if native AsyncStorage module is null or throws (e.g. inside Expo Go).
const memoryStore = new Map<string, string>();
let nativeAsyncStorageFailed = false;

let NativeAsyncStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-async-storage/async-storage');
  NativeAsyncStorage = mod?.default ?? mod;
} catch {
  nativeAsyncStorageFailed = true;
}

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.getItem === 'function') {
      try {
        const val = await NativeAsyncStorage.getItem(key).catch(() => {
          nativeAsyncStorageFailed = true;
          return null;
        });
        if (val !== null && val !== undefined) {
          return val;
        }
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.setItem === 'function') {
      try {
        await NativeAsyncStorage.setItem(key, value).catch(() => {
          nativeAsyncStorageFailed = true;
        });
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    memoryStore.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.removeItem === 'function') {
      try {
        await NativeAsyncStorage.removeItem(key).catch(() => {
          nativeAsyncStorageFailed = true;
        });
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    memoryStore.delete(key);
  },
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export interface TauntMessage {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface MultiplayerCallbacks {
  onConnectionChange?: (status: ConnectionStatus) => void;
  onRoomPlayersUpdate?: (players: RoomPlayer[]) => void;
  onGameStarted?: (initialState: GameState) => void;
  onGameStateUpdate?: (state: GameState, senderId: string, actionDescription: string) => void;
  onTauntReceived?: (taunt: TauntMessage) => void;
  onPlayerLeft?: (playerId: string, playerName: string) => void;
  onError?: (errorMessage: string) => void;
}

/**
 * Generate a random 4-digit room code between 1000 and 9999.
 */
export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Service managing Supabase Realtime channel subscriptions, room lobbies,
 * turns, card synchronization, and live quick taunts.
 */
export class MultiplayerService {
  private channel: RealtimeChannel | null = null;
  private currentRoomCode: string | null = null;
  private myPlayer: RoomPlayer | null = null;
  private roomPlayers: RoomPlayer[] = [];
  private callbacks: MultiplayerCallbacks = {};
  private connectionStatus: ConnectionStatus = 'disconnected';

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
    playerInfo: { id: string; name: string },
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
    };
    this.roomPlayers = [this.myPlayer];

    this.setStatus('connecting');
    this.setupChannel(code, true);

    return code;
  }

  /**
   * Join an existing multiplayer room using its 4-digit room code.
   */
  public async joinRoom(
    roomCode: string,
    playerInfo: { id: string; name: string }
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
    };
    this.roomPlayers = [this.myPlayer];

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

      const exists = this.roomPlayers.some((p) => p.id === incomingPlayer.id);
      if (!exists) {
        this.roomPlayers = [...this.roomPlayers, incomingPlayer];
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);
      }

      // If I am host, broadcast the updated authoritative room player list
      if (this.myPlayer?.isHost) {
        this.broadcastRoomPlayers();
      }
    });

    // 2. Authoritative Room Players List (received from Host)
    this.channel.on('broadcast', { event: 'room_players_sync' }, ({ payload }) => {
      const players = payload?.players as RoomPlayer[];
      if (Array.isArray(players)) {
        this.roomPlayers = players;
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

    // 4. In-Game State Action Sync (Card played, drawn, color chosen, rival declared)
    this.channel.on('broadcast', { event: 'game_state_action' }, ({ payload }) => {
      const state = payload?.state as GameState;
      const senderId = payload?.senderId as string;
      const actionDescription = (payload?.actionDescription as string) || 'Opponent made a move';

      if (state) {
        this.callbacks.onGameStateUpdate?.(state, senderId, actionDescription);
      }
    });

    // 5. Live Taunt Emote
    this.channel.on('broadcast', { event: 'player_taunt' }, ({ payload }) => {
      const taunt = payload as TauntMessage;
      if (taunt && taunt.emoji) {
        this.callbacks.onTauntReceived?.(taunt);
      }
    });

    // 6. Player Left Room
    this.channel.on('broadcast', { event: 'player_left' }, ({ payload }) => {
      const playerId = payload?.playerId as string;
      const playerName = payload?.playerName as string;
      if (playerId) {
        this.roomPlayers = this.roomPlayers.filter((p) => p.id !== playerId);
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);
        this.callbacks.onPlayerLeft?.(playerId, playerName);
      }
    });

    // Subscribe to channel
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setStatus('connected');
        this.callbacks.onRoomPlayersUpdate?.(this.roomPlayers);

        // If guest just joined, announce arrival to host
        if (!isHost && this.myPlayer) {
          this.channel?.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: { player: this.myPlayer },
          });
        }
      } else if (status === 'CLOSED') {
        this.setStatus('disconnected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setStatus('error');
        this.callbacks.onError?.('Multiplayer connection issue. Please check network.');
      }
    });
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
      console.warn('Failed to broadcast room players:', err?.message);
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
      console.warn('Failed to broadcast game start:', err?.message);
    }
  }

  /**
   * Broadcast an updated game state after a card play, draw, pass, color choice, or rival action.
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
      console.warn('Failed to broadcast game state:', err?.message);
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
      console.warn('Failed to broadcast taunt:', err?.message);
      return null;
    }
  }

  /**
   * Leave the current room and unsubscribe from channel.
   */
  public async leaveRoom(): Promise<void> {
    if (this.channel) {
      if (this.myPlayer) {
        try {
          await this.channel.send({
            type: 'broadcast',
            event: 'player_left',
            payload: {
              playerId: this.myPlayer.id,
              playerName: this.myPlayer.name,
            },
          });
        } catch {
          // Ignore during cleanup
        }
      }

      try {
        await supabase.removeChannel(this.channel);
      } catch {
        // Ignore channel removal errors
      }
    }

    this.channel = null;
    this.currentRoomCode = null;
    this.myPlayer = null;
    this.roomPlayers = [];
    this.setStatus('disconnected');
  }
}

export const multiplayerService = new MultiplayerService();
