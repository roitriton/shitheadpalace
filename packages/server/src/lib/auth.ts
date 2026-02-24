import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;

/** Hash a plain-text password with bcrypt (cost 12). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare a plain-text password against a bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  userId: string;
}

/** Return the JWT secret, throwing if it is not configured. */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/** Sign a JWT containing the user ID. Expires in 15 minutes by default. */
export function generateToken(userId: string): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '15m';
  return jwt.sign({ userId } satisfies JwtPayload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

/** Verify a JWT and return its payload. Throws on invalid/expired tokens. */
export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret());
  return payload as JwtPayload;
}
