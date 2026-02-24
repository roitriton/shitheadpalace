import { Router } from 'express';
import type { Server } from 'socket.io';
import { prisma } from '../lib/prisma';
import { pmSendSchema } from '../lib/validation';
import { requireAuth, type AuthRequest } from '../middleware/auth';

/**
 * Creates the private messages router.
 * Receives the Socket.IO server instance for real-time notifications.
 */
export function createMessagesRouter(io: Server): Router {
  const router = Router();

  /**
   * POST /messages/send
   * Send a private message to another user.
   * Body: { receiverId, message }
   */
  router.post('/send', requireAuth, async (req, res) => {
    const { userId } = req as AuthRequest;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = pmSendSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
      return;
    }

    const { receiverId, message } = result.data;

    if (receiverId === userId) {
      res.status(400).json({ error: 'Cannot send a message to yourself' });
      return;
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      res.status(404).json({ error: 'Receiver not found' });
      return;
    }

    const dm = await prisma.directMessage.create({
      data: { senderId: userId, receiverId, text: message },
      select: { id: true, senderId: true, receiverId: true, text: true, readAt: true, createdAt: true },
    });

    // Notify receiver in real-time if connected
    const sockets = await io.fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === receiverId) {
        s.emit('pm:receive', dm);
      }
    }

    res.status(201).json({ message: dm });
  });

  /**
   * GET /messages/unread/count
   * Returns the total count of unread messages for the authenticated user.
   * NOTE: Must be defined before /:userId to avoid "unread" matching as a param.
   */
  router.get('/unread/count', requireAuth, async (req, res) => {
    const { userId } = req as AuthRequest;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const count = await prisma.directMessage.count({
      where: { receiverId: userId, readAt: null },
    });

    res.json({ count });
  });

  /**
   * GET /messages/:userId
   * Retrieve the conversation with a specific user.
   * Query: ?page=1&limit=20 (defaults)
   */
  router.get('/:userId', requireAuth, async (req, res) => {
    const { userId } = req as AuthRequest;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const otherUserId = req.params.userId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, senderId: true, receiverId: true, text: true, readAt: true, createdAt: true },
    });

    res.json({ messages, page, limit });
  });

  /**
   * PATCH /messages/read/:userId
   * Mark all messages from a specific user as read.
   */
  router.patch('/read/:userId', requireAuth, async (req, res) => {
    const { userId } = req as AuthRequest;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const fromUserId = req.params.userId;

    const result = await prisma.directMessage.updateMany({
      where: { senderId: fromUserId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ updated: result.count });
  });

  return router;
}
