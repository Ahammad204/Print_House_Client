"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  bumpAdminTokenVersion,
  COOKIE_NAME,
  getAdminSession,
} from "@/lib/auth";

/**
 * Logs the admin out by deleting the session cookie.
 * Lives in its own "use server" module so client components (e.g. the
 * Sidebar) can import it without pulling server-only code (next/headers)
 * into the client bundle.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/admin/login");
}

/**
 * Logs the admin out on EVERY device: bumps tokenVersion so all existing
 * session tokens (including this one) stop validating, then clears this
 * device's cookie and sends the admin back to the login page.
 */
export async function logoutEverywhere(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    await bumpAdminTokenVersion(session.id);
  }
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/admin/login");
}
