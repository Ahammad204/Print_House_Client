"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Gift, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { customerRegister, getRegistrationEnabled } from "./actions";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import { clearGuestCart, readGuestCart } from "@/lib/cart-store";

export const dynamic = "force-dynamic";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(customerRegister, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const mergedRef = useRef(false);

  useEffect(() => {
    getRegistrationEnabled()
      .then(setRegistrationEnabled)
      .catch(() => setRegistrationEnabled(true));
  }, []);

  // On success: merge the guest cart into the new account cart first
  // (best effort), then navigate to the account dashboard.
  useEffect(() => {
    if (!state?.ok || !state.redirectTo || mergedRef.current) return;
    mergedRef.current = true;
    const redirectTo = state.redirectTo;
    (async () => {
      const items = readGuestCart();
      if (items.length > 0) {
        try {
          await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
        } catch {
          // Tolerate merge failures silently.
        }
        clearGuestCart();
      }
      toast.success("Welcome to Kazi Gift and Print House!");
      router.push(redirectTo);
    })();
  }, [state, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-md">
            <Gift className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-navy">
            Kazi Gift and Print House
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create a Customer Account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Register once to track orders, save addresses and check out faster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registrationEnabled === false ? (
              <p
                role="alert"
                className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              >
                Registration is currently disabled. Please contact the shop for
                help.
              </p>
            ) : (
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="font-normal text-slate-400">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      required
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-navy"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      required
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-navy"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    name="terms"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    I agree to the Terms &amp; Privacy Policy of Kazi Gift and
                    Print House.
                  </span>
                </label>

                {state?.error && (
                  <p
                    role="alert"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {state.error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? "Creating account…" : "Create account"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-primary hover:underline">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}
