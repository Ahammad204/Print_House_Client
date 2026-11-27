"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";
import {
  consumePasswordResetTokenAtomic,
  hashPassword,
  verifyPasswordResetToken,
} from "@/lib/customer-auth";

export type ResetPasswordState = {
  error?: string;
  ok?: boolean;
} | null;

/** Read by the reset page on mount to validate the token before showing the form. */
export async function checkResetToken(
  rawToken: string,
): Promise<{ valid: boolean; name?: string }> {
  if (!rawToken) return { valid: false };
  const customer = await verifyPasswordResetToken(rawToken);
  if (!customer) return { valid: false };
  return { valid: true, name: customer.name };
}

const resetSchema = z
  .object({
    token: z.string().min(1, "Reset link is missing or invalid."),
    password: z.string().min(1, "Enter a new password."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .superRefine((data, ctx) => {
    if (!passwordMeetsRequirements(data.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: PASSWORD_RULE_TEXT,
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  // Modest rate limit: 5 attempts / 10 minutes per IP and per reset link,
  // so a stolen link cannot be brute-forced or replayed at will.
  const ip = await clientIp();
  const byIp = checkRateLimit(`reset-password-ip:${ip}`, 5, 10 * 60 * 1000);
  const byToken = checkRateLimit(
    `reset-password:${parsed.data.token}`,
    5,
    10 * 60 * 1000,
  );
  const blocked = !byIp.allowed ? byIp : !byToken.allowed ? byToken : null;
  if (blocked) {
    return {
      error: `Too many attempts. Please try again in ${blocked.retryAfterSeconds} seconds.`,
    };
  }

  const customer = await verifyPasswordResetToken(parsed.data.token);
  if (!customer) {
    return {
      error:
        "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  // Consume the token and change the password atomically: the token is
  // marked used only if it is still unused and unexpired, in the same
  // transaction as the password update. If zero rows matched, a
  // concurrent request already used the token — fail the reset.
  // The password change also bumps tokenVersion (invalidating all other
  // sessions) and deletes any other unused reset tokens for the customer.
  const hashed = await hashPassword(parsed.data.password);
  const result = await db.$transaction(async (tx) => {
    const consumed = await consumePasswordResetTokenAtomic(
      tx,
      parsed.data.token,
    );
    if (consumed === 0) return { ok: false as const };
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      },
    });
    await tx.customerResetToken.deleteMany({
      where: { customerId: customer.id, usedAt: null },
    });
    return { ok: true as const };
  });
  if (!result.ok) {
    return {
      error:
        "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  return { ok: true };
}
