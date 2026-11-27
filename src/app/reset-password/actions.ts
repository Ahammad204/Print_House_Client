"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";
import {
  consumePasswordResetToken,
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

  const customer = await verifyPasswordResetToken(parsed.data.token);
  if (!customer) {
    return {
      error:
        "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  await db.customer.update({
    where: { id: customer.id },
    data: { password: await hashPassword(parsed.data.password) },
  });
  await consumePasswordResetToken(parsed.data.token);

  return { ok: true };
}
