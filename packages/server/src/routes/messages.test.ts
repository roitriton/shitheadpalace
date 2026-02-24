import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../index';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/auth';

let aliceId: string;
let aliceToken: string;
let bobId: string;
let bobToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
});

beforeEach(async () => {
  await prisma.directMessage.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.gamePlayer.deleteMany();
  await prisma.savedVariant.deleteMany();
  await prisma.game.deleteMany();
  await prisma.user.deleteMany();

  // Create two users directly
  const alice = await prisma.user.create({
    data: { email: 'alice@example.com', username: 'alice', passwordHash: 'unused' },
  });
  const bob = await prisma.user.create({
    data: { email: 'bob@example.com', username: 'bob', passwordHash: 'unused' },
  });

  aliceId = alice.id;
  aliceToken = generateToken(alice.id);
  bobId = bob.id;
  bobToken = generateToken(bob.id);
});

afterAll(async () => {
  await prisma.$disconnect();
  httpServer.close();
});

describe('POST /messages/send', () => {
  it('sends a private message and returns it', async () => {
    const res = await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'Hello Bob!' });

    expect(res.status).toBe(201);
    expect(res.body.message.senderId).toBe(aliceId);
    expect(res.body.message.receiverId).toBe(bobId);
    expect(res.body.message.text).toBe('Hello Bob!');
    expect(res.body.message.readAt).toBeNull();
  });

  it('rejects a message exceeding 500 characters', async () => {
    const longMsg = 'a'.repeat(501);
    const res = await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: longMsg });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects sending without authentication', async () => {
    const res = await request(app)
      .post('/messages/send')
      .send({ receiverId: bobId, message: 'Hello!' });

    expect(res.status).toBe(401);
  });

  it('rejects sending to a non-existent user', async () => {
    const res = await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: 'non-existent-id', message: 'Hello!' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Receiver not found');
  });

  it('rejects sending a message to yourself', async () => {
    const res = await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: aliceId, message: 'Talking to myself' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot send a message to yourself');
  });
});

describe('GET /messages/:userId', () => {
  it('retrieves conversation in descending order with pagination', async () => {
    // Send 3 messages: Alice→Bob, Bob→Alice, Alice→Bob
    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'msg1' });

    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ receiverId: aliceId, message: 'msg2' });

    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'msg3' });

    // Get conversation from Alice's perspective
    const res = await request(app)
      .get(`/messages/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(3);
    // Most recent first
    expect(res.body.messages[0].text).toBe('msg3');
    expect(res.body.messages[1].text).toBe('msg2');
    expect(res.body.messages[2].text).toBe('msg1');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);

    // Test pagination: page 1 limit 2
    const res2 = await request(app)
      .get(`/messages/${bobId}?page=1&limit=2`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res2.body.messages).toHaveLength(2);
    expect(res2.body.messages[0].text).toBe('msg3');

    // Page 2
    const res3 = await request(app)
      .get(`/messages/${bobId}?page=2&limit=2`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res3.body.messages).toHaveLength(1);
    expect(res3.body.messages[0].text).toBe('msg1');
  });
});

describe('GET /messages/unread/count', () => {
  it('returns the count of unread messages', async () => {
    // Alice sends 2 messages to Bob
    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'unread1' });

    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'unread2' });

    // Bob checks unread count
    const res = await request(app)
      .get('/messages/unread/count')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    // Alice should have 0 unread
    const res2 = await request(app)
      .get('/messages/unread/count')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res2.body.count).toBe(0);
  });
});

describe('PATCH /messages/read/:userId', () => {
  it('marks all messages from a user as read', async () => {
    // Alice sends 2 messages to Bob
    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'read me 1' });

    await request(app)
      .post('/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ receiverId: bobId, message: 'read me 2' });

    // Bob marks Alice's messages as read
    const res = await request(app)
      .patch(`/messages/read/${aliceId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    // Bob's unread count should now be 0
    const countRes = await request(app)
      .get('/messages/unread/count')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(countRes.body.count).toBe(0);

    // Messages should have readAt set
    const convRes = await request(app)
      .get(`/messages/${aliceId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    for (const msg of convRes.body.messages) {
      expect(msg.readAt).not.toBeNull();
    }
  });
});
