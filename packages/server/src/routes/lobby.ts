import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { lobby } from '../game/Lobby';
import type { GameVariant } from '@shit-head-palace/engine';

const router = Router();

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

const createRoomSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  isPublic: z.boolean().optional().default(true),
  maxPlayers: z.number().int().min(2).max(6).optional(),
  variant: z
    .object({
      name: z.string().min(1).max(50),
      powerAssignments: z.record(z.union([z.string(), z.array(z.string())])),
      playerCount: z.number().int().min(2).max(6),
      deckCount: z.number().int().min(1).max(3),
    })
    .optional(),
});

const joinByCodeSchema = z.object({
  code: z.string().length(6),
});

/**
 * GET /lobby
 * List all public rooms in waiting status.
 */
router.get('/', requireAuth, (_req, res) => {
  const rooms = lobby.listPublicRooms();
  res.json({ rooms: rooms.map((r) => r.toLobbySummary()) });
});

/**
 * POST /lobby/create
 * Create a new game room. Requires auth.
 */
router.post('/create', requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = createRoomSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
    return;
  }

  const { name, isPublic, maxPlayers, variant } = result.data;

  // Check if user is already in a room
  const existing = lobby.findRoomByUserId(userId);
  if (existing) {
    res.status(409).json({ error: 'Already in a room', roomId: existing.id });
    return;
  }

  const gameVariant = (variant as GameVariant | undefined) ?? DEFAULT_VARIANT;
  const room = lobby.createRoom(userId, gameVariant, {
    isPublic,
    maxPlayers: maxPlayers ?? gameVariant.playerCount,
    name,
  });

  res.status(201).json({
    room: room.toLobbySummary(),
    joinCode: room.config.joinCode,
  });
});

/**
 * POST /lobby/join/:roomId
 * Join a public room by ID. Requires auth.
 */
router.post('/join/:roomId', requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const room = lobby.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (!room.canJoin) {
    res.status(409).json({ error: 'Room is full or game already started' });
    return;
  }

  if (!room.config.isPublic) {
    res.status(403).json({ error: 'Room is private, use join code' });
    return;
  }

  try {
    room.addPlayer(userId, `Player`, 'pending');
    res.status(200).json({ room: room.toLobbySummary() });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

/**
 * POST /lobby/join-by-code
 * Join a private room by code. Requires auth.
 */
router.post('/join-by-code', requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = joinByCodeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
    return;
  }

  const room = lobby.getRoomByCode(result.data.code);
  if (!room) {
    res.status(404).json({ error: 'Room not found or game already started' });
    return;
  }

  if (!room.canJoin) {
    res.status(409).json({ error: 'Room is full or game already started' });
    return;
  }

  try {
    room.addPlayer(userId, `Player`, 'pending');
    res.status(200).json({ room: room.toLobbySummary() });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

export { router as lobbyRouter };
