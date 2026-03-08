import { randomBytes } from 'crypto';
import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { lobbyRouter } from './routes/lobby';
import { createMessagesRouter } from './routes/messages';
import { socketAuthMiddleware, type AuthenticatedSocket } from './middleware/socketAuth';
import { lobby } from './game/Lobby';
import { GameRoom, type ChatMessage } from './game/GameRoom';
import { prisma } from './lib/prisma';
import { chatSendSchema } from './lib/validation';
import {
  createInitialGameState,
  filterGameStateForPlayer,
  applyAction,
  applyReady,
  resolveCemeteryTransit,
  continueMultiJackSequence,
  applyRevolutionConfirm,
  resolveShifumiResult,
  validateVariant,
} from '@shit-head-palace/engine';
import type { GameState, GameVariant, GameAction, PlayerSetup, PendingShifumiResult } from '@shit-head-palace/engine';
import { runBotTurns, botActOnce, resolveFirstPlayerShifumi, canBotActOnPendingAction } from './game/bot';

// ─── Variant par défaut ────────────────────────────────────────────────────────

const DEFAULT_VARIANT: GameVariant = {
  name: 'Standard',
  powerAssignments: {
    burn: '10',
    reset: '2',
    under: '8',
    skip: '7',
    mirror: '9',
    target: 'A',
  },
  playerCount: 3,
  deckCount: 1,
};

// ─── Solo session (mode local contre bots) ──────────────────────────────────

interface SoloSession {
  state: GameState;
  humanId: string;
  botIds: string[];
}

const soloSessions = new Map<string, SoloSession>();

const BOT_NAMES = ['Bot A', 'Bot B', 'Bot C', 'Bot D', 'Bot E'];

function createSoloSession(socketId: string, variant: GameVariant = DEFAULT_VARIANT): SoloSession {
  const humanId = `human-${socketId.slice(0, 8)}`;
  const botCount = variant.playerCount - 1;
  const botIds: string[] = [];
  const playerSetups: PlayerSetup[] = [
    { id: humanId, name: 'Vous', isBot: false },
  ];

  for (let i = 0; i < botCount; i++) {
    const botId = `bot${i + 1}-${socketId.slice(0, 8)}`;
    botIds.push(botId);
    playerSetups.push({
      id: botId,
      name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
      isBot: true,
      botDifficulty: 'easy' as const,
    });
  }

  let state = createInitialGameState(socketId, playerSetups, variant);

  for (const botId of botIds) {
    state = applyReady(state, botId, Date.now());
  }

  return { state, humanId, botIds };
}

const IS_DEV = process.env.NODE_ENV !== 'production';

/** Delay before resolving cemetery transit (burn/jack animation). */
const CEMETERY_TRANSIT_DELAY_MS = 1500;

/** Delay between each multi-jack step (revolution animation). */
const MULTI_JACK_STEP_DELAY_MS = 1500;

/** Delay for overlay animation before showing jack power popup. */
const OVERLAY_DELAY_MS = 1500;

/** Bot turn delay in milliseconds (solo mode). */
const BOT_DELAY_MS = 1500;

/** Delay before auto-resolving a shifumi result popup (3 seconds). */
const SHIFUMI_RESULT_DELAY_MS = 3000;

/** Delay for the flop remake rainbow animation on the client (2.5 seconds). */
const FLOP_REMAKE_ANIM_MS = 2500;

/** Delay for the manouche card exchange animation on the client (1.6 seconds). */
const MANOUCHE_ANIM_MS = 2200;

/** Delay for the shifumi loser overlay animation on the client (2 seconds). */
const SHIFUMI_LOSER_OVERLAY_MS = 2000;

/** Returns true when state has a pending overlay delay (jack power animation before popup). */
function needsOverlayDelay(state: GameState): boolean {
  return !!state.pendingActionDelayed;
}

/** Returns true when the latest log entry is a flopRemakeDone (rainbow animation on client). */
function hasFlopRemakeJustCompleted(prev: GameState, next: GameState): boolean {
  if (next.log.length <= prev.log.length) return false;
  const lastEntry = next.log[next.log.length - 1];
  return lastEntry?.type === 'flopRemakeDone';
}

/** Returns true when a manouche/superManouche exchange just completed (not a skip). */
function hasManoucheExchangeJustCompleted(prev: GameState, next: GameState): boolean {
  if (next.log.length <= prev.log.length) return false;
  const newEntries = next.log.slice(prev.log.length);
  return newEntries.some((e) =>
    (e.type === 'manouchePick' && e.data.takeCardId) ||
    e.type === 'superManouchePick'
  );
}

/**
 * Clears the overlay delay flag from the session state, sends the updated state,
 * and continues with the next step (bot, cemetery transit, multi-jack, etc.).
 */
function scheduleOverlayDelay(socket: Socket, session: SoloSession): void {
  setTimeout(() => {
    const current = soloSessions.get(socket.id);
    if (!current || current !== session) return;
    session.state = { ...session.state, pendingActionDelayed: undefined, lastPowerTriggered: null };
    sendSoloState(socket, session);
    // After overlay, the popup is now visible — bot may need to act on it
    scheduleSoloBotIfNeeded(socket, session);
  }, OVERLAY_DELAY_MS);
}

function sendSoloState(socket: Socket, session: SoloSession, extra?: Record<string, unknown>): void {
  socket.emit('game:state', {
    state: IS_DEV
      ? session.state
      : filterGameStateForPlayer(session.state, session.humanId),
    playerId: session.humanId,
    ...extra,
  });
}

function scheduleSoloBotIfNeeded(socket: Socket, session: SoloSession): void {
  const { state, botIds } = session;
  if (
    state.phase !== 'playing' &&
    state.phase !== 'revolution' &&
    state.phase !== 'superRevolution'
  )
    return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentIsBot = currentPlayer && botIds.includes(currentPlayer.id);
  const hasBotPending = canBotActOnPendingAction(state, botIds);

  if (!currentIsBot && !hasBotPending) return;

  // Add extra delay when a power overlay is playing on the client
  const botDelay = BOT_DELAY_MS + (state.lastPowerTriggered ? OVERLAY_DELAY_MS : 0);

  setTimeout(() => {
    const current = soloSessions.get(socket.id);
    if (!current || current !== session) return;

    const prev = session.state;
    session.state = botActOnce(session.state, session.botIds, [session.humanId]);

    if (session.state !== prev) {
      // [MULTI-JACK] diagnostic after bot action
      if (session.state.multiJackSequence) {
        console.log('[MULTI-JACK] after bot action:',
          'pendingAction:', session.state.pendingAction?.type ?? 'null',
          'remaining:', session.state.multiJackSequence?.remainingSequence?.length ?? 0,
          'phase:', session.state.phase,
          'needsContinuation:', needsMultiJackContinuation(session.state));
      }

      sendSoloState(socket, session);

      // Overlay delay: show jack in pile + overlay animation before popup
      if (needsOverlayDelay(session.state)) {
        scheduleOverlayDelay(socket, session);
      } else if (hasFlopRemakeJustCompleted(prev, session.state)) {
        // Flop remake animation: wait 2.5s before scheduling next action
        setTimeout(() => {
          const stillCurrent = soloSessions.get(socket.id);
          if (!stillCurrent || stillCurrent !== session) return;
          // Resolve cemetery transit (J♥ + 9 → graveyard)
          if (session.state.pendingCemeteryTransit && !session.state.pendingAction) {
            session.state = resolveCemeteryTransit(session.state);
            sendSoloState(socket, session);
          }
          if (needsMultiJackContinuation(session.state)) {
            scheduleSoloMultiJackContinuation(socket, session);
          } else {
            scheduleSoloBotIfNeeded(socket, session);
          }
        }, FLOP_REMAKE_ANIM_MS);
      } else if (hasManoucheExchangeJustCompleted(prev, session.state)) {
        // Manouche exchange animation: wait 1.6s before scheduling next action
        setTimeout(() => {
          const stillCurrent = soloSessions.get(socket.id);
          if (!stillCurrent || stillCurrent !== session) return;
          // Resolve cemetery transit (J♠ → graveyard) after manouche animation
          if (session.state.pendingCemeteryTransit && !session.state.pendingAction) {
            session.state = resolveCemeteryTransit(session.state);
            sendSoloState(socket, session);
          }
          if (needsMultiJackContinuation(session.state)) {
            scheduleSoloMultiJackContinuation(socket, session);
          } else {
            scheduleSoloBotIfNeeded(socket, session);
          }
        }, MANOUCHE_ANIM_MS);
      } else if (session.state.pendingAction?.type === 'shifumiResult') {
        scheduleSoloShifumiResultResolution(socket, session);
      } else if (needsMultiJackContinuation(session.state)) {
        scheduleSoloMultiJackContinuation(socket, session);
      } else if (session.state.pendingCemeteryTransit && !session.state.pendingAction) {
        setTimeout(() => {
          const stillCurrent = soloSessions.get(socket.id);
          if (!stillCurrent || stillCurrent !== session) return;
          session.state = resolveCemeteryTransit(session.state);
          sendSoloState(socket, session);
          if (needsMultiJackContinuation(session.state)) {
            scheduleSoloMultiJackContinuation(socket, session);
          } else {
            scheduleSoloBotIfNeeded(socket, session);
          }
        }, CEMETERY_TRANSIT_DELAY_MS);
      } else {
        scheduleSoloBotIfNeeded(socket, session);
      }
    }
  }, botDelay);
}

/**
 * Returns true when a multi-jack sequence is in progress and the next step
 * is an immediate power (revolution/superRevolution) that needs server-driven
 * continuation (no pending action, no cemetery transit, game not finished).
 */
function needsMultiJackContinuation(state: GameState): boolean {
  return (
    !!state.multiJackSequence &&
    !state.pendingAction &&
    !state.pendingCemeteryTransit &&
    state.phase !== 'finished'
  );
}

/**
 * Schedules continuation of a multi-jack sequence in solo mode.
 * After a delay, calls continueMultiJackSequence to move the current jack
 * to graveyard and proceed to the next one.
 */
function scheduleSoloMultiJackContinuation(socket: Socket, session: SoloSession): void {
  console.log('[MULTI-JACK] scheduleSoloMultiJackContinuation scheduled');
  setTimeout(() => {
    const current = soloSessions.get(socket.id);
    if (!current || current !== session) return;

    console.log('[MULTI-JACK] continuing sequence, before:',
      'pendingAction:', session.state.pendingAction?.type ?? 'null',
      'remaining:', session.state.multiJackSequence?.remainingSequence?.length ?? 0,
      'phase:', session.state.phase);

    session.state = continueMultiJackSequence(session.state, Date.now());

    console.log('[MULTI-JACK] continuing sequence, after:',
      'pendingAction:', session.state.pendingAction?.type ?? 'null',
      'multiJackSequence:', !!session.state.multiJackSequence,
      'remaining:', session.state.multiJackSequence?.remainingSequence?.length ?? 0,
      'phase:', session.state.phase,
      'lastPower:', session.state.lastPowerTriggered?.type ?? 'null',
      'needsContinuation:', needsMultiJackContinuation(session.state));

    sendSoloState(socket, session);

    if (needsOverlayDelay(session.state)) {
      scheduleOverlayDelay(socket, session);
    } else if (session.state.pendingAction?.type === 'shifumiResult') {
      scheduleSoloShifumiResultResolution(socket, session);
    } else if (needsMultiJackContinuation(session.state)) {
      // Another immediate power in the sequence — continue
      scheduleSoloMultiJackContinuation(socket, session);
    } else if (session.state.pendingCemeteryTransit && !session.state.pendingAction) {
      setTimeout(() => {
        const c = soloSessions.get(socket.id);
        if (!c || c !== session) return;
        session.state = resolveCemeteryTransit(session.state);
        sendSoloState(socket, session);
        scheduleSoloBotIfNeeded(socket, session);
      }, CEMETERY_TRANSIT_DELAY_MS);
    } else {
      scheduleSoloBotIfNeeded(socket, session);
    }
  }, MULTI_JACK_STEP_DELAY_MS);
}

/**
 * Schedules auto-resolution of a PendingShifumiResult in solo mode.
 * Waits 3 seconds, then resolves the result and continues the game.
 */
function scheduleSoloShifumiResultResolution(socket: Socket, session: SoloSession): void {
  setTimeout(() => {
    const current = soloSessions.get(socket.id);
    if (!current || current !== session) return;
    if (session.state.pendingAction?.type !== 'shifumiResult') return;

    const originalState = session.state;
    const prevResult = originalState.pendingAction as PendingShifumiResult;

    // Pre-compute the real final state
    const finalState = resolveShifumiResult(originalState, Date.now());

    // TIE: send resolved state (new shifumi round), do NOT resolve cemetery transit
    if (prevResult.result === 'tie') {
      session.state = finalState;
      sendSoloState(socket, session);
      // New round: if it's a shifumiResult again, schedule resolution; otherwise let bots act
      if (finalState.pendingAction?.type === 'shifumiResult') {
        scheduleSoloShifumiResultResolution(socket, session);
      } else {
        scheduleSoloBotIfNeeded(socket, session);
      }
      return;
    }

    // DECISIVE result
    const showLoserOverlay = prevResult.shifumiType !== 'firstPlayer';

    if (!showLoserOverlay) {
      // firstPlayer: just resolve and continue
      session.state = finalState;
      sendSoloState(socket, session);
      scheduleSoloBotIfNeeded(socket, session);
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
    session.state = intermediateState;
    sendSoloState(socket, session);

    // Step 2: After cemetery transit animation, trigger overlay
    const transitDelay = hadCemeteryTransit ? CEMETERY_TRANSIT_DELAY_MS : 0;
    setTimeout(() => {
      const c = soloSessions.get(socket.id);
      if (!c || c !== session) return;

      // Re-send state with overlay signal (same state, client shows overlay)
      sendSoloState(socket, session, { shifumiLoserOverlay: { loserId, isSuper } });

      // Step 3: After overlay, send final state (triggers pile→hand animation)
      setTimeout(() => {
        const c2 = soloSessions.get(socket.id);
        if (!c2 || c2 !== session) return;

        session.state = finalState;
        sendSoloState(socket, session);

        if (finalState.phase === 'finished') return;
        if (needsMultiJackContinuation(finalState)) {
          scheduleSoloMultiJackContinuation(socket, session);
        } else {
          scheduleSoloBotIfNeeded(socket, session);
        }
      }, SHIFUMI_LOSER_OVERLAY_MS);
    }, transitDelay);
  }, SHIFUMI_RESULT_DELAY_MS);
}

/** Emit a system chat message to a solo socket. */
function emitSoloSystemMessage(socket: Socket, text: string): void {
  const msg: ChatMessage = {
    id: randomBytes(6).toString('hex'),
    playerId: '__system__',
    playerName: 'Système',
    message: text,
    timestamp: Date.now(),
    type: 'system',
  };
  socket.emit('chat:message', msg);
}

// ─── Room broadcast helper ──────────────────────────────────────────────────

function broadcastRoomState(room: GameRoom, io: Server): void {
  if (!room.state) return;

  const extra = room.broadcastExtra;
  room.broadcastExtra = null;

  // Send filtered state to each connected player
  for (const player of room.players) {
    if (player.socketId && !player.isBot) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit('game:state', {
          state: filterGameStateForPlayer(room.state, player.playerId),
          playerId: player.playerId,
          ...(extra ?? {}),
        });
      }
    }
  }

  // Send spectator state
  const spectatorState = room.getStateForSpectator();
  for (const spectatorSocketId of room.spectatorSocketIds) {
    const spectatorSocket = io.sockets.sockets.get(spectatorSocketId);
    if (spectatorSocket) {
      spectatorSocket.emit('game:state', {
        state: spectatorState,
        playerId: null,
      });
    }
  }
}

// ─── Express ───────────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: { origin: clientUrl, credentials: true },
});

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/lobby', lobbyRouter);
app.use('/messages', createMessagesRouter(io));

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.use(socketAuthMiddleware);

/**
 * Remove a user from a non-waiting room (playing or finished).
 * For playing rooms: replaces with bot. For finished rooms: removes from player list.
 * Cleans up empty rooms. Returns true if the user was cleaned up.
 */
function cleanupUserFromActiveRoom(userId: string, socketToLeave?: { leave: (room: string) => void }): boolean {
  const room = lobby.findRoomByUserId(userId);
  if (!room || room.status === 'waiting') return false;

  if (room.status === 'playing') {
    room.forceRemovePlayer(userId);
  } else {
    room.players = room.players.filter((p) => p.userId !== userId || p.isBot);
  }

  if (socketToLeave) {
    socketToLeave.leave(`room:${room.id}`);
  }

  if (room.humanCount === 0) {
    if (room.status !== 'finished') room.status = 'finished';
    lobby.removeRoom(room.id);
  }

  return true;
}

io.on('connection', (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket;
  const userId = socket.data.userId;
  const isAnonymous = socket.data.anonymous;

  console.log(`[+] ${socket.id}${userId ? ` (user: ${userId})` : ' (anonymous)'}`);

  // Clean up stale room membership from previous connection (e.g. hard refresh)
  if (userId) {
    cleanupUserFromActiveRoom(userId);
  }

  // ── Solo mode (anonymous or explicit) ─────────────────────────────────────

  socket.on('solo:start', (rawPayload?: unknown) => {
    let variant = DEFAULT_VARIANT;
    if (rawPayload && typeof rawPayload === 'object' && 'variant' in rawPayload) {
      const v = (rawPayload as { variant: unknown }).variant;
      if (v && typeof v === 'object' && 'name' in v && 'playerCount' in v && 'deckCount' in v && 'powerAssignments' in v) {
        const candidate = v as GameVariant;
        const errors = validateVariant(candidate);
        if (errors.length === 0) {
          variant = candidate;
        } else {
          socket.emit('game:error', { message: `Variante invalide: ${errors.map((e) => e.message).join('; ')}` });
          return;
        }
      }
    }
    const session = createSoloSession(socket.id, variant);
    soloSessions.set(socket.id, session);
    sendSoloState(socket, session);
    emitSoloSystemMessage(socket, 'La partie commence');
  });

  socket.on('solo:action', (rawAction: unknown) => {
    const s = soloSessions.get(socket.id);
    if (!s) return;

    try {
      const prevState = s.state;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.state = applyAction(s.state, s.humanId, rawAction as any, Date.now());

      if (s.state.pendingAction?.type === 'firstPlayerShifumi') {
        s.state = resolveFirstPlayerShifumi(s.state);
      }

      // [MULTI-JACK] diagnostic after solo:action
      if (s.state.multiJackSequence) {
        console.log('[MULTI-JACK] solo:action result:',
          'pendingAction:', s.state.pendingAction?.type ?? 'null',
          'multiJackSequence:', !!s.state.multiJackSequence,
          'remaining:', s.state.multiJackSequence?.remainingSequence?.length ?? 0,
          'phase:', s.state.phase,
          'lastPower:', s.state.lastPowerTriggered?.type ?? 'null',
          'pendingCemeteryTransit:', !!s.state.pendingCemeteryTransit,
          'needsContinuation:', needsMultiJackContinuation(s.state));
      }

      sendSoloState(socket, s);

      // Overlay delay: show jack in pile + overlay animation before popup
      if (needsOverlayDelay(s.state)) {
        scheduleOverlayDelay(socket, s);
        return;
      }

      // Flop remake animation: wait 2.5s before scheduling next bot
      if (hasFlopRemakeJustCompleted(prevState, s.state)) {
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          // Resolve cemetery transit (J♥ + 9 → graveyard)
          if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
            s.state = resolveCemeteryTransit(s.state);
            sendSoloState(socket, s);
          }
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, FLOP_REMAKE_ANIM_MS);
        return;
      }

      // Manouche exchange animation: wait 1.6s before scheduling next action
      if (hasManoucheExchangeJustCompleted(prevState, s.state)) {
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          // Resolve cemetery transit (J♠ → graveyard) after manouche animation
          if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
            s.state = resolveCemeteryTransit(s.state);
            sendSoloState(socket, s);
          }
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, MANOUCHE_ANIM_MS);
        return;
      }

      // Shifumi result popup: auto-resolve after 3s delay
      if (s.state.pendingAction?.type === 'shifumiResult') {
        scheduleSoloShifumiResultResolution(socket, s);
      } else if (needsMultiJackContinuation(s.state)) {
        // Multi-jack continuation: revolution/superRevolution needs server-driven step
        scheduleSoloMultiJackContinuation(socket, s);
      } else if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
        // Two-step cemetery transit: intermediate state already sent, resolve after delay
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          s.state = resolveCemeteryTransit(s.state);
          sendSoloState(socket, s);
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, CEMETERY_TRANSIT_DELAY_MS);
      } else {
        scheduleSoloBotIfNeeded(socket, s);
      }
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('solo:restart', () => {
    const prev = soloSessions.get(socket.id);
    const variant = prev?.state.variant ?? DEFAULT_VARIANT;
    const fresh = createSoloSession(socket.id, variant);
    soloSessions.set(socket.id, fresh);
    sendSoloState(socket, fresh);
    emitSoloSystemMessage(socket, 'La partie commence');
  });

  // ── Legacy game:action / game:restart (backward compat with current client) ─

  socket.on('game:action', (rawAction: unknown) => {
    // Check if in a room first
    if (userId) {
      const room = lobby.findRoomByUserId(userId);
      if (room) {
        try {
          room.handleAction(userId, rawAction as GameAction);
        } catch (err) {
          socket.emit('game:error', { message: (err as Error).message });
        }
        return;
      }
    }

    // Fallback to solo
    const s = soloSessions.get(socket.id);
    if (!s) return;

    try {
      const prevState = s.state;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.state = applyAction(s.state, s.humanId, rawAction as any, Date.now());

      if (s.state.pendingAction?.type === 'firstPlayerShifumi') {
        s.state = resolveFirstPlayerShifumi(s.state);
      }

      // [MULTI-JACK] diagnostic after game:action
      if (s.state.multiJackSequence) {
        console.log('[MULTI-JACK] game:action result:',
          'pendingAction:', s.state.pendingAction?.type ?? 'null',
          'multiJackSequence:', !!s.state.multiJackSequence,
          'remaining:', s.state.multiJackSequence?.remainingSequence?.length ?? 0,
          'phase:', s.state.phase,
          'lastPower:', s.state.lastPowerTriggered?.type ?? 'null',
          'needsContinuation:', needsMultiJackContinuation(s.state));
      }

      sendSoloState(socket, s);

      // Overlay delay: show jack in pile + overlay animation before popup
      if (needsOverlayDelay(s.state)) {
        scheduleOverlayDelay(socket, s);
        return;
      }

      // Flop remake animation: wait 2.5s before scheduling next bot
      if (hasFlopRemakeJustCompleted(prevState, s.state)) {
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          // Resolve cemetery transit (J♥ + 9 → graveyard)
          if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
            s.state = resolveCemeteryTransit(s.state);
            sendSoloState(socket, s);
          }
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, FLOP_REMAKE_ANIM_MS);
        return;
      }

      // Manouche exchange animation: wait 1.6s before scheduling next action
      if (hasManoucheExchangeJustCompleted(prevState, s.state)) {
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          // Resolve cemetery transit (J♠ → graveyard) after manouche animation
          if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
            s.state = resolveCemeteryTransit(s.state);
            sendSoloState(socket, s);
          }
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, MANOUCHE_ANIM_MS);
        return;
      }

      // Shifumi result popup, multi-jack continuation, or cemetery transit
      if (s.state.pendingAction?.type === 'shifumiResult') {
        scheduleSoloShifumiResultResolution(socket, s);
      } else if (needsMultiJackContinuation(s.state)) {
        scheduleSoloMultiJackContinuation(socket, s);
      } else if (s.state.pendingCemeteryTransit && !s.state.pendingAction) {
        setTimeout(() => {
          const current = soloSessions.get(socket.id);
          if (!current || current !== s) return;
          s.state = resolveCemeteryTransit(s.state);
          sendSoloState(socket, s);
          if (needsMultiJackContinuation(s.state)) {
            scheduleSoloMultiJackContinuation(socket, s);
          } else {
            scheduleSoloBotIfNeeded(socket, s);
          }
        }, CEMETERY_TRANSIT_DELAY_MS);
      } else {
        scheduleSoloBotIfNeeded(socket, s);
      }
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('game:restart', () => {
    const prev = soloSessions.get(socket.id);
    const variant = prev?.state.variant ?? DEFAULT_VARIANT;
    const fresh = createSoloSession(socket.id, variant);
    soloSessions.set(socket.id, fresh);
    sendSoloState(socket, fresh);
    emitSoloSystemMessage(socket, 'La partie commence');
  });

  // ── Debug: composition libre (dev only) ───────────────────────────────────

  socket.on(
    'game:debug-compose',
    (data: { hand: string[]; faceUp: string[]; faceDown: string[] }) => {
      if (!IS_DEV) return;
      const s = soloSessions.get(socket.id);
      if (!s) return;
      if (s.state.phase !== 'swapping') return;

      const cloned: GameState = JSON.parse(JSON.stringify(s.state));
      const humanIdx = cloned.players.findIndex((p) => p.id === s.humanId);
      if (humanIdx === -1) return;
      const human = cloned.players[humanIdx]!;

      cloned.deck.push(...human.hand, ...human.faceUp, ...human.faceDown);
      human.hand = [];
      human.faceUp = [];
      human.faceDown = [];

      let missingCards = 0;
      const findAndRemove = (cardId: string) => {
        const deckIdx = cloned.deck.findIndex((c) => c.id === cardId);
        if (deckIdx !== -1) return cloned.deck.splice(deckIdx, 1)[0]!;
        for (const player of cloned.players) {
          if (player.id === s.humanId) continue;
          for (const zone of ['hand', 'faceUp', 'faceDown'] as const) {
            const idx = player[zone].findIndex((c) => c.id === cardId);
            if (idx !== -1) return player[zone].splice(idx, 1)[0]!;
          }
        }
        missingCards++;
        console.warn(`[debug-compose] Card not found: ${cardId}`);
        return undefined;
      };

      for (const cardId of data.hand) {
        const card = findAndRemove(cardId);
        if (card) human.hand.push(card);
      }
      for (const cardId of data.faceUp) {
        const card = findAndRemove(cardId);
        if (card) human.faceUp.push(card);
      }
      for (const cardId of data.faceDown) {
        const card = findAndRemove(cardId);
        if (card) human.faceDown.push(card);
      }

      try {
        s.state = applyReady(cloned, s.humanId, Date.now());

        if (s.state.pendingAction?.type === 'firstPlayerShifumi') {
          s.state = resolveFirstPlayerShifumi(s.state);
        }

        sendSoloState(socket, s);
        scheduleSoloBotIfNeeded(socket, s);
      } catch (err) {
        console.error('[debug-compose] Error:', (err as Error).message);
        socket.emit('game:error', { message: (err as Error).message });
      }
    },
  );

  // ── Lobby events (room creation, listing, join/leave) ────────────────────

  socket.on('lobby:list', () => {
    const rooms = lobby.listPublicRooms().map((r) => r.toLobbySummary());
    socket.emit('lobby:rooms', rooms);
  });

  socket.on('lobby:create', async (data: { name: string; isPublic?: boolean; variant?: unknown }) => {
    if (!userId) {
      socket.emit('game:error', { message: 'Authentification requise' });
      return;
    }

    const existing = lobby.findRoomByUserId(userId);
    if (existing) {
      if (existing.status === 'finished' || existing.status === 'playing') {
        cleanupUserFromActiveRoom(userId, socket);
      } else {
        socket.emit('game:error', { message: 'Vous êtes déjà dans une room' });
        return;
      }
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (!dbUser) {
      socket.emit('game:error', { message: 'Utilisateur introuvable' });
      return;
    }

    let variant = DEFAULT_VARIANT;
    if (data.variant && typeof data.variant === 'object' && 'name' in data.variant && 'playerCount' in data.variant && 'deckCount' in data.variant && 'powerAssignments' in data.variant) {
      const candidate = data.variant as GameVariant;
      const errors = validateVariant(candidate);
      if (errors.length > 0) {
        socket.emit('game:error', { message: `Variante invalide: ${errors.map((e) => e.message).join('; ')}` });
        return;
      }
      variant = candidate;
    }

    const roomName = (typeof data.name === 'string' && data.name.trim()) ? data.name.trim().slice(0, 50) : `Partie de ${dbUser.username}`;
    const room = lobby.createRoom(userId, variant, {
      isPublic: data.isPublic ?? true,
      name: roomName,
    });

    room.addPlayer(userId, dbUser.username, socket.id);
    socket.join(`room:${room.id}`);

    socket.emit('lobby:roomCreated', { room: room.toLobbySummary(), joinCode: room.config.joinCode });
  });

  socket.on('lobby:join', async (data: { roomId: string }) => {
    if (!userId) {
      socket.emit('game:error', { message: 'Authentification requise' });
      return;
    }

    const existing = lobby.findRoomByUserId(userId);
    if (existing) {
      if (existing.status === 'finished' || existing.status === 'playing') {
        cleanupUserFromActiveRoom(userId, socket);
      } else {
        socket.emit('game:error', { message: 'Vous êtes déjà dans une room. Quittez-la d\'abord.' });
        return;
      }
    }

    const room = lobby.getRoom(data.roomId);
    if (!room) {
      socket.emit('game:error', { message: 'Room introuvable' });
      return;
    }

    if (!room.canJoin) {
      socket.emit('game:error', { message: 'Room pleine ou partie déjà lancée' });
      return;
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (!dbUser) {
      socket.emit('game:error', { message: 'Utilisateur introuvable' });
      return;
    }

    try {
      room.addPlayer(userId, dbUser.username, socket.id);
      socket.join(`room:${room.id}`);
      socket.emit('lobby:joined', { room: room.toLobbySummary() });
      io.to(`room:${room.id}`).emit('lobby:playerJoined', {
        room: room.toLobbySummary(),
        userId,
        username: dbUser.username,
      });
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('lobby:leave', () => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room) return;

    if (room.status === 'finished' || room.status === 'playing') {
      cleanupUserFromActiveRoom(userId, socket);
      socket.emit('lobby:left');
      return;
    }

    if (room.status !== 'waiting') return;

    const isCreator = room.config.creatorId === userId;
    const leavingPlayer = room.players.find((p) => p.userId === userId);
    room.removePlayer(userId);
    socket.leave(`room:${room.id}`);

    if (isCreator || room.humanCount === 0) {
      // Creator leaving or empty room → close the room
      io.to(`room:${room.id}`).emit('lobby:roomClosed', { roomId: room.id });
      lobby.removeRoom(room.id);
    } else {
      io.to(`room:${room.id}`).emit('lobby:playerLeft', {
        room: room.toLobbySummary(),
        userId,
        username: leavingPlayer?.username,
      });
    }

    socket.emit('lobby:left');
  });

  socket.on('lobby:ready', (data: { ready: boolean }) => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room || room.status !== 'waiting') return;

    try {
      room.setReady(userId, !!data.ready);
      io.to(`room:${room.id}`).emit('lobby:playerReady', {
        room: room.toLobbySummary(),
        userId,
        ready: !!data.ready,
      });
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('lobby:start', () => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room || room.status !== 'waiting') return;

    if (room.config.creatorId !== userId) {
      socket.emit('game:error', { message: 'Seul le créateur peut lancer la partie' });
      return;
    }

    if (room.humanCount < 2) {
      socket.emit('game:error', { message: 'Il faut au moins 2 joueurs pour lancer' });
      return;
    }

    try {
      room.setBroadcast((r) => broadcastRoomState(r, io));
      room.start();
      io.to(`room:${room.id}`).emit('room:started', { room: room.toLobbySummary() });
      const sysMsg = room.addSystemMessage('La partie commence');
      io.to(`room:${room.id}`).emit('chat:message', sysMsg);
      broadcastRoomState(room, io);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('lobby:kick', (data: { userId: string }) => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room || room.status !== 'waiting') return;

    if (room.config.creatorId !== userId) {
      socket.emit('game:error', { message: 'Seul le créateur peut exclure un joueur' });
      return;
    }

    const targetUserId = data.userId;
    if (targetUserId === userId) {
      socket.emit('game:error', { message: 'Vous ne pouvez pas vous exclure vous-même' });
      return;
    }

    const targetPlayer = room.players.find((p) => p.userId === targetUserId && !p.isBot);
    if (!targetPlayer) {
      socket.emit('game:error', { message: 'Joueur introuvable' });
      return;
    }

    room.removePlayer(targetUserId);

    // Notify the kicked player
    if (targetPlayer.socketId) {
      io.to(targetPlayer.socketId).emit('lobby:kicked', { roomId: room.id });
      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      targetSocket?.leave(`room:${room.id}`);
    }

    // Notify remaining players
    io.to(`room:${room.id}`).emit('lobby:playerLeft', {
      room: room.toLobbySummary(),
      userId: targetUserId,
      username: targetPlayer.username,
      kicked: true,
    });
  });

  socket.on('lobby:updateVariant', (data: { variant: unknown }) => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room || room.status !== 'waiting') return;

    if (room.config.creatorId !== userId) {
      socket.emit('game:error', { message: 'Seul le créateur peut modifier la variante' });
      return;
    }

    if (!data.variant || typeof data.variant !== 'object') {
      socket.emit('game:error', { message: 'Variante invalide' });
      return;
    }

    const candidate = data.variant as GameVariant;
    const errors = validateVariant(candidate);
    if (errors.length > 0) {
      socket.emit('game:error', { message: `Variante invalide: ${errors.map((e) => e.message).join('; ')}` });
      return;
    }

    try {
      room.updateVariant(candidate);
      io.to(`room:${room.id}`).emit('lobby:variantUpdated', {
        room: room.toLobbySummary(),
      });
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  // ── Room events (multiplayer) ─────────────────────────────────────────────

  socket.on('room:join', (data: { roomId: string }) => {
    if (!userId) {
      socket.emit('game:error', { message: 'Authentication required for multiplayer' });
      return;
    }

    const room = lobby.getRoom(data.roomId);
    if (!room) {
      socket.emit('game:error', { message: 'Room not found' });
      return;
    }

    // Check if reconnecting
    const reconnected = room.handleReconnect(userId, socket.id);
    if (reconnected) {
      socket.join(`room:${room.id}`);
      room.setBroadcast((r) => broadcastRoomState(r, io));
      // Send current state
      const playerId = room.getPlayerId(userId);
      if (playerId && room.state) {
        socket.emit('game:state', {
          state: filterGameStateForPlayer(room.state, playerId),
          playerId,
        });
      }
      // Send chat history
      socket.emit('chat:history', room.chatMessages);
      // System message: reconnected
      const reconnPlayer = room.players.find((p) => p.userId === userId);
      if (reconnPlayer) {
        const sysMsg = room.addSystemMessage(`${reconnPlayer.username} s'est reconnecté`);
        io.to(`room:${room.id}`).emit('chat:message', sysMsg);
      }
      socket.emit('room:joined', { room: room.toLobbySummary(), reconnected: true });
      return;
    }

    // New join
    if (!room.canJoin) {
      socket.emit('game:error', { message: 'Room is full or game already started' });
      return;
    }

    try {
      const playerName = `Player ${room.humanCount + 1}`;
      room.addPlayer(userId, playerName, socket.id);
      socket.join(`room:${room.id}`);
      room.setBroadcast((r) => broadcastRoomState(r, io));
      socket.emit('room:joined', { room: room.toLobbySummary(), reconnected: false });
      io.to(`room:${room.id}`).emit('room:updated', { room: room.toLobbySummary() });
      // System message: player joined
      const sysMsg = room.addSystemMessage(`${playerName} a rejoint la partie`);
      io.to(`room:${room.id}`).emit('chat:message', sysMsg);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('room:leave', () => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room) return;

    const leavingPlayer = room.players.find((p) => p.userId === userId);

    if (room.status === 'waiting') {
      room.removePlayer(userId);
      socket.leave(`room:${room.id}`);
      io.to(`room:${room.id}`).emit('room:updated', { room: room.toLobbySummary() });
      // System message: player left
      if (leavingPlayer) {
        const sysMsg = room.addSystemMessage(`${leavingPlayer.username} a quitté la partie`);
        io.to(`room:${room.id}`).emit('chat:message', sysMsg);
      }

      // Remove empty rooms
      if (room.humanCount === 0) {
        lobby.removeRoom(room.id);
      }
    } else {
      // Game in progress — treat as disconnect
      room.handleDisconnect(userId);
      if (leavingPlayer) {
        const sysMsg = room.addSystemMessage(`${leavingPlayer.username} a quitté la partie`);
        io.to(`room:${room.id}`).emit('chat:message', sysMsg);
      }
    }
  });

  socket.on('room:start', () => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room) return;

    if (room.config.creatorId !== userId) {
      socket.emit('game:error', { message: 'Only the room creator can start the game' });
      return;
    }

    try {
      room.setBroadcast((r) => broadcastRoomState(r, io));
      room.start();
      io.to(`room:${room.id}`).emit('room:started', { room: room.toLobbySummary() });
      // System message: game started
      const sysMsg = room.addSystemMessage('La partie commence');
      io.to(`room:${room.id}`).emit('chat:message', sysMsg);
      broadcastRoomState(room, io);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('room:action', (rawAction: unknown) => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room) {
      socket.emit('game:error', { message: 'Not in a room' });
      return;
    }

    try {
      room.handleAction(userId, rawAction as GameAction);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('room:spectate', (data: { roomId: string }) => {
    const room = lobby.getRoom(data.roomId);
    if (!room) {
      socket.emit('game:error', { message: 'Room not found' });
      return;
    }

    room.addSpectator(socket.id);
    socket.join(`room:${room.id}`);

    if (room.state) {
      socket.emit('game:state', {
        state: room.getStateForSpectator(),
        playerId: null,
      });
    }
  });

  // ── Chat ────────────────────────────────────────────────────────────────

  socket.on('chat:send', (data: unknown) => {
    const result = chatSendSchema.safeParse(data);
    if (!result.success) {
      socket.emit('game:error', { message: result.error.issues[0]?.message ?? 'Invalid message' });
      return;
    }

    // Multiplayer: try room first
    if (userId) {
      const room = lobby.findRoomByUserId(userId);
      if (room) {
        const chatMsg = room.addChatMessage(userId, result.data.message);
        if (!chatMsg) {
          socket.emit('game:error', { message: 'Failed to send message' });
          return;
        }
        io.to(`room:${room.id}`).emit('chat:message', chatMsg);
        return;
      }
    }

    // Solo: handle chat locally
    const session = soloSessions.get(socket.id);
    if (!session) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    const trimmed = result.data.message.trim();
    if (trimmed.length === 0) return;

    const human = session.state.players.find((p) => p.id === session.humanId);
    const chatMsg: ChatMessage = {
      id: randomBytes(6).toString('hex'),
      playerId: session.humanId,
      playerName: human?.name ?? 'Vous',
      message: trimmed,
      timestamp: Date.now(),
      type: 'player',
    };
    socket.emit('chat:message', chatMsg);
  });

  // Note: solo games are no longer auto-started on connection.
  // The client must explicitly emit 'solo:start' with an optional variant.

  // ── Disconnect ────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    // Clean up solo session
    soloSessions.delete(socket.id);

    // Handle room disconnect
    if (userId) {
      const room = lobby.findRoomByUserId(userId);
      if (room) {
        if (room.status === 'waiting') {
          // In waiting room: treat like lobby:leave
          const isCreator = room.config.creatorId === userId;
          const leavingPlayer = room.players.find((p) => p.userId === userId);
          room.removePlayer(userId);

          if (isCreator || room.humanCount === 0) {
            io.to(`room:${room.id}`).emit('lobby:roomClosed', { roomId: room.id });
            lobby.removeRoom(room.id);
          } else {
            io.to(`room:${room.id}`).emit('lobby:playerLeft', {
              room: room.toLobbySummary(),
              userId,
              username: leavingPlayer?.username,
            });
          }
        } else {
          // Playing or finished: replace with bot and clean up
          cleanupUserFromActiveRoom(userId);
        }
        room.removeSpectator(socket.id);
      }
    }

    console.log(`[-] ${socket.id}`);
  });
});

// ─── Démarrage ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3456', 10);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server → http://localhost:${PORT}`);
  });
}

export { app, httpServer, io };
