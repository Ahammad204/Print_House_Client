"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Root-level error boundary (audit M23). Unlike error.tsx this replaces
 * the whole document — including the root layout — so it must render its
 * own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <AlertTriangle size={56} color="#2563eb" />
          <h1 style={{ marginTop: "1rem", fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", maxWidth: "28rem", color: "#475569" }}>
            Sorry, the site ran into a problem and couldn&rsquo;t load. Please
            try again — if it keeps happening, contact the shop and mention
            the page you were on.
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Error reference: {error.digest}
            </p>
          )}
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.5rem",
                backgroundColor: "#2563eb",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.5rem",
                border: "1px solid #2563eb",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#2563eb",
                textDecoration: "none",
              }}
            >
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
