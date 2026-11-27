"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/auth";

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
