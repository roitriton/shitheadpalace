import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../index';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/auth';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
});

beforeEach(async () => {
  // Clean all tables before each test
  await prisma.refreshToken.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.savedVariant.deleteMany();
  await prisma.game.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  httpServer.close();
});

describe('POST /auth/register', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.id).toBeDefined();
    // Must not leak passwordHash
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 400 on invalid email', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 on short password', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'short',
      gdprConsent: true,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 on short username', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'ab',
      password: 'Password123',
      gdprConsent: true,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when gdprConsent is false', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('GDPR consent is required');
  });

  it('returns 400 when gdprConsent is missing', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });

    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'bob',
      password: 'Password123',
      gdprConsent: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('returns 409 on duplicate username', async () => {
    await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });

    const res = await request(app).post('/auth/register').send({
      email: 'bob@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already taken');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.username).toBe('alice');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'unknown@example.com',
      password: 'Password123',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 400 on invalid body', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Password123',
      gdprConsent: true,
    });
    const token = regRes.body.token;

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.createdAt).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing or malformed Authorization header');
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('returns 401 with malformed header (no Bearer prefix)', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });

  it('returns 404 if user was deleted', async () => {
    const regRes = await request(app).post('/auth/register').send({
      email: 'ghost@example.com',
      username: 'ghost',
      password: 'Password123',
      gdprConsent: true,
    });
    const token = regRes.body.token;

    // Delete the user directly
    await prisma.user.delete({ where: { email: 'ghost@example.com' } });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

describe('middleware/requireAuth', () => {
  it('attaches userId from a valid token to the request', async () => {
    const user = await prisma.user.create({
      data: { email: 'mid@example.com', username: 'midtest', passwordHash: 'unused' },
    });
    const token = generateToken(user.id);

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});
