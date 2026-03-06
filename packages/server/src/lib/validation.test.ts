import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from './validation';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'player1',
      password: 'securePass123',
      gdprConsent: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      username: 'player1',
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short username (< 3 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'ab',
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects long username (> 30 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'a'.repeat(31),
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username with special characters', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'player @1',
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts username with hyphens and underscores', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'my-player_1',
      password: 'securePass123',
      gdprConsent: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password (< 8 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'player1',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects long password (> 128 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'player1',
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'securePass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
