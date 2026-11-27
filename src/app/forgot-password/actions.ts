"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

export type ForgotPasswordState = {
  error?: string;
  ok?: boolean;
  message?: string;
} | null;

// The same message is returned whether or not the account exists, so the
// response never reveals whether a phone number or email is registered.
const GENERIC_MESSAGE =
  "If an account exists for that phone number or email, a password reset link has been prepared. No email or SMS sender is configured yet, so please contact the shop — the shop will share your one-time reset link with you.";

const forgotSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email."),
});

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotSchema.safeParse({
    identifier: formData.get("identifier"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your phone number or email." };
  }

  const identifier = parsed.data.identifier;
  const ip = await clientIp();
  const byIdentifier = checkRateLimit(
    `customer-forgot:${identifier.toLowerCase()}`,
    5,
    10 * 60 * 1000,
  );
  const byIp = checkRateLimit(`customer-forgot-ip:${ip}`, 5, 10 * 60 * 1000);
  const blocked = !byIdentifier.allowed
    ? byIdentifier
    : !byIp.allowed
      ? byIp
      : null;
  if (blocked) {
    return {
      error: `Too many requests. Please try again in ${blocked.retryAfterSeconds} seconds.`,
    };
  }

  // No reset token is created here: there is no email/SMS sender, so a
  // token created by this form would sit unused in the database and could
  // never reach the customer. The only path that creates a reset token is
  // the admin-generated shareable link
  // (generatePasswordResetLink in src/app/admin/customers/[customerId]/actions.ts),
  // which the shop shares privately with the customer.
  return { ok: true, message: GENERIC_MESSAGE };
}
