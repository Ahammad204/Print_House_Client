"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrderSettings } from "@/lib/order-settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeBdPhone } from "@/lib/validation";
import {
  createCustomerSessionToken,
  customerSessionCookieOptions,
  verifyPassword,
} from "@/lib/customer-auth";

export type CustomerLoginState = {
  error?: string;
  ok?: boolean;
  redirectTo?: string;
} | null;

const GENERIC_ERROR = "Invalid phone/email or password.";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email."),
  password: z.string().min(1, "Password is required."),
  next: z.string().optional(),
});

/** Only allow safe in-app redirects: absolute paths, never /admin. */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  if (raw === "/admin" || raw.startsWith("/admin/")) return "/account";
  return raw;
}

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Read by the login page on mount to show the disabled message. */
export async function getCustomerLoginEnabled(): Promise<boolean> {
  const settings = await getOrderSettings();
  return settings.enableCustomerLogin;
}

export async function customerLogin(
  _prevState: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const settings = await getOrderSettings();
  if (!settings.enableCustomerLogin) {
    return {
      error:
        "Customer login is currently disabled. Please contact the shop for help.",
    };
  }

  const identifier = parsed.data.identifier;
  const ip = await clientIp();

  // Rate limit: 5 attempts / 10 minutes, per identifier and per IP.
  const byIdentifier = checkRateLimit(
    `customer-login:${identifier.toLowerCase()}`,
    5,
    10 * 60 * 1000,
  );
  const byIp = checkRateLimit(`customer-login-ip:${ip}`, 5, 10 * 60 * 1000);
  const blocked = !byIdentifier.allowed
    ? byIdentifier
    : !byIp.allowed
      ? byIp
      : null;
  if (blocked) {
    return {
      error: `Too many login attempts. Please try again in ${blocked.retryAfterSeconds} seconds.`,
    };
  }

  // Look up by phone (normalized BD number) or by email. Anything else
  // fails with the same generic error — never reveal which part failed.
  const phone = normalizeBdPhone(identifier);
  let customer = null;
  if (phone) {
    customer = await db.customer.findUnique({ where: { phone } });
  } else if (identifier.includes("@")) {
    customer = await db.customer.findUnique({
      where: { email: identifier.toLowerCase() },
    });
  }
  if (!customer || customer.status !== "active") {
    return { error: GENERIC_ERROR };
  }

  const valid = await verifyPassword(parsed.data.password, customer.password);
  if (!valid) {
    return { error: GENERIC_ERROR };
  }

  const rememberMe = formData.get("rememberMe") === "on";
  const { token, maxAge } = await createCustomerSessionToken(
    customer.id,
    rememberMe,
  );
  const { name, ...cookieOptions } = customerSessionCookieOptions(maxAge);
  const cookieStore = await cookies();
  cookieStore.set(name, token, cookieOptions);

  // No redirect() here: the client page merges the guest cart first,
  // then navigates to redirectTo.
  return { ok: true, redirectTo: safeNext(parsed.data.next) };
}
