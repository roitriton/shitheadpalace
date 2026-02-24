import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { lobbyRouter } from './routes/lobby';
import { socketAuthMiddleware, type AuthenticatedSocket } from './middleware/socketAuth';
import { lobby } from './game/Lobby';
import { GameRoom } from './game/GameRoom';
import {
  createInitialGameState,
  filterGameStateForPlayer,
  applyAction,
  applyReady,
} from '@shit-head-palace/engine';
import type { GameState, GameVariant, GameAction } from '@shit-head-palace/engine';
import { runBotTurns, resolveFirstPlayerShifumi, canBotActOnPendingAction } from './game/bot';

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

function createSoloSession(socketId: string): SoloSession {
  const humanId = `human-${socketId.slice(0, 8)}`;
  const bot1Id = `bot1-${socketId.slice(0, 8)}`;
  const bot2Id = `bot2-${socketId.slice(0, 8)}`;
  const botIds = [bot1Id, bot2Id];

  let state = createInitialGameState(
    socketId,
    [
      { id: humanId, name: 'Vous', isBot: false },
      { id: bot1Id, name: 'Bot A', isBot: true, botDifficulty: 'easy' },
      { id: bot2Id, name: 'Bot B', isBot: true, botDifficulty: 'easy' },
    ],
    DEFAULT_VARIANT,
  );

  state = applyReady(state, bot1Id, Date.now());
  state = applyReady(state, bot2Id, Date.now());

  return { state, humanId, botIds };
}

const IS_DEV = process.env.NODE_ENV !== 'production';

function sendSoloState(socket: Socket, session: SoloSession): void {
  socket.emit('game:state', {
    state: IS_DEV
      ? session.state
      : filterGameStateForPlayer(session.state, session.humanId),
    playerId: session.humanId,
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

  setTimeout(() => {
    session.state = runBotTurns(session.state, session.botIds, [session.humanId]);
    sendSoloState(socket, session);
  }, 800);
}

// ─── Room broadcast helper ──────────────────────────────────────────────────

function broadcastRoomState(room: GameRoom, io: Server): void {
  if (!room.state) return;

  // Send filtered state to each connected player
  for (const player of room.players) {
    if (player.socketId && !player.isBot) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit('game:state', {
          state: filterGameStateForPlayer(room.state, player.playerId),
          playerId: player.playerId,
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

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.use(socketAuthMiddleware);

io.on('connection', (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket;
  const userId = socket.data.userId;
  const isAnonymous = socket.data.anonymous;

  console.log(`[+] ${socket.id}${userId ? ` (user: ${userId})` : ' (anonymous)'}`);

  // ── Solo mode (anonymous or explicit) ─────────────────────────────────────

  socket.on('solo:start', () => {
    const session = createSoloSession(socket.id);
    soloSessions.set(socket.id, session);
    sendSoloState(socket, session);
  });

  socket.on('solo:action', (rawAction: unknown) => {
    const s = soloSessions.get(socket.id);
    if (!s) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.state = applyAction(s.state, s.humanId, rawAction as any, Date.now());

      if (s.state.pendingAction?.type === 'firstPlayerShifumi') {
        s.state = resolveFirstPlayerShifumi(s.state);
      }

      sendSoloState(socket, s);
      scheduleSoloBotIfNeeded(socket, s);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('solo:restart', () => {
    const fresh = createSoloSession(socket.id);
    soloSessions.set(socket.id, fresh);
    sendSoloState(socket, fresh);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.state = applyAction(s.state, s.humanId, rawAction as any, Date.now());

      if (s.state.pendingAction?.type === 'firstPlayerShifumi') {
        s.state = resolveFirstPlayerShifumi(s.state);
      }

      sendSoloState(socket, s);
      scheduleSoloBotIfNeeded(socket, s);
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('game:restart', () => {
    const fresh = createSoloSession(socket.id);
    soloSessions.set(socket.id, fresh);
    sendSoloState(socket, fresh);
  });

  // ── Debug: composition libre (dev only) ───────────────────────────────────

  socket.on(
    'game:debug-compose',
    (data: { hand: string[]; faceUp: string[]; faceDown: string[] }) => {
      if (!IS_DEV) return;
      const s = soloSessions.get(socket.id);
      if (!s) return;
      if (s.state.phase !== 'swapping') return;

      console.log('[debug-compose] Received:', {
        hand: data.hand.length,
        faceUp: data.faceUp.length,
        faceDown: data.faceDown.length,
      });

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

      console.log('[debug-compose] After assignment:', {
        humanHand: human.hand.length,
        humanFaceUp: human.faceUp.length,
        humanFaceDown: human.faceDown.length,
        deckSize: cloned.deck.length,
        missingCards,
      });

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
      socket.emit('room:joined', { room: room.toLobbySummary(), reconnected: true });
      return;
    }

    // New join
    if (!room.canJoin) {
      socket.emit('game:error', { message: 'Room is full or game already started' });
      return;
    }

    try {
      room.addPlayer(userId, `Player ${room.humanCount + 1}`, socket.id);
      socket.join(`room:${room.id}`);
      room.setBroadcast((r) => broadcastRoomState(r, io));
      socket.emit('room:joined', { room: room.toLobbySummary(), reconnected: false });
      io.to(`room:${room.id}`).emit('room:updated', { room: room.toLobbySummary() });
    } catch (err) {
      socket.emit('game:error', { message: (err as Error).message });
    }
  });

  socket.on('room:leave', () => {
    if (!userId) return;
    const room = lobby.findRoomByUserId(userId);
    if (!room) return;

    if (room.status === 'waiting') {
      room.removePlayer(userId);
      socket.leave(`room:${room.id}`);
      io.to(`room:${room.id}`).emit('room:updated', { room: room.toLobbySummary() });

      // Remove empty rooms
      if (room.humanCount === 0) {
        lobby.removeRoom(room.id);
      }
    } else {
      // Game in progress — treat as disconnect
      room.handleDisconnect(userId);
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

  // ── Auto-start solo for backward compatibility ────────────────────────────

  if (isAnonymous) {
    const session = createSoloSession(socket.id);
    soloSessions.set(socket.id, session);
    sendSoloState(socket, session);
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    // Clean up solo session
    soloSessions.delete(socket.id);

    // Handle room disconnect
    if (userId) {
      const room = lobby.findRoomByUserId(userId);
      if (room) {
        room.handleDisconnect(userId);
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
