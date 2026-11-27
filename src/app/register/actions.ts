"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrderSettings } from "@/lib/order-settings";
import {
  isValidBdPhone,
  normalizeBdPhone,
  passwordMeetsRequirements,
  PASSWORD_RULE_TEXT,
} from "@/lib/validation";
import {
  createCustomerSessionToken,
  customerSessionCookieOptions,
  hashPassword,
} from "@/lib/customer-auth";

export type CustomerRegisterState = {
  error?: string;
  ok?: boolean;
  redirectTo?: string;
  /** New customer's name, for the welcome toast. */
  name?: string;
} | null;

/** Only allow safe in-app redirects: absolute paths, never /admin. */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  if (raw === "/admin" || raw.startsWith("/admin/")) return "/account";
  return raw;
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name."),
    phone: z.string().trim().min(1, "Phone number is required."),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Password is required."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    terms: z.string().optional(),
    next: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isValidBdPhone(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX).",
      });
    }
    if (data.email) {
      const email = data.email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Enter a valid email address.",
        });
      }
    }
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
    if (data.terms !== "on") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terms"],
        message: "Please accept the Terms & Privacy Policy to continue.",
      });
    }
  });

/** Read by the register page on mount to show the disabled message. */
export async function getRegistrationEnabled(): Promise<boolean> {
  const settings = await getOrderSettings();
  return settings.enableRegistration;
}

export async function customerRegister(
  _prevState: CustomerRegisterState,
  formData: FormData,
): Promise<CustomerRegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    terms: formData.get("terms"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const settings = await getOrderSettings();
  if (!settings.enableRegistration) {
    return {
      error:
        "Registration is currently disabled. Please contact the shop for help.",
    };
  }

  const phone = normalizeBdPhone(parsed.data.phone);
  if (!phone) {
    return { error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." };
  }
  const email = parsed.data.email
    ? parsed.data.email.trim().toLowerCase()
    : null;

  const existingPhone = await db.customer.findUnique({ where: { phone } });
  if (existingPhone) {
    return {
      error:
        "An account with this phone number already exists. Please log in instead.",
    };
  }
  if (email) {
    const existingEmail = await db.customer.findUnique({ where: { email } });
    if (existingEmail) {
      return {
        error:
          "An account with this email address already exists. Please log in instead.",
      };
    }
  }

  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name: parsed.data.name.trim(),
        phone,
        email,
        password: await hashPassword(parsed.data.password),
        status: "active",
      },
    });

    // Link guest orders placed earlier with the same phone number to the
    // new account, so they show up in /account/orders. A guest order that
    // carries an email only links when it matches the registering email,
    // so another customer's orders can never be claimed.
    await tx.order.updateMany({
      where: {
        customerId: null,
        customerPhone: phone,
        OR: [
          { customerEmail: null },
          ...(email ? [{ customerEmail: email }] : []),
        ],
      },
      data: { customerId: created.id },
    });

    return created;
  });

  const { token, maxAge } = await createCustomerSessionToken(customer.id, false);
  const { name, ...cookieOptions } = customerSessionCookieOptions(maxAge);
  const cookieStore = await cookies();
  cookieStore.set(name, token, cookieOptions);

  // No redirect() here: the client page merges the guest cart first,
  // then navigates to redirectTo with a full page load.
  return {
    ok: true,
    redirectTo: safeNext(parsed.data.next),
    name: customer.name,
  };
}
