import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../index';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/auth';
import { lobby } from '../game/Lobby';

let userToken: string;
let userId: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
});

beforeEach(async () => {
  // Clean DB
  await prisma.refreshToken.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.savedVariant.deleteMany();
  await prisma.game.deleteMany();
  await prisma.user.deleteMany();

  // Clean lobby rooms (use internal access since Lobby doesn't expose clear)
  for (const room of lobby.listPublicRooms()) {
    lobby.removeRoom(room.id);
  }

  // Create test user
  const res = await request(app).post('/auth/register').send({
    email: 'lobby@example.com',
    username: 'lobbyuser',
    password: 'Password123',
  });
  userToken = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  httpServer.close();
});

describe('GET /lobby', () => {
  it('returns empty list when no rooms', async () => {
    const res = await request(app).get('/lobby').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/lobby');
    expect(res.status).toBe(401);
  });
});

describe('POST /lobby/create', () => {
  it('creates a public room with defaults', async () => {
    const res = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.room).toBeDefined();
    expect(res.body.room.isPublic).toBe(true);
    expect(res.body.room.status).toBe('waiting');
    expect(res.body.joinCode).toBeNull();
  });

  it('creates a private room with join code', async () => {
    const res = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isPublic: false });

    expect(res.status).toBe(201);
    expect(res.body.room.isPublic).toBe(false);
    expect(res.body.joinCode).toBeTruthy();
    expect(res.body.joinCode).toHaveLength(6);
  });

  it('creates a room with custom variant', async () => {
    const res = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        variant: {
          name: 'Custom',
          powerAssignments: { burn: '10', reset: '2' },
          playerCount: 4,
          deckCount: 1,
        },
        maxPlayers: 4,
      });

    expect(res.status).toBe(201);
    expect(res.body.room.maxPlayers).toBe(4);
    expect(res.body.room.variantName).toBe('Custom');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/lobby/create').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid maxPlayers', async () => {
    const res = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ maxPlayers: 100 });

    expect(res.status).toBe(400);
  });
});

describe('POST /lobby/join/:roomId', () => {
  it('joins a public room', async () => {
    // Create room with a different user
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com', username: 'other', passwordHash: 'unused' },
    });
    const otherToken = generateToken(otherUser.id);

    const createRes = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});

    const roomId = createRes.body.room.id;

    const joinRes = await request(app)
      .post(`/lobby/join/${roomId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.room.playerCount).toBe(1);
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app)
      .post('/lobby/join/unknown')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for private room', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'priv@example.com', username: 'privuser', passwordHash: 'unused' },
    });
    const otherToken = generateToken(otherUser.id);

    const createRes = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ isPublic: false });

    const roomId = createRes.body.room.id;

    const joinRes = await request(app)
      .post(`/lobby/join/${roomId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(joinRes.status).toBe(403);
  });
});

describe('POST /lobby/join-by-code', () => {
  it('joins a private room by code', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'code@example.com', username: 'codeuser', passwordHash: 'unused' },
    });
    const otherToken = generateToken(otherUser.id);

    const createRes = await request(app)
      .post('/lobby/create')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ isPublic: false });

    const code = createRes.body.joinCode;

    const joinRes = await request(app)
      .post('/lobby/join-by-code')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code });

    expect(joinRes.status).toBe(200);
  });

  it('returns 404 for invalid code', async () => {
    const res = await request(app)
      .post('/lobby/join-by-code')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for bad code format', async () => {
    const res = await request(app)
      .post('/lobby/join-by-code')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'AB' });

    expect(res.status).toBe(400);
  });
});
