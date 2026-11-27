"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Gift, Loader2, Mail, User } from "lucide-react";
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
import { requestPasswordReset } from "./actions";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    null,
  );

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
          <p className="mt-1 text-sm text-slate-500">Reset Your Password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              Enter the phone number or email you registered with and we will
              prepare a password reset link for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                No email or SMS sender is configured yet, so the reset link
                cannot be sent to you automatically. After you submit this
                form, please contact the shop — the shop will share your
                one-time reset link with you.
              </p>
            </div>

            {state?.ok && state.message ? (
              <p
                role="status"
                className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
              >
                {state.message}
              </p>
            ) : (
              <form action={formAction} className="space-y-4">
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
                  {isPending ? "Submitting…" : "Request reset link"}
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
