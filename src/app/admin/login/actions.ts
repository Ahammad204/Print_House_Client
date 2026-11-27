"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string } | null;

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid email or password" };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  // Rate limit: 5 attempts / 10 minutes per email and per IP, plus a
  // longer lockout after repeated failures (15 attempts / 1 hour per
  // email). The error is generic — it never reveals whether the email
  // exists.
  const byEmail = checkRateLimit(`admin-login:${email}`, 5, 10 * 60 * 1000);
  const byIp = checkRateLimit(`admin-login-ip:${ip}`, 5, 10 * 60 * 1000);
  const lockout = checkRateLimit(
    `admin-login-lockout:${email}`,
    15,
    60 * 60 * 1000,
  );
  const blocked = !byEmail.allowed
    ? byEmail
    : !byIp.allowed
      ? byIp
      : !lockout.allowed
        ? lockout
        : null;
  if (blocked) {
    return {
      error: `Too many login attempts. Please try again in ${Math.max(1, Math.ceil(blocked.retryAfterSeconds / 60))} minutes.`,
    };
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
  });
  if (!admin) {
    // Same delay and same message as a wrong password — never reveal
    // whether the email exists.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Invalid email or password" };
  }

  const valid = await verifyPassword(parsed.data.password, admin.password);
  if (!valid) {
    // Slow down guessing: a fixed delay on every failed attempt.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Invalid email or password" };
  }

  const token = await createSessionToken(admin.id);
  const cookieStore = await cookies();
  cookieStore.set("admin_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });

  redirect("/admin/dashboard");
}
