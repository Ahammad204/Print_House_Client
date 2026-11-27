"use client";

import { useActionState, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from "lucide-react";
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
import {
  changePassword,
  getProfileData,
  updateProfile,
  type ProfileData,
} from "../actions";
import { formatDate } from "@/lib/utils";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    null,
  );
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    getProfileData()
      .then((data) => {
        setProfile(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (profileState?.ok) toast.success(profileState.message ?? "Profile updated.");
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.ok) toast.success(passwordState.message ?? "Password changed.");
  }, [passwordState]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your profile…
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          We could not load your profile. Please log in again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">My Profile</h1>
      <p className="mt-1 text-slate-600">
        Member since {formatDate(profile.createdAt)}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Update your name, phone number and email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  defaultValue={profile.name}
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
                  defaultValue={profile.phone}
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
                  defaultValue={profile.email ?? ""}
                  placeholder="you@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
              Phone and email verification by OTP is not configured yet — your
              new details are saved as entered. If you change your phone or
              email, make sure they are correct so the shop can reach you.
            </p>

            {profileState?.error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {profileState.error}
              </p>
            )}
            {profileState?.ok && (
              <p
                role="status"
                className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
              >
                {profileState.message}
              </p>
            )}

            <Button type="submit" disabled={profilePending}>
              {profilePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {profilePending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6" id="change-password">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Enter your current password, then choose a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-navy"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  aria-label={showNew ? "Hide password" : "Show password"}
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-navy"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

            {passwordState?.error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {passwordState.error}
              </p>
            )}
            {passwordState?.ok && (
              <p
                role="status"
                className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
              >
                {passwordState.message}
              </p>
            )}

            <Button type="submit" disabled={passwordPending}>
              {passwordPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {passwordPending ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
