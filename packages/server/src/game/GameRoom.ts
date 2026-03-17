import { randomBytes } from 'crypto';
import {
  createInitialGameState,
  filterGameStateForPlayer,
  applyAction,
  applyReady,
  resolveCemeteryTransit,
  continueMultiJackSequence,
  resolveShifumiResult,
} from '@shit-head-palace/engine';
import type { GameState, GameVariant, GameAction, PendingShifumiResult } from '@shit-head-palace/engine';
import { runBotTurns, botActOnce, resolveFirstPlayerShifumi, canBotActOnPendingAction } from './bot';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface RoomPlayer {
  userId: string;
  username: string;
  /** In-game player ID (engine-side) */
  playerId: string;
  /** Socket ID — null when disconnected */
  socketId: string | null;
  isBot: boolean;
  /** Bot difficulty level (only for bots). */
  botDifficulty?: BotDifficulty;
  /** Timestamp when the player disconnected, for reconnection timeout */
  disconnectedAt: number | null;
}

export interface RoomConfig {
  maxPlayers: number;
  variant: GameVariant;
  isPublic: boolean;
  /** Join code for private rooms */
  joinCode: string | null;
  /** User ID of the room creator */
  creatorId: string;
  /** Display name for the room */
  name: string;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  type: 'player' | 'system';
}

/** Reconnection timeout in milliseconds (60 seconds). */
export const RECONNECT_TIMEOUT_MS = 60_000;

/** Bot turn delay in milliseconds. */
const BOT_DELAY_MS = 1500;

/** Delay before resolving cemetery transit (jack pile cleanup). */
const CEMETERY_TRANSIT_DELAY_MS = 1500;

/** Delay for burn cemetery transit: play anim (~1050ms) + overlay display (1500ms) + exit anim (600ms) + buffer (350ms). */
const BURN_CEMETERY_DELAY_MS = 3500;

/** Delay between each multi-jack step (revolution animation). */
const MULTI_JACK_STEP_DELAY_MS = 1500;

/** Delay for overlay animation before showing jack power popup. */
const OVERLAY_DELAY_MS = 1500;

/** Delay before auto-resolving a shifumi result popup (3 seconds). */
const SHIFUMI_RESULT_DELAY_MS = 3000;

/** Delay for the manouche card exchange animation on the client (1.6 seconds). */
const MANOUCHE_ANIM_MS = 2200;

/** Delay for the shifumi loser overlay animation on the client (2 seconds). */
const SHIFUMI_LOSER_OVERLAY_MS = 2000;

const MAX_CHAT_MESSAGE_LENGTH = 200;
const MAX_CHAT_HISTORY = 100;

// ─── GameRoom ───────────────────────────────────────────────────────────────────

export class GameRoom {
  readonly id: string;
  readonly config: RoomConfig;
  status: RoomStatus = 'waiting';
  players: RoomPlayer[] = [];
  readyPlayers = new Set<string>();
  spectatorSocketIds: Set<string> = new Set();
  state: GameState | null = null;
  chatMessages: ChatMessage[] = [];

  /** Extra data to include in the next broadcast event (cleared after broadcast). */
  broadcastExtra: Record<string, unknown> | null = null;

  /** Callbacks set by the Socket.IO layer to broadcast state. */
  private onBroadcast: ((room: GameRoom) => void) | null = null;
  private onPlayerReplacedCallback: ((room: GameRoom, playerId: string, originalName: string) => void) | null = null;
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(id: string, config: RoomConfig) {
    this.id = id;
    this.config = config;
  }

  /** Register the broadcast callback (called by Socket.IO wiring). */
  setBroadcast(fn: (room: GameRoom) => void): void {
    this.onBroadcast = fn;
  }

  /** Register callback for when a disconnected player is replaced by a bot. */
  setOnPlayerReplaced(fn: (room: GameRoom, playerId: string, originalName: string) => void): void {
    this.onPlayerReplacedCallback = fn;
  }

  // ─── Lobby ──────────────────────────────────────────────────────────────────

  /** Number of human player slots currently filled. */
  get humanCount(): number {
    return this.players.filter((p) => !p.isBot).length;
  }

  /** Number of bot player slots currently filled. */
  get botCount(): number {
    return this.players.filter((p) => p.isBot).length;
  }

  /** Player IDs of currently disconnected human players (for client display). */
  get disconnectedPlayerIds(): string[] {
    return this.players
      .filter((p) => !p.isBot && p.disconnectedAt !== null)
      .map((p) => p.playerId);
  }

  /** Whether the room can accept more players. */
  get canJoin(): boolean {
    return this.status === 'waiting' && this.players.length < this.config.maxPlayers;
  }

  /** Add a human player to the room. Returns the RoomPlayer. */
  addPlayer(userId: string, username: string, socketId: string): RoomPlayer {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    if (this.players.length >= this.config.maxPlayers) {
      throw new Error('Room is full');
    }
    if (this.players.some((p) => p.userId === userId && !p.isBot)) {
      throw new Error('Already in this room');
    }

    const playerId = `player-${userId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    const player: RoomPlayer = {
      userId,
      username,
      playerId,
      socketId,
      isBot: false,
      disconnectedAt: null,
    };
    this.players.push(player);
    return player;
  }

  /** Remove a human player from the waiting room. */
  removePlayer(userId: string): void {
    if (this.status !== 'waiting') {
      throw new Error('Cannot leave a game in progress');
    }
    this.players = this.players.filter((p) => p.userId !== userId || p.isBot);
    this.readyPlayers.delete(userId);
  }

  /** Add a bot to the waiting room. Returns the RoomPlayer. */
  addBot(difficulty: BotDifficulty): RoomPlayer {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    if (this.players.length >= this.config.maxPlayers) {
      throw new Error('Room is full');
    }

    const botIndex = this.botCount + 1;
    const diffLabel = difficulty === 'easy' ? 'Facile' : difficulty === 'medium' ? 'Moyen' : 'Expert';
    const botId = `bot-${botIndex}-${randomBytes(3).toString('hex')}`;
    const bot: RoomPlayer = {
      userId: botId,
      username: `Bot ${botIndex} (${diffLabel})`,
      playerId: botId,
      socketId: null,
      isBot: true,
      botDifficulty: difficulty,
      disconnectedAt: null,
    };
    this.players.push(bot);
    return bot;
  }

  /** Remove a bot from the waiting room. */
  removeBot(botId: string): void {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    const idx = this.players.findIndex((p) => p.userId === botId && p.isBot);
    if (idx === -1) {
      throw new Error('Bot not found');
    }
    this.players.splice(idx, 1);
  }

  /** Mark a player as ready or not ready. */
  setReady(userId: string, ready: boolean): void {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) {
      throw new Error('Player not found');
    }
    if (ready) {
      this.readyPlayers.add(userId);
    } else {
      this.readyPlayers.delete(userId);
    }
  }

  /** Check if a player is ready. */
  isReady(userId: string): boolean {
    return this.readyPlayers.has(userId);
  }

  /** Update the game variant (creator only, waiting room only). */
  updateVariant(variant: GameVariant): void {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    if (this.players.length > variant.playerCount) {
      throw new Error('Too many players for this variant');
    }
    this.config.variant = variant;
    this.config.maxPlayers = variant.playerCount;
    this.readyPlayers.clear();
  }

  /** Fill remaining slots with bots. */
  fillWithBots(): void {
    let botIndex = this.botCount;
    while (this.players.length < this.config.maxPlayers) {
      botIndex++;
      const botId = `bot-${botIndex}-${randomBytes(3).toString('hex')}`;
      this.players.push({
        userId: botId,
        username: `Bot ${botIndex}`,
        playerId: botId,
        socketId: null,
        isBot: true,
        botDifficulty: 'easy',
        disconnectedAt: null,
      });
    }
  }

  // ─── Game lifecycle ─────────────────────────────────────────────────────────

  /** Start the game. Fills remaining slots with bots. */
  start(): void {
    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }
    if (this.humanCount < 1) {
      throw new Error('Need at least 1 human player');
    }

    this.fillWithBots();
    this.status = 'playing';

    const playerDefs = this.players.map((p) => ({
      id: p.playerId,
      name: p.username,
      isBot: p.isBot,
      botDifficulty: p.isBot ? (p.botDifficulty ?? ('easy' as const)) : undefined,
    }));

    this.state = createInitialGameState(this.id, playerDefs, this.config.variant);

    // Bots ready immediately
    for (const p of this.players) {
      if (p.isBot) {
        this.state = applyReady(this.state, p.playerId, Date.now());
      }
    }
  }

  /** Handle a game action from a player. */
  handleAction(userId: string, action: GameAction): void {
    if (!this.state || this.status !== 'playing') {
      throw new Error('Game not in progress');
    }

    // Block all player actions during overlay animations and cemetery transit
    if (this.state.pendingActionDelayed || this.state.pendingCemeteryTransit) {
      throw new Error('Action blocked: overlay or cemetery transit in progress');
    }

    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) {
      throw new Error('Player not found in this room');
    }

    const prevState = this.state;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.state = applyAction(this.state, player.playerId, action as any, Date.now());

    // Auto-resolve first player shifumi
    if (this.state.pendingAction?.type === 'firstPlayerShifumi') {
      this.state = resolveFirstPlayerShifumi(this.state);
    }

    if (this.state.phase === 'finished') {
      this.status = 'finished';
    }

    // [MULTI-JACK] diagnostic after handleAction
    if (this.state?.multiJackSequence) {
      console.log('[MULTI-JACK] handleAction result:',
        'pendingAction:', this.state.pendingAction?.type ?? 'null',
        'remaining:', this.state.multiJackSequence?.remainingSequence?.length ?? 0,
        'phase:', this.state.phase,
        'lastPower:', this.state.lastPowerTriggered?.type ?? 'null',
        'needsContinuation:', this.needsMultiJackContinuation());
    }

    this.broadcast();

    // Shifumi result popup: auto-resolve after 3s delay
    if (this.state.pendingAction?.type === 'shifumiResult') {
      this.scheduleShifumiResultResolution();
      return;
    }

    // Overlay delay: show jack in pile + overlay animation before popup
    if (this.needsOverlayDelay()) {
      this.scheduleOverlayDelay();
      return;
    }

    // Manouche exchange animation delay
    if (this.hasManoucheExchangeJustCompleted(prevState)) {
      this.scheduleManoucheAnimDelay();
      return;
    }

    // Multi-jack continuation, cemetery transit, or bot scheduling
    if (this.needsMultiJackContinuation()) {
      this.scheduleMultiJackContinuation();
    } else if (this.state.pendingCemeteryTransit && !this.state.pendingAction) {
      // Use longer delay for burn so the overlay plays fully before cards transit
      const isBurn = this.state.lastPowerTriggered?.type === 'burn';
      const delay = isBurn ? BURN_CEMETERY_DELAY_MS : CEMETERY_TRANSIT_DELAY_MS;
      setTimeout(() => {
        if (!this.state) return;
        this.state = resolveCemeteryTransit(this.state);
        if (this.state.phase === 'finished') {
          this.status = 'finished';
        }
        this.broadcast();
        if (this.needsMultiJackContinuation()) {
          this.scheduleMultiJackContinuation();
        } else {
          this.scheduleBotIfNeeded();
        }
      }, delay);
    } else {
      this.scheduleBotIfNeeded();
    }
  }

  // ─── State filtering ────────────────────────────────────────────────────────

  /** Get filtered state for a specific player. */
  getStateForPlayer(playerId: string): GameState | null {
    if (!this.state) return null;
    return filterGameStateForPlayer(this.state, playerId);
  }

  /** Get filtered state for a spectator (no hidden cards visible). */
  getStateForSpectator(): GameState | null {
    if (!this.state) return null;
    // Use a non-existent player ID so all cards are hidden
    return filterGameStateForPlayer(this.state, '__spectator__');
  }

  /** Get the playerId for a userId. */
  getPlayerId(userId: string): string | null {
    return this.players.find((p) => p.userId === userId && !p.isBot)?.playerId ?? null;
  }

  // ─── Bots ───────────────────────────────────────────────────────────────────

  private get botIds(): string[] {
    return this.players.filter((p) => p.isBot).map((p) => p.playerId);
  }

  private get humanPlayerIds(): string[] {
    return this.players.filter((p) => !p.isBot).map((p) => p.playerId);
  }

  private needsOverlayDelay(): boolean {
    return !!this.state?.pendingActionDelayed;
  }

  private scheduleOverlayDelay(): void {
    setTimeout(() => {
      if (!this.state) return;
      this.state = { ...this.state, pendingActionDelayed: undefined, lastPowerTriggered: null };
      this.broadcast();
      // After overlay, the popup is now visible — bot may need to act on it
      this.scheduleBotIfNeeded();
    }, OVERLAY_DELAY_MS);
  }

  private hasManoucheExchangeJustCompleted(prev: GameState): boolean {
    if (!this.state || this.state.log.length <= prev.log.length) return false;
    const newEntries = this.state.log.slice(prev.log.length);
    return newEntries.some((e) =>
      (e.type === 'manouchePick' && e.data.takeCardId) ||
      e.type === 'superManouchePick'
    );
  }

  private scheduleManoucheAnimDelay(): void {
    setTimeout(() => {
      if (!this.state) return;
      // Resolve cemetery transit (J♠ → graveyard) after manouche animation
      if (this.state.pendingCemeteryTransit && !this.state.pendingAction) {
        this.state = resolveCemeteryTransit(this.state);
        if (this.state.phase === 'finished') {
          this.status = 'finished';
        }
        this.broadcast();
      }
      if (this.needsMultiJackContinuation()) {
        this.scheduleMultiJackContinuation();
      } else {
        this.scheduleBotIfNeeded();
      }
    }, MANOUCHE_ANIM_MS);
  }

  private needsMultiJackContinuation(): boolean {
    return (
      !!this.state?.multiJackSequence &&
      !this.state.pendingAction &&
      !this.state.pendingCemeteryTransit &&
      this.state.phase !== 'finished'
    );
  }

  private scheduleMultiJackContinuation(): void {
    console.log('[MULTI-JACK] scheduleMultiJackContinuation scheduled');
    setTimeout(() => {
      if (!this.state) return;

      console.log('[MULTI-JACK] room continuing, before:',
        'pendingAction:', this.state.pendingAction?.type ?? 'null',
        'remaining:', this.state.multiJackSequence?.remainingSequence?.length ?? 0,
        'phase:', this.state.phase);

      this.state = continueMultiJackSequence(this.state, Date.now());

      console.log('[MULTI-JACK] room continuing, after:',
        'pendingAction:', this.state.pendingAction?.type ?? 'null',
        'multiJackSequence:', !!this.state.multiJackSequence,
        'remaining:', this.state.multiJackSequence?.remainingSequence?.length ?? 0,
        'phase:', this.state.phase,
        'lastPower:', this.state.lastPowerTriggered?.type ?? 'null',
        'needsContinuation:', this.needsMultiJackContinuation());

      if (this.state.phase === 'finished') {
        this.status = 'finished';
      }
      this.broadcast();

      if (this.needsOverlayDelay()) {
        this.scheduleOverlayDelay();
      } else if (this.state.pendingAction?.type === 'shifumiResult') {
        this.scheduleShifumiResultResolution();
      } else if (this.needsMultiJackContinuation()) {
        this.scheduleMultiJackContinuation();
      } else if (this.state.pendingCemeteryTransit && !this.state.pendingAction) {
        setTimeout(() => {
          if (!this.state) return;
          this.state = resolveCemeteryTransit(this.state);
          if (this.state.phase === 'finished') {
            this.status = 'finished';
          }
          this.broadcast();
          this.scheduleBotIfNeeded();
        }, CEMETERY_TRANSIT_DELAY_MS);
      } else {
        this.scheduleBotIfNeeded();
      }
    }, MULTI_JACK_STEP_DELAY_MS);
  }

  private scheduleShifumiResultResolution(): void {
    setTimeout(() => {
      if (!this.state) return;
      if (this.state.pendingAction?.type !== 'shifumiResult') return;

      const originalState = this.state;
      const prevResult = originalState.pendingAction as PendingShifumiResult;

      // Pre-compute the real final state
      const finalState = resolveShifumiResult(originalState, Date.now());

      // TIE: send resolved state (new shifumi round), do NOT resolve cemetery transit
      if (prevResult.result === 'tie') {
        this.state = finalState;
        this.broadcast();
        // New round: if it's a shifumiResult again, schedule resolution; otherwise let bots act
        if (finalState.pendingAction?.type === 'shifumiResult') {
          this.scheduleShifumiResultResolution();
        } else {
          this.scheduleBotIfNeeded();
        }
        return;
      }

      // DECISIVE result
      const showLoserOverlay = prevResult.shifumiType !== 'firstPlayer';

      if (!showLoserOverlay) {
        this.state = finalState;
        if (this.state.phase === 'finished') this.status = 'finished';
        this.broadcast();
        this.scheduleBotIfNeeded();
        return;
      }

      const loserId = prevResult.result === 'player1' ? prevResult.player2Id : prevResult.player1Id;
      const isSuper = prevResult.shifumiType === 'super';
      const hadCemeteryTransit = !!originalState.pendingCemeteryTransit;

      // Step 1: Intermediate state — dismiss modal, resolve cemetery transit (no pickup yet)
      let intermediateState: GameState = { ...originalState, pendingAction: null, lastPowerTriggered: null };
      if (hadCemeteryTransit) {
        intermediateState = resolveCemeteryTransit(intermediateState);
      }
      this.state = intermediateState;
      this.broadcast();

      // Step 2: After cemetery transit animation, trigger overlay
      const transitDelay = hadCemeteryTransit ? CEMETERY_TRANSIT_DELAY_MS : 0;
      setTimeout(() => {
        if (!this.state) return;

        // Re-send state with overlay signal
        this.broadcastExtra = { shifumiLoserOverlay: { loserId, isSuper } };
        this.broadcast();

        // Step 3: After overlay, send final state (triggers pile→hand animation)
        setTimeout(() => {
          if (!this.state) return;

          this.state = finalState;
          if (this.state.phase === 'finished') this.status = 'finished';
          this.broadcast();

          if (finalState.phase === 'finished') return;
          if (this.needsMultiJackContinuation()) {
            this.scheduleMultiJackContinuation();
          } else {
            this.scheduleBotIfNeeded();
          }
        }, SHIFUMI_LOSER_OVERLAY_MS);
      }, transitDelay);
    }, SHIFUMI_RESULT_DELAY_MS);
  }

  private scheduleBotIfNeeded(): void {
    if (!this.state) return;
    const { phase } = this.state;
    if (phase !== 'playing' && phase !== 'revolution' && phase !== 'superRevolution') return;

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    const currentIsBot = currentPlayer && this.botIds.includes(currentPlayer.id);
    const hasBotPending = canBotActOnPendingAction(this.state, this.botIds);

    if (!currentIsBot && !hasBotPending) return;

    // Add extra delay when a power overlay is playing on the client
    const botDelay = BOT_DELAY_MS + (this.state.lastPowerTriggered ? OVERLAY_DELAY_MS : 0);

    setTimeout(() => {
      if (!this.state) return;
      const prev = this.state;
      this.state = botActOnce(this.state, this.botIds, this.humanPlayerIds);

      if (this.state !== prev) {
        // [MULTI-JACK] diagnostic after bot action in room
        if (this.state.multiJackSequence) {
          console.log('[MULTI-JACK] room after bot action:',
            'pendingAction:', this.state.pendingAction?.type ?? 'null',
            'remaining:', this.state.multiJackSequence?.remainingSequence?.length ?? 0,
            'phase:', this.state.phase,
            'needsContinuation:', this.needsMultiJackContinuation());
        }

        if (this.state.phase === 'finished') {
          this.status = 'finished';
        }
        this.broadcast();

        // Overlay delay, manouche anim, shifumi result popup, multi-jack continuation, cemetery transit, or next bot
        if (this.needsOverlayDelay()) {
          this.scheduleOverlayDelay();
        } else if (this.hasManoucheExchangeJustCompleted(prev)) {
          this.scheduleManoucheAnimDelay();
        } else if (this.state.pendingAction?.type === 'shifumiResult') {
          this.scheduleShifumiResultResolution();
        } else if (this.needsMultiJackContinuation()) {
          this.scheduleMultiJackContinuation();
        } else if (this.state.pendingCemeteryTransit && !this.state.pendingAction) {
          const isBotBurn = this.state.lastPowerTriggered?.type === 'burn';
          const botCemeteryDelay = isBotBurn ? BURN_CEMETERY_DELAY_MS : CEMETERY_TRANSIT_DELAY_MS;
          setTimeout(() => {
            if (!this.state) return;
            this.state = resolveCemeteryTransit(this.state);
            if (this.state.phase === 'finished') {
              this.status = 'finished';
            }
            this.broadcast();
            if (this.needsMultiJackContinuation()) {
              this.scheduleMultiJackContinuation();
            } else {
              this.scheduleBotIfNeeded();
            }
          }, botCemeteryDelay);
        } else {
          this.scheduleBotIfNeeded();
        }
      }
    }, botDelay);
  }

  // ─── Reconnection ──────────────────────────────────────────────────────────

  /** Mark a player as disconnected and start reconnection timer. */
  handleDisconnect(userId: string): void {
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) return;

    player.socketId = null;
    player.disconnectedAt = Date.now();

    if (this.status === 'playing') {
      const timer = setTimeout(() => {
        this.replaceWithBot(userId);
      }, RECONNECT_TIMEOUT_MS);
      this.reconnectTimers.set(userId, timer);
    }
  }

  /** Reconnect a player (within the timeout window). */
  handleReconnect(userId: string, socketId: string): boolean {
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) return false;

    // Clear reconnection timer
    const timer = this.reconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(userId);
    }

    player.socketId = socketId;
    player.disconnectedAt = null;
    return true;
  }

  /** Replace a disconnected player with a bot. */
  private replaceWithBot(userId: string): void {
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) return;

    const originalName = player.username;
    const playerId = player.playerId;

    this.reconnectTimers.delete(userId);
    player.isBot = true;
    player.username = `Bot (${player.username})`;
    player.socketId = null;
    player.disconnectedAt = null;

    // Update engine state player name to reflect bot replacement
    if (this.state) {
      const enginePlayer = this.state.players.find((p) => p.id === playerId);
      if (enginePlayer) {
        enginePlayer.name = player.username;
      }
    }

    if (this.onPlayerReplacedCallback) {
      this.onPlayerReplacedCallback(this, playerId, originalName);
    }

    // If it's now the bot's turn, schedule bot action
    this.scheduleBotIfNeeded();
    this.broadcast();
  }

  /**
   * Force-remove a human player from an active game by replacing with a bot.
   * Clears any pending reconnection timer. If other humans remain, schedules
   * bot turns and broadcasts. Returns true if a player was replaced.
   */
  forceRemovePlayer(userId: string): boolean {
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) return false;

    const timer = this.reconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(userId);
    }

    player.isBot = true;
    player.username = `Bot (${player.username})`;
    player.socketId = null;
    player.disconnectedAt = null;

    // Update engine state player name to reflect bot replacement
    if (this.state) {
      const enginePlayer = this.state.players.find((p) => p.id === player.playerId);
      if (enginePlayer) {
        enginePlayer.name = player.username;
      }
    }

    // Continue the game for remaining humans
    if (this.humanCount > 0 && this.status === 'playing') {
      this.scheduleBotIfNeeded();
      this.broadcast();
    }

    return true;
  }

  // ─── Spectators ─────────────────────────────────────────────────────────────

  addSpectator(socketId: string): void {
    this.spectatorSocketIds.add(socketId);
  }

  removeSpectator(socketId: string): void {
    this.spectatorSocketIds.delete(socketId);
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  /** Add a player chat message. Returns the ChatMessage or null if invalid. */
  addChatMessage(userId: string, message: string): ChatMessage | null {
    const player = this.players.find((p) => p.userId === userId && !p.isBot);
    if (!player) return null;

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return null;

    const chatMsg: ChatMessage = {
      id: randomBytes(6).toString('hex'),
      playerId: player.playerId,
      playerName: player.username,
      message: trimmed,
      timestamp: Date.now(),
      type: 'player',
    };

    this.chatMessages.push(chatMsg);
    if (this.chatMessages.length > MAX_CHAT_HISTORY) {
      this.chatMessages.splice(0, this.chatMessages.length - MAX_CHAT_HISTORY);
    }
    return chatMsg;
  }

  /** Add a system chat message. Returns the ChatMessage. */
  addSystemMessage(text: string): ChatMessage {
    const chatMsg: ChatMessage = {
      id: randomBytes(6).toString('hex'),
      playerId: '__system__',
      playerName: 'Système',
      message: text,
      timestamp: Date.now(),
      type: 'system',
    };

    this.chatMessages.push(chatMsg);
    if (this.chatMessages.length > MAX_CHAT_HISTORY) {
      this.chatMessages.splice(0, this.chatMessages.length - MAX_CHAT_HISTORY);
    }
    return chatMsg;
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────────

  private broadcast(): void {
    if (this.onBroadcast) {
      this.onBroadcast(this);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  /** Clean up all timers. */
  dispose(): void {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }

  // ─── Serialization for lobby listing ────────────────────────────────────────

  /** Return a lobby-safe summary (no game state). */
  toLobbySummary(): {
    id: string;
    name: string;
    status: RoomStatus;
    playerCount: number;
    maxPlayers: number;
    variantName: string;
    creatorId: string;
    isPublic: boolean;
    joinCode: string | null;
    variant: GameVariant;
    players: { userId: string; username: string; ready: boolean; isBot?: boolean; botDifficulty?: BotDifficulty }[];
  } {
    return {
      id: this.id,
      name: this.config.name,
      status: this.status,
      playerCount: this.players.length,
      maxPlayers: this.config.maxPlayers,
      variantName: this.config.variant.name,
      creatorId: this.config.creatorId,
      isPublic: this.config.isPublic,
      joinCode: this.config.joinCode,
      variant: this.config.variant,
      players: this.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        ready: p.isBot ? true : this.readyPlayers.has(p.userId),
        ...(p.isBot ? { isBot: true, botDifficulty: p.botDifficulty } : {}),
      })),
    };
  }
}

/** Generate a 6-character alphanumeric join code. */
export function generateJoinCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}
