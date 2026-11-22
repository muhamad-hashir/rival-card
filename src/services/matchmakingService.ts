// src/services/matchmakingService.ts - Quick Match 1v1 Auto-Matchmaking Service using Supabase Rooms + Realtime
import { supabase, generateRoomCode, multiplayerService } from './supabase';
import {
  cleanupStaleRooms,
  compactGameStateForBroadcast,
  deleteRoomRecord,
  stampOnlineMatchTimer,
} from './multiplayerService';
import {
  QUICK_MATCH_SEARCH_TIMEOUT_SECONDS,
  selectNextQuickMatchBot,
} from '../constants/quickMatchBots';
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
  opponentLevel?: number;
  countsTowardCareerStats: boolean;
}

export type MatchmakingStatus = 'idle' | 'searching' | 'matched';

export interface MatchmakingCallbacks {
  onStatusChange?: (status: MatchmakingStatus) => void;
  onTick?: (seconds: number) => void;
  onMatchFound?: (result: MatchFoundResult) => void;
  onError?: (errorMessage: string) => void;
}

const QUICK_MATCH_ROOM_MAX_AGE_MS = 90_000;
const QUICK_MATCH_DB_TIMEOUT_MS = 1_100;
const QUICK_MATCH_POLL_INTERVAL_MS = 1_800;

async function runRoomQueryWithTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number = QUICK_MATCH_DB_TIMEOUT_MS
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class MatchmakingService {
  private status: MatchmakingStatus = 'idle';
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private roomPollTimer: NodeJS.Timeout | null = null;
  private waitingRoomCode: string | null = null;
  private lastBotId: string | null = null;
  private elapsedSeconds: number = 0;
  private callbacks: MatchmakingCallbacks = {};
  private activePlayer: QueuedPlayer | null = null;
  private isProcessingMatch: boolean = false;
  private searchEpoch: number = 0;

  public getStatus(): MatchmakingStatus {
    return this.status;
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public getActivePlayer(): QueuedPlayer | null {
    return this.activePlayer;
  }

  public getActiveWaitingRoomCode(): string | null {
    return this.waitingRoomCode;
  }

  /**
   * Starts searching Supabase `rooms` and Realtime queue for a live human 1v1 opponent.
   * Auto-deletes any empty waiting room and seamlessly starts a Quick Match bot game
   * if no human joins within `timeoutSeconds` (default: 6 seconds).
   */
  public async startMatchmaking(
    player: QueuedPlayer,
    callbacks: MatchmakingCallbacks,
    timeoutSeconds: number = QUICK_MATCH_SEARCH_TIMEOUT_SECONDS
  ): Promise<void> {
    // Advance epoch and silently clean up any prior search state/channel/timers/waiting room
    const myEpoch = ++this.searchEpoch;
    this.callbacks = {};
    this.isProcessingMatch = false;
    this.elapsedSeconds = 0;
    await this.cleanupChannel();
    await this.cleanupWaitingRoom();

    // If cancelMatchmaking() ran while cleanup was awaiting, abort immediately
    if (this.searchEpoch !== myEpoch) {
      return;
    }

    this.activePlayer = player;
    this.callbacks = callbacks;
    this.status = 'searching';
    this.elapsedSeconds = 0;
    this.isProcessingMatch = false;

    this.callbacks.onStatusChange?.('searching');
    this.callbacks.onTick?.(0);

    // 1. Ticker interval (1s)
    this.intervalTimer = setInterval(() => {
      if (this.searchEpoch !== myEpoch || this.status !== 'searching') return;
      this.elapsedSeconds += 1;
      this.callbacks.onTick?.(this.elapsedSeconds);
    }, 1000);

    // 2. 5-7s (default 6s) Zero-Empty-Lobby Fallback Timer
    this.timer = setTimeout(() => {
      if (this.searchEpoch !== myEpoch || this.status !== 'searching') return;
      void this.handleBotFallback(myEpoch);
    }, Math.max(0.05, timeoutSeconds) * 1000);

    // 3. Connect to Supabase Realtime Presence channel
    try {
      this.setupChannel(player, myEpoch);
    } catch (err: any) {
      console.warn('Matchmaking channel setup warning:', err?.message || err);
    }

    // 4. Search Supabase `rooms` for a waiting human opponent (or publish a clean waiting row)
    void this.tryJoinOrPublishWaitingRoom(player, myEpoch);
  }

  private async cleanupWaitingRoom(): Promise<void> {
    const code = this.waitingRoomCode;
    this.waitingRoomCode = null;
    if (this.roomPollTimer) {
      clearInterval(this.roomPollTimer);
      this.roomPollTimer = null;
    }
    if (code) {
      await deleteRoomRecord(code).catch(() => {});
    }
  }

  /**
   * Queries Supabase `rooms` for a live open waiting room (`status = 'waiting'`) first;
   * if none exists, creates a temporary waiting room row and cleans it up if no human joins.
   */
  private async tryJoinOrPublishWaitingRoom(player: QueuedPlayer, epoch: number): Promise<void> {
    if (this.searchEpoch !== epoch || this.status !== 'searching' || this.isProcessingMatch) {
      return;
    }

    cleanupStaleRooms().catch(() => {});

    const recentCutoffIso = new Date(Date.now() - QUICK_MATCH_ROOM_MAX_AGE_MS).toISOString();
    const listRes: any = await runRoomQueryWithTimeout(
      supabase
        .from('rooms')
        .select('code, host_id, status, player_count, players, created_at')
        .eq('status', 'waiting')
        .lt('player_count', 2)
        .neq('host_id', player.id)
        .gte('created_at', recentCutoffIso)
        .order('created_at', { ascending: false })
        .limit(5)
    );

    if (this.searchEpoch !== epoch || this.status !== 'searching' || this.isProcessingMatch) {
      return;
    }

    const openRooms = Array.isArray(listRes?.data) ? listRes.data : [];
    for (const candidate of openRooms) {
      const code = typeof candidate?.code === 'string' ? candidate.code.trim() : '';
      const hostId = typeof candidate?.host_id === 'string' ? candidate.host_id : '';
      if (!code || !hostId || hostId === player.id) continue;

      const existingPlayers: Array<{ id: string; name?: string; avatarId?: string }> =
        Array.isArray(candidate.players) ? candidate.players : [];
      if (existingPlayers.length >= 2) continue;

      const hostEntry = existingPlayers[0] || { id: hostId, name: 'Rival', avatarId: 'fox' };
      const claimedPlayers = [
        hostEntry,
        { id: player.id, name: player.name, avatarId: player.avatarId },
      ];

      const claimRes: any = await runRoomQueryWithTimeout(
        supabase
          .from('rooms')
          .update({
            status: 'playing',
            player_count: 2,
            players: claimedPlayers,
            updated_at: new Date().toISOString(),
          })
          .eq('code', code)
          .eq('status', 'waiting')
          .select('code')
      );

      if (this.searchEpoch !== epoch || this.status !== 'searching' || this.isProcessingMatch) {
        return;
      }

      if (Array.isArray(claimRes?.data) && claimRes.data.length > 0) {
        this.isProcessingMatch = true;
        this.status = 'matched';
        const activeCallbacks = this.callbacks;
        activeCallbacks.onStatusChange?.('matched');

        const initialState = stampOnlineMatchTimer(
          createGame(
            [
              {
                id: hostEntry.id,
                name: hostEntry.name || 'Rival',
                avatarId: hostEntry.avatarId || 'fox',
                isBot: false,
                countsTowardCareerStats: true,
              },
              {
                id: player.id,
                name: player.name,
                avatarId: player.avatarId,
                isBot: false,
                countsTowardCareerStats: true,
              },
            ],
            'multiplayer'
          )
        );

        await this.cleanupChannel();
        await this.cleanupWaitingRoom();
        if (this.searchEpoch !== epoch) return;

        try {
          await multiplayerService.joinRoom(code, {
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
          });
        } catch {
          // Join room fallback
        }

        if (this.searchEpoch !== epoch) return;

        activeCallbacks.onMatchFound?.({
          initialState,
          myPlayerId: player.id,
          roomCode: code,
          isBotMatch: false,
          opponentName: hostEntry.name || 'Rival',
          opponentAvatarId: hostEntry.avatarId || 'fox',
          countsTowardCareerStats: true,
        });
        return;
      }
    }

    // No open waiting room found — publish our temporary waiting room for live peers
    const waitingCode = generateRoomCode();
    if (this.searchEpoch !== epoch || this.status !== 'searching' || this.isProcessingMatch) {
      return;
    }

    this.waitingRoomCode = waitingCode;
    await runRoomQueryWithTimeout(
      supabase.from('rooms').insert({
        code: waitingCode,
        host_id: player.id,
        status: 'waiting',
        player_count: 1,
        players: [{ id: player.id, name: player.name, avatarId: player.avatarId }],
      })
    );

    // If timeout or cancel occurred while the insert was in flight, delete immediately
    if (this.searchEpoch !== epoch || this.status !== 'searching' || this.isProcessingMatch) {
      if (this.waitingRoomCode === waitingCode) {
        this.waitingRoomCode = null;
      }
      deleteRoomRecord(waitingCode).catch(() => {});
      return;
    }

    // Lightweight check in case a human claims this waiting room row before the 6s fallback
    this.roomPollTimer = setInterval(async () => {
      if (
        this.searchEpoch !== epoch ||
        this.status !== 'searching' ||
        this.isProcessingMatch ||
        this.waitingRoomCode !== waitingCode
      ) {
        return;
      }

      const rowRes: any = await runRoomQueryWithTimeout(
        supabase
          .from('rooms')
          .select('code, status, player_count, players')
          .eq('code', waitingCode)
          .single(),
        900
      );

      if (
        this.searchEpoch !== epoch ||
        this.status !== 'searching' ||
        this.isProcessingMatch
      ) {
        return;
      }

      const row = rowRes?.data;
      const roomPlayers = Array.isArray(row?.players) ? row.players : [];
      const joinedPeer = roomPlayers.find((p: any) => p?.id && p.id !== player.id);

      if (row?.status === 'playing' && joinedPeer) {
        this.isProcessingMatch = true;
        this.status = 'matched';
        const activeCallbacks = this.callbacks;
        activeCallbacks.onStatusChange?.('matched');

        const initialState = stampOnlineMatchTimer(
          createGame(
            [
              {
                id: player.id,
                name: player.name,
                avatarId: player.avatarId,
                isBot: false,
                countsTowardCareerStats: true,
              },
              {
                id: joinedPeer.id,
                name: joinedPeer.name || 'Rival',
                avatarId: joinedPeer.avatarId || 'fox',
                isBot: false,
                countsTowardCareerStats: true,
              },
            ],
            'multiplayer'
          )
        );

        this.waitingRoomCode = null;
        await this.cleanupChannel();
        if (this.searchEpoch !== epoch) return;

        try {
          await multiplayerService.createRoom(
            { id: player.id, name: player.name, avatarId: player.avatarId },
            waitingCode
          );
          await multiplayerService.startGame(initialState);
        } catch {
          // Non-fatal
        }

        if (this.searchEpoch !== epoch) return;

        activeCallbacks.onMatchFound?.({
          initialState,
          myPlayerId: player.id,
          roomCode: waitingCode,
          isBotMatch: false,
          opponentName: joinedPeer.name || 'Rival',
          opponentAvatarId: joinedPeer.avatarId || 'fox',
          countsTowardCareerStats: true,
        });
      }
    }, QUICK_MATCH_POLL_INTERVAL_MS);
  }

  /**
   * Subscribes to the matchmaking channel and listens for queue peers & match broadcasts.
   */
  private setupChannel(player: QueuedPlayer, epoch: number): void {
    const channelName = 'matchmaking:1v1';
    const chan = supabase.channel(channelName, {
      config: {
        presence: { key: player.id },
        broadcast: { self: false },
      },
    });
    this.channel = chan;

    // Handle broadcast match_created
    chan.on('broadcast', { event: 'match_created' }, async ({ payload }) => {
      if (this.searchEpoch !== epoch || this.isProcessingMatch || this.status !== 'searching') return;

      if (payload?.targetId === player.id) {
        this.isProcessingMatch = true;
        this.status = 'matched';
        const activeCallbacks = this.callbacks;
        activeCallbacks.onStatusChange?.('matched');

        const roomCode = payload.roomCode as string;
        const initialState = payload.initialState as GameState;
        const coordinator = payload.coordinator as QueuedPlayer;

        await this.cleanupChannel();
        await this.cleanupWaitingRoom();
        if (this.searchEpoch !== epoch) return;

        try {
          await multiplayerService.joinRoom(roomCode, {
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
          });
        } catch {
          // Join room fallback
        }

        if (this.searchEpoch !== epoch) return;

        activeCallbacks.onMatchFound?.({
          initialState,
          myPlayerId: player.id,
          roomCode,
          isBotMatch: false,
          opponentName: coordinator?.name || 'Rival',
          opponentAvatarId: coordinator?.avatarId || 'fox',
          countsTowardCareerStats: true,
        });
      }
    });

    // Handle Presence sync
    chan.on('presence', { event: 'sync' }, () => {
      if (this.searchEpoch !== epoch) return;
      this.evaluatePresence(player, epoch);
    });

    chan.subscribe(async (status) => {
      if (this.searchEpoch !== epoch || this.channel !== chan) return;
      if (status === 'SUBSCRIBED') {
        try {
          await chan.track({
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
  private async evaluatePresence(player: QueuedPlayer, epoch: number): Promise<void> {
    if (
      this.searchEpoch !== epoch ||
      this.isProcessingMatch ||
      this.status !== 'searching' ||
      !this.channel
    ) {
      return;
    }

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
              avatarId: opp.avatarId || 'fox',
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
      const activeCallbacks = this.callbacks;
      activeCallbacks.onStatusChange?.('matched');

      const roomCode = generateRoomCode();
      const initialState = stampOnlineMatchTimer(
        createGame(
          [
            {
              id: player.id,
              name: player.name,
              avatarId: player.avatarId,
              isBot: false,
              countsTowardCareerStats: true,
            },
            {
              id: opponent.id,
              name: opponent.name,
              avatarId: opponent.avatarId,
              isBot: false,
              countsTowardCareerStats: true,
            },
          ],
          'multiplayer'
        )
      );
      const compactInitialState = compactGameStateForBroadcast(initialState);

      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'match_created',
          payload: {
            coordinator: player,
            targetId: opponent.id,
            roomCode,
            initialState: compactInitialState,
          },
        });
      } catch (err: any) {
        console.warn('Failed to broadcast match_created:', err?.message || err);
      }

      await this.cleanupChannel();
      await this.cleanupWaitingRoom();
      if (this.searchEpoch !== epoch) return;

      try {
        await multiplayerService.createRoom(
          { id: player.id, name: player.name, avatarId: player.avatarId },
          roomCode
        );
      } catch {
        // Room creation fallback
      }

      if (this.searchEpoch !== epoch) return;

      activeCallbacks.onMatchFound?.({
        initialState,
        myPlayerId: player.id,
        roomCode,
        isBotMatch: false,
        opponentName: opponent.name,
        opponentAvatarId: opponent.avatarId,
        countsTowardCareerStats: true,
      });
    }
  }

  /**
   * 6-Second Zero-Empty-Lobby Fallback: deletes any empty waiting room in Supabase
   * and launches a Quick Match seeded from the smart undercover / signature bot rotation.
   */
  public async handleBotFallback(expectedEpoch?: number): Promise<void> {
    const epoch = expectedEpoch ?? this.searchEpoch;
    if (
      this.searchEpoch !== epoch ||
      this.isProcessingMatch ||
      this.status !== 'searching' ||
      !this.activePlayer
    ) {
      return;
    }

    this.isProcessingMatch = true;
    this.status = 'matched';
    const player = this.activePlayer;
    const activeCallbacks = this.callbacks;

    // Clean up channel & empty Supabase waiting room asynchronously without blocking launch
    this.cleanupChannel().catch(() => {});
    this.cleanupWaitingRoom().catch(() => {});

    const botProfile = await selectNextQuickMatchBot({
      excludeBotId: this.lastBotId ?? undefined,
    });
    if (this.searchEpoch !== epoch) return;

    this.lastBotId = botProfile.id;
    activeCallbacks.onStatusChange?.('matched');

    const botOpponent = {
      id: botProfile.id,
      name: botProfile.name,
      isBot: true,
      avatarId: botProfile.avatarId,
      level: botProfile.level,
      countsTowardCareerStats: botProfile.countsTowardCareerStats,
    };

    const initialState = createGame(
      [
        { id: player.id, name: player.name, avatarId: player.avatarId, isBot: false },
        botOpponent,
      ],
      'vs_bot'
    );

    activeCallbacks.onMatchFound?.({
      initialState,
      myPlayerId: player.id,
      roomCode: 'BOT_MATCH',
      isBotMatch: true,
      opponentName: botOpponent.name,
      opponentAvatarId: botOpponent.avatarId,
      opponentLevel: botProfile.level,
      countsTowardCareerStats: botProfile.countsTowardCareerStats,
    });
  }

  /**
   * Cancels matchmaking queue, deletes any temporary waiting room, clears timers, and untracks presence.
   */
  public async cancelMatchmaking(): Promise<void> {
    this.searchEpoch += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.roomPollTimer) {
      clearInterval(this.roomPollTimer);
      this.roomPollTimer = null;
    }

    const prevCallbacks = this.callbacks;
    this.callbacks = {};
    this.status = 'idle';
    this.activePlayer = null;
    this.isProcessingMatch = false;
    this.elapsedSeconds = 0;

    await Promise.all([this.cleanupChannel(), this.cleanupWaitingRoom()]);

    prevCallbacks.onStatusChange?.('idle');
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
    if (this.roomPollTimer) {
      clearInterval(this.roomPollTimer);
      this.roomPollTimer = null;
    }

    const chan = this.channel;
    this.channel = null;

    if (chan) {
      try {
        await Promise.race([
          Promise.allSettled([
            Promise.resolve().then(() => chan.untrack()),
            Promise.resolve().then(() => supabase.removeChannel(chan)),
          ]),
          new Promise<void>((resolve) => setTimeout(resolve, 400)),
        ]);
      } catch {
        // ignore channel teardown errors
      }
    }
  }
}

export const matchmakingService = new MatchmakingService();
