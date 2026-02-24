import type { Socket } from 'socket.io';
import { verifyToken } from '../lib/auth';

/** Extended Socket with authenticated user data. */
export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    anonymous?: boolean;
  };
}

/**
 * Socket.IO middleware that verifies JWT from the handshake auth.
 * Attaches userId to socket.data on success.
 * Allows anonymous connections for solo mode (no token required).
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    // Allow anonymous connections for solo mode
    (socket as AuthenticatedSocket).data.anonymous = true;
    next();
    return;
  }

  try {
    const payload = verifyToken(token);
    (socket as AuthenticatedSocket).data.userId = payload.userId;
    (socket as AuthenticatedSocket).data.anonymous = false;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
}
