import { z } from 'zod';

/** Zod schema for POST /auth/register body. */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, digits, hyphens and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

/** Zod schema for POST /auth/login body. */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Zod schema for chat:send event. */
export const chatSendSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(200, 'Message exceeds 200 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
