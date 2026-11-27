"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  requireAdmin,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import {
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";

export type ChangeAdminPasswordState = {
  error?: string;
  ok?: boolean;
  message?: string;
} | null;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(1, "Enter a new password."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .superRefine((data, ctx) => {
    if (!passwordMeetsRequirements(data.newPassword)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: PASSWORD_RULE_TEXT,
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export async function changeAdminPassword(
  _prevState: ChangeAdminPasswordState,
  formData: FormData,
): Promise<ChangeAdminPasswordState> {
  const session = await requireAdmin();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const admin = await db.admin.findUnique({
    where: { id: session.id },
    select: { password: true },
  });
  if (!admin) return { error: "Your session has expired. Please log in again." };

  const currentValid = await verifyPassword(
    parsed.data.currentPassword,
    admin.password,
  );
  if (!currentValid) {
    return { error: "Your current password is incorrect." };
  }

  // Change the password and bump tokenVersion in one update, so every
  // other admin session is invalidated immediately. Then re-issue this
  // session's token (carrying the new version) so the admin stays signed
  // in on this device.
  await db.admin.update({
    where: { id: session.id },
    data: {
      password: await hashPassword(parsed.data.newPassword),
      tokenVersion: { increment: 1 },
    },
  });
  const token = await createSessionToken(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions.name, token, sessionCookieOptions);

  return { ok: true, message: "Password changed successfully." };
}
