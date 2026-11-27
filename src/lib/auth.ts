import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

export async function createSessionToken(adminId: string): Promise<string> {
  const secret = getJwtSecret();
  const admin = await db.admin.findUnique({
    where: { id: adminId },
    select: { tokenVersion: true },
  });
  return new SignJWT({
    sub: adminId,
    typ: "admin",
    tokenVersion: admin?.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Invalidate every existing admin session token by bumping the stored
 * tokenVersion. Call on password change, password reset, and
 * "log out everywhere". The next token issued carries the new version.
 */
export async function bumpAdminTokenVersion(adminId: string): Promise<void> {
  await db.admin.update({
    where: { id: adminId },
    data: { tokenVersion: { increment: 1 } },
  });
}

export type AdminSession = {
  id: string;
  email: string;
  name: string;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    // Tokens issued before the typ claim was added have no typ and are
    // rejected here — those sessions must sign in again.
    if (payload.typ !== "admin") return null;
    const adminId = payload.sub;
    if (!adminId) return null;

    const admin = await db.admin.findUnique({ where: { id: adminId } });
    if (!admin) return null;
    // A token issued before a password change / log-out-everywhere
    // carries a stale tokenVersion and is rejected.
    if (payload.tokenVersion !== admin.tokenVersion) return null;

    return { id: admin.id, email: admin.email, name: admin.name };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

/** Cookie options shared by the login route when it sets the session. */
export const sessionCookieOptions = {
  name: COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

// --- Order-success phone verification (audit H2) ---------------------------
// After a guest proves ownership of an order with the checkout phone
// number, the server issues a short-lived signed token (15 minutes) stored
// in an httpOnly cookie scoped to that order's page. The phone number
// itself is POSTed and never appears in the URL, browser history, or
// server logs. The token is signed, so it cannot be forged by setting a
// cookie by hand.
export const ORDER_SUCCESS_COOKIE = "order_success_verified";
const ORDER_SUCCESS_TOKEN_TTL_SECONDS = 15 * 60;

export async function signOrderSuccessToken(
  orderNumber: string,
): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ orderNumber, typ: "order-success" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyOrderSuccessToken(
  token: string,
  orderNumber: string,
): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload.typ === "order-success" && payload.orderNumber === orderNumber;
  } catch {
    return false;
  }
}

/** Cookie options for the order-success verification token. */
export function orderSuccessCookieOptions(orderNumber: string) {
  return {
    name: ORDER_SUCCESS_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: `/order-success/${orderNumber}`,
    maxAge: ORDER_SUCCESS_TOKEN_TTL_SECONDS,
  };
}
