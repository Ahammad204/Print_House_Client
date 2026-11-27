"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Gift, Loader2, Lock } from "lucide-react";
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
import { checkResetToken, resetPassword } from "./actions";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, isPending] = useActionState(resetPassword, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenState, setTokenState] = useState<
    { checked: boolean; valid: boolean; name?: string } | null
  >(null);

  useEffect(() => {
    checkResetToken(token)
      .then((result) => setTokenState({ checked: true, ...result }))
      .catch(() => setTokenState({ checked: true, valid: false }));
  }, [token]);

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
          <p className="mt-1 text-sm text-slate-500">Set a New Password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              {tokenState?.valid
                ? `Hello, ${tokenState.name}. Enter a new password for your account.`
                : "Enter a new password for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!tokenState?.checked ? (
              <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking your reset link…
              </p>
            ) : !tokenState.valid ? (
              <div className="space-y-4">
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  This reset link is invalid or has expired. Reset links work
                  once and expire after 1 hour — please request a new one.
                </p>
                <Link
                  href="/forgot-password"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Request a new reset link
                </Link>
              </div>
            ) : state?.ok ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                <p
                  role="status"
                  className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
                >
                  Your password has been changed successfully. You can now log
                  in with your new password.
                </p>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Go to login
                </Link>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
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
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
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
                  {isPending ? "Saving…" : "Change password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-primary hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
