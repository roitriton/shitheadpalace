import { describe, it, expect, beforeAll } from 'vitest';
import { socketAuthMiddleware, type AuthenticatedSocket } from './socketAuth';
import { generateToken } from '../lib/auth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
});

/** Creates a minimal mock Socket for testing the middleware. */
function mockSocket(token?: string): AuthenticatedSocket {
  return {
    handshake: {
      auth: token !== undefined ? { token } : {},
    },
    data: {},
  } as unknown as AuthenticatedSocket;
}

describe('socketAuthMiddleware', () => {
  it('authenticates with a valid token', () => {
    const socket = mockSocket(generateToken('user-123'));
    let error: Error | undefined;
    socketAuthMiddleware(socket, (err) => {
      error = err;
    });
    expect(error).toBeUndefined();
    expect(socket.data.userId).toBe('user-123');
    expect(socket.data.anonymous).toBe(false);
  });

  it('allows anonymous connection without token', () => {
    const socket = mockSocket(undefined);
    let error: Error | undefined;
    socketAuthMiddleware(socket, (err) => {
      error = err;
    });
    expect(error).toBeUndefined();
    expect(socket.data.anonymous).toBe(true);
    expect(socket.data.userId).toBeUndefined();
  });

  it('rejects invalid token', () => {
    const socket = mockSocket('invalid.token.here');
    let error: Error | undefined;
    socketAuthMiddleware(socket, (err) => {
      error = err;
    });
    expect(error).toBeDefined();
    expect(error!.message).toBe('Authentication failed');
  });

  it('allows empty string token as anonymous', () => {
    const socket = mockSocket('');
    let error: Error | undefined;
    socketAuthMiddleware(socket, (err) => {
      error = err;
    });
    expect(error).toBeUndefined();
    expect(socket.data.anonymous).toBe(true);
  });
});
