import { PrismaClient } from '@prisma/client';

/** Singleton PrismaClient instance shared across the server. */
const prisma = new PrismaClient();

export { prisma };
