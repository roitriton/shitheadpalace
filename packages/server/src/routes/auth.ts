import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth';
import { registerSchema, loginSchema } from '../lib/validation';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /auth/register
 * Creates a new user account.
 * Body: { email, username, password }
 * Returns: { token, user: { id, email, username } }
 */
router.post('/register', async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
      return;
    }

    const { email, username, password, gdprConsent } = result.data;

    if (gdprConsent !== true) {
      res.status(400).json({ error: 'GDPR consent is required' });
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, gdprConsentAt: new Date() },
      select: { id: true, email: true, username: true },
    });

    const token = generateToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[auth/register] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Authenticates an existing user.
 * Body: { email, password }
 * Returns: { token, user: { id, email, username } }
 */
router.post('/login', async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
      return;
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user.id);
    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Returns the authenticated user's profile.
 * Requires: Authorization: Bearer <token>
 * Returns: { id, email, username, createdAt }
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthRequest;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('[auth/me] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };
