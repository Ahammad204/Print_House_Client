import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  Facebook,
  Gift,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import type { PublicCategory, Settings } from "./types";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "All Products", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

export default function Footer({
  settings,
  categories,
}: {
  settings: Settings;
  categories: PublicCategory[];
}) {
  const year = new Date().getFullYear();
  const whatsappDigits = (settings.whatsapp || "").replace(/\D/g, "");

  return (
    <footer className="bg-navy text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            {settings.logo ? (
              <Image
                src={settings.logo}
                alt={settings.shopName || "Kazi Gift and Print House"}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg bg-white object-contain"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                <Gift className="h-5 w-5" />
              </span>
            )}
            <span className="text-lg font-bold leading-tight text-white">
              {settings.shopName || "Kazi Gift and Print House"}
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed">
            {settings.tagline ||
              "Your Creativity, Our Printing & Gift Solutions."}{" "}
            Customized gifts, quality printing, stationery and photocopy — all
            under one roof in Chattogram.
          </p>
          <div className="mt-4 flex gap-3">
            {settings.facebook && (
              <a
                href={settings.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-primary"
              >
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {settings.instagram && (
              <a
                href={settings.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-primary"
              >
                <Instagram className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">Quick Links</h3>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm transition hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">Categories</h3>
          <ul className="mt-4 space-y-2">
            {categories.length > 0 ? (
              categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${encodeURIComponent(category.slug)}`}
                    className="text-sm transition hover:text-white"
                  >
                    {category.name}
                  </Link>
                </li>
              ))
            ) : (
              <li>
                <Link
                  href="/products"
                  className="text-sm transition hover:text-white"
                >
                  All Products
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {settings.address && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{settings.address}</span>
              </li>
            )}
            {settings.phone && (
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:text-white">
                  {settings.phone}
                </a>
              </li>
            )}
            {whatsappDigits && (
              <li className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  WhatsApp: {settings.whatsapp}
                </a>
              </li>
            )}
            {settings.email && (
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <a href={`mailto:${settings.email}`} className="hover:text-white">
                  {settings.email}
                </a>
              </li>
            )}
            {settings.openingHours && (
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{settings.openingHours}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-sm sm:px-6 lg:px-8">
          © {year} Kazi Gift and Print House. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
