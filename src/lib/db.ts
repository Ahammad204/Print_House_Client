import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export default db;

/**
 * H13: Neon cold starts can push a multi-query order mutation past
 * Prisma's 5 s default interactive-transaction timeout (seen live
 * 27 Nov 2026: the first cancel of KGP-20261127-0010 failed at 5,219 ms
 * and succeeded on retry). Long order mutations pass this as the second
 * argument to db.$transaction(...). Single-row writes keep the default.
 */
export const LONG_TRANSACTION: { maxWait: number; timeout: number } = {
  maxWait: 10000,
  timeout: 20000,
};
