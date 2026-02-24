import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './auth';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt';
  process.env.JWT_EXPIRES_IN = '1h';
});

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('MyPassword123');
    expect(hash).not.toBe('MyPassword123');
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix

    const valid = await verifyPassword('MyPassword123', hash);
    expect(valid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword');
    const valid = await verifyPassword('WrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('produces different hashes for the same password (salt)', async () => {
    const hash1 = await hashPassword('SamePass');
    const hash2 = await hashPassword('SamePass');
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateToken / verifyToken', () => {
  it('generates a token and verifies it', () => {
    const token = generateToken('user-123');
    const payload = verifyToken(token);
    expect(payload.userId).toBe('user-123');
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('throws on a tampered token', () => {
    const token = generateToken('user-123');
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(() => verifyToken(tampered)).toThrow();
  });
});

describe('generateToken without JWT_SECRET', () => {
  it('throws when JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => generateToken('user-123')).toThrow('JWT_SECRET environment variable is not set');
    process.env.JWT_SECRET = original;
  });
});
