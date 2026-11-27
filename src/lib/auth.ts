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
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Add it to your environment variables.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(adminId: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ sub: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
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
    const adminId = payload.sub;
    if (!adminId) return null;

    const admin = await db.admin.findUnique({ where: { id: adminId } });
    if (!admin) return null;

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
