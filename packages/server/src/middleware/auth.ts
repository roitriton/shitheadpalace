import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';

/** Express request extended with authenticated user info. */
export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Attaches `userId` to the request on success.
 * Responds 401 if the token is missing or invalid.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
