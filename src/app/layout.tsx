import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { getSettings } from "@/lib/settings";
import "./globals.css";

// Never statically prerender: metadata and pages read live settings/products
// from the database on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings.seoTitle || settings.shopName || "Kazi Gift and Print House";
  const description =
    settings.seoDescription ||
    settings.tagline ||
    "Customized gifts, quality printing, stationery and photocopy in Chattogram.";
  const ogImage = settings.ogImage || "/images/hero.svg";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      title,
      description,
      images: [{ url: ogImage }],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Toaster position="top-right" />
        <div className="flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
