"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  bumpCustomerTokenVersion,
  clearCustomerSession,
  createCustomerSessionToken,
  customerSessionCookieOptions,
  getCustomerSession,
  hashPassword,
  verifyPassword,
} from "@/lib/customer-auth";
import {
  isValidBdPhone,
  normalizeBdPhone,
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  await clearCustomerSession();
  redirect("/");
}

/**
 * Logs the customer out on EVERY device: bumps tokenVersion so all
 * existing session tokens (including this one) stop validating, then
 * clears this device's cookie.
 */
export async function logoutEverywhere(): Promise<void> {
  const session = await getCustomerSession();
  if (session) {
    await bumpCustomerTokenVersion(session.id);
  }
  await clearCustomerSession();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationsRead(): Promise<void> {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/account");
  await db.notification.updateMany({
    where: { customerId: session.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/account");
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfileData = {
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
} | null;

/** Read by the profile page to prefill the form. */
export async function getProfileData(): Promise<ProfileData> {
  const session = await getCustomerSession();
  if (!session) return null;
  const customer = await db.customer.findUnique({
    where: { id: session.id },
    select: { name: true, phone: true, email: true, createdAt: true },
  });
  if (!customer) return null;
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    createdAt: customer.createdAt.toISOString(),
  };
}

export type UpdateProfileState = {
  error?: string;
  ok?: boolean;
  message?: string;
} | null;

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name."),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().optional(),
});

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await getCustomerSession();
  if (!session) return { error: "Your session has expired. Please log in again." };

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  if (!isValidBdPhone(parsed.data.phone)) {
    return { error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." };
  }
  const phone = normalizeBdPhone(parsed.data.phone) as string;
  const email = parsed.data.email
    ? parsed.data.email.trim().toLowerCase()
    : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const phoneOwner = await db.customer.findUnique({ where: { phone } });
  if (phoneOwner && phoneOwner.id !== session.id) {
    return {
      error: "This phone number is already used by another account.",
    };
  }
  if (email) {
    const emailOwner = await db.customer.findUnique({ where: { email } });
    if (emailOwner && emailOwner.id !== session.id) {
      return {
        error: "This email address is already used by another account.",
      };
    }
  }

  await db.customer.update({
    where: { id: session.id },
    data: { name: parsed.data.name.trim(), phone, email },
  });
  revalidatePath("/account/profile");
  return { ok: true, message: "Profile updated successfully." };
}

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

export type ChangePasswordState = {
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

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getCustomerSession();
  if (!session) return { error: "Your session has expired. Please log in again." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const customer = await db.customer.findUnique({
    where: { id: session.id },
    select: { password: true },
  });
  if (!customer) return { error: "Your session has expired. Please log in again." };

  const currentValid = await verifyPassword(
    parsed.data.currentPassword,
    customer.password,
  );
  if (!currentValid) {
    return { error: "Your current password is incorrect." };
  }

  await db.$transaction(async (tx) => {
    // Change the password and bump tokenVersion in one update, so every
    // other customer session is invalidated immediately, and delete any
    // unused reset tokens so old links cannot be used after the change.
    await tx.customer.update({
      where: { id: session.id },
      data: {
        password: await hashPassword(parsed.data.newPassword),
        tokenVersion: { increment: 1 },
      },
    });
    await tx.customerResetToken.deleteMany({
      where: { customerId: session.id, usedAt: null },
    });
  });
  // Re-issue this session's token (carrying the new version) so the
  // customer stays signed in on this device.
  const { token, maxAge } = await createCustomerSessionToken(session.id, false);
  const { name, ...cookieOptions } = customerSessionCookieOptions(maxAge);
  const cookieStore = await cookies();
  cookieStore.set(name, token, cookieOptions);
  return { ok: true, message: "Password changed successfully." };
}
