import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Customer sessions. Mirrors the admin session pattern in `@/lib/auth`
 * (bcryptjs password hashes, jose HS256 JWT in an HTTP-only cookie) but
 * uses a SEPARATE cookie and token namespace so customer and admin
 * sessions never interfere with each other.
 */
export const CUSTOMER_COOKIE_NAME = "customer_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is not set or is shorter than 32 characters. Set a long random secret (at least 32 characters) in your environment variables.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createCustomerSessionToken(
  customerId: string,
  rememberMe = false,
): Promise<{ token: string; maxAge: number }> {
  const secret = getJwtSecret();
  const maxAge = rememberMe
    ? REMEMBER_MAX_AGE_SECONDS
    : SESSION_MAX_AGE_SECONDS;
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { tokenVersion: true },
  });
  const token = await new SignJWT({
    sub: customerId,
    typ: "customer",
    tokenVersion: customer?.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret);
  return { token, maxAge };
}

/**
 * Invalidate every existing customer session token by bumping the stored
 * tokenVersion. Call on password change, password reset, and
 * "log out everywhere". The next token issued carries the new version.
 */
export async function bumpCustomerTokenVersion(
  customerId: string,
): Promise<void> {
  await db.customer.update({
    where: { id: customerId },
    data: { tokenVersion: { increment: 1 } },
  });
}

export type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

export async function getCustomerSession(): Promise<CustomerSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
    if (!token) return null;

    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.typ !== "customer") return null;
    const customerId = payload.sub;
    if (!customerId) return null;

    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.status !== "active") return null;
    // A token issued before a password change / reset / log-out-everywhere
    // carries a stale tokenVersion and is rejected.
    if (payload.tokenVersion !== customer.tokenVersion) return null;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    };
  } catch {
    return null;
  }
}

export async function requireCustomer(
  nextPath?: string,
): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    const loginUrl = `/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;
    redirect(loginUrl);
  }
  return session;
}

/** Cookie options for the customer session cookie. */
export function customerSessionCookieOptions(maxAge: number) {
  return {
    name: CUSTOMER_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Expire the customer session cookie (logout). */
export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

// ---------------------------------------------------------------------------
// Password reset tokens (single-use, 1 hour, stored as SHA-256 hashes).
// No email/SMS sender is configured — see README "Notifications & password
// reset" for how a reset link reaches the customer (admin shares the
// one-time link, or a configured email/SMS sender delivers it).
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "crypto";

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Create a reset token for a customer. Returns the raw token (show once).
 * Any prior unused tokens for this customer are invalidated first, so
 * only the newest link ever works. */
export async function createPasswordResetToken(
  customerId: string,
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await db.customerResetToken.deleteMany({
    where: { customerId, usedAt: null },
  });
  await db.customerResetToken.create({
    data: {
      customerId,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return rawToken;
}

/** Validate a raw reset token. Returns the customer or null. */
export async function verifyPasswordResetToken(
  rawToken: string,
): Promise<{ id: string; name: string; phone: string; email: string | null } | null> {
  const record = await db.customerResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
    include: { customer: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return {
    id: record.customer.id,
    name: record.customer.name,
    phone: record.customer.phone,
    email: record.customer.email,
  };
}

/** Mark a reset token used (call after a successful password change). */
export async function consumePasswordResetToken(
  rawToken: string,
): Promise<void> {
  await db.customerResetToken.update({
    where: { tokenHash: hashResetToken(rawToken) },
    data: { usedAt: new Date() },
  });
}

/**
 * Atomically consume a reset token inside a transaction: marks it used
 * only if it is still unused and unexpired. Returns the number of rows
 * matched (0 = already used, expired, or a concurrent request won —
 * the caller must fail the reset in that case).
 */
export async function consumePasswordResetTokenAtomic(
  tx: Prisma.TransactionClient,
  rawToken: string,
): Promise<number> {
  const result = await tx.customerResetToken.updateMany({
    where: {
      tokenHash: hashResetToken(rawToken),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  return result.count;
}
