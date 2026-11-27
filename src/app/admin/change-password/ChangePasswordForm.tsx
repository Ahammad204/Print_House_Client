"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import { changeAdminPassword } from "./actions";
import { logoutEverywhere } from "@/app/admin/actions";

export default function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changeAdminPassword,
    null,
  );

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Changing your password signs you out on every other device.
            This device stays signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
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
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
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
            {state?.ok && (
              <p
                role="status"
                className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
              >
                {state.message ?? "Password changed successfully."}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Changing password…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log out everywhere</CardTitle>
          <CardDescription>
            Immediately invalidates the admin session on every device,
            including this one. You will need to sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={logoutEverywhere}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  "Log out on every device, including this one? You will need to sign in again.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Log out everywhere
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
