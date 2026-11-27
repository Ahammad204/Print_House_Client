"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Gift, Loader2, Lock, User } from "lucide-react";
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
import { customerLogin, getCustomerLoginEnabled } from "./actions";
import { clearGuestCart, readGuestCart } from "@/lib/cart-store";

export const dynamic = "force-dynamic";

export default function CustomerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, isPending] = useActionState(customerLogin, null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEnabled, setLoginEnabled] = useState<boolean | null>(null);
  const mergedRef = useRef(false);

  useEffect(() => {
    getCustomerLoginEnabled()
      .then(setLoginEnabled)
      .catch(() => setLoginEnabled(true));
  }, []);

  // On success: merge the guest cart into the account cart first
  // (best effort — a missing/failing endpoint must not block login),
  // then navigate to the requested page.
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
      toast.success("Welcome back!");
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
          <p className="mt-1 text-sm text-slate-500">Customer Login</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Use your phone number or email and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loginEnabled === false ? (
              <p
                role="alert"
                className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
              >
                Customer login is currently disabled. Please contact the shop
                for help.
              </p>
            ) : (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="next" value={next} />
                <div className="space-y-2">
                  <Label htmlFor="identifier">Phone number or email</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="01XXXXXXXXX or you@example.com"
                      required
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
                      autoComplete="current-password"
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
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      className="h-4 w-4 accent-primary"
                    />
                    Remember me (30 days)
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

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
                  {isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
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
