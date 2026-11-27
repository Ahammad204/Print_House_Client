"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * App Router error boundary for the admin section (audit M23). Rendered
 * inside the admin layout when an admin page throws during render or in
 * a server component. Offers a retry and a way back to the dashboard
 * instead of Next.js's generic error page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <AlertTriangle className="h-14 w-14 text-primary" />
      <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">
        Something went wrong in the admin panel
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        This admin page ran into a problem and couldn&rsquo;t load. Your data
        is safe — try loading the page again, or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-slate-400">Error reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
        >
          Try again
        </button>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
