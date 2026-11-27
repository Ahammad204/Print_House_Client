"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * App Router error boundary for the public site (audit M23). Rendered
 * inside the root layout when a route segment throws during render or in
 * a server component. Offers a retry and a way home instead of Next.js's
 * generic error page.
 */
export default function Error({
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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <AlertTriangle className="h-14 w-14 text-primary" />
      <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        Sorry, this page ran into a problem and couldn&rsquo;t load. Please try
        again — if it keeps happening, contact us on WhatsApp and mention the
        page you were on.
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
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
