"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string } | null;

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

  const admin = await prisma.admin.findUnique({
    where: { email: parsed.data.email },
  });
  if (!admin) {
    return { error: "Invalid email or password" };
  }

  const valid = await verifyPassword(parsed.data.password, admin.password);
  if (!valid) {
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
