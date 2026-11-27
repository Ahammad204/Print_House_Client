import Image from "next/image";
import Link from "next/link";
import type { Settings } from "./types";

export default function HeroSection({ settings }: { settings: Settings }) {
  const heroImage = settings.heroImage || "/images/hero.svg";
  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20 lg:px-8">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-navy sm:text-5xl">
            {settings.heroTitle ||
              "Your Creativity, Our Printing & Gift Solutions."}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {settings.heroDescription ||
              "Customized gifts, quality printing, stationery and photocopy — everything your creativity needs, under one roof in Chattogram."}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
            >
              Browse Products
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5"
            >
              Contact Us
            </Link>
          </div>
        </div>
        <div className="relative">
          <Image
            src={heroImage}
            alt={settings.shopName || "Kazi Gift and Print House"}
            width={1200}
            height={900}
            priority
            className="h-auto w-full rounded-2xl object-cover shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}
