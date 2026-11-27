"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  User,
  X,
} from "lucide-react";
import type { PublicCategory, Settings } from "./types";
import CartBadge from "./CartBadge";
import { logout } from "@/app/account/actions";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "All Products", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "About Us", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

const ACCOUNT_LINKS = [
  { label: "My Dashboard", href: "/account", icon: LayoutDashboard },
  { label: "My Orders", href: "/account/orders", icon: Package },
  { label: "My Profile", href: "/account/profile", icon: User },
  { label: "Saved Addresses", href: "/account/addresses", icon: MapPin },
];

export default function Navbar({
  settings,
  customer,
}: {
  settings: Settings;
  categories?: PublicCategory[];
  customer?: { name: string } | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    setSearchOpen(false);
    setMenuOpen(false);
  }

  function closeAll() {
    setMenuOpen(false);
    setAccountOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {settings.logo ? (
            <Image
              src={settings.logo}
              alt={settings.shopName || "Kazi Gift and Print House"}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <Gift className="h-5 w-5" />
            </span>
          )}
          <span className="text-lg font-bold leading-tight text-navy">
            {settings.shopName || "Kazi Gift and Print House"}
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy transition hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex items-center gap-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                autoFocus
                className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-56"
              />
              <button
                type="submit"
                aria-label="Search"
                className="rounded-lg p-2 text-navy transition hover:bg-slate-100"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-2 text-navy transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              aria-label="Search products"
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 text-navy transition hover:bg-slate-100"
            >
              <Search className="h-5 w-5" />
            </button>
          )}

          <CartBadge customer={customer} />

          {customer ? (
            <div className="relative hidden md:block">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-100"
              >
                <User className="h-5 w-5" />
                <span className="max-w-28 truncate">{customer.name}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${accountOpen ? "rotate-180" : ""}`}
                />
              </button>
              {accountOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close account menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      My Account
                    </p>
                    {ACCOUNT_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        onClick={closeAll}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-navy transition hover:bg-slate-100"
                      >
                        <link.icon className="h-4 w-4 text-slate-400" />
                        {link.label}
                      </Link>
                    ))}
                    <form
                      action={logout}
                      className="border-t border-slate-100"
                    >
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-100"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Register
              </Link>
            </div>
          )}

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-navy transition hover:bg-slate-100 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-navy transition hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 border-t border-slate-100" />
            {customer ? (
              <>
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  My Account — {customer.name}
                </p>
                {ACCOUNT_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy transition hover:bg-slate-100"
                  >
                    <link.icon className="h-4 w-4 text-slate-400" />
                    {link.label}
                  </Link>
                ))}
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <div className="flex gap-2 px-1 pt-1">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-navy transition hover:bg-slate-100"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
