"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import {
  BarChart3,
  Boxes,
  Cog,
  FolderTree,
  Gift,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Tags,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/accounts", label: "Daily Accounts", icon: Wallet },
  { href: "/admin/account-categories", label: "Account Categories", icon: Tags },
  { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Website Settings", icon: Settings },
  { href: "/admin/settings/orders", label: "Order Settings", icon: Cog },
  { href: "/admin/change-password", label: "Change Password", icon: KeyRound },
];

function NavLinks({
  adminName,
  onNavigate,
}: {
  adminName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 pb-6 pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
          <Gift className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white">
            Kazi Gift and Print House
          </p>
          <p className="truncate text-xs text-slate-400">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" &&
              item.href !== "/admin/settings" &&
              pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#2563EB] text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 truncate px-3 text-xs text-slate-400">
          Signed in as <span className="font-medium text-slate-200">{adminName}</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({ adminName }: { adminName: string }) {
  return <NavLinks adminName={adminName} />;
}

export function AdminShell({
  adminName,
  adminEmail,
  children,
}: {
  adminName: string;
  adminEmail: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Toaster position="top-right" />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-[#14213D] md:block">
        <NavLinks adminName={adminName} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#14213D] shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <NavLinks adminName={adminName} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-semibold text-[#14213D] md:hidden">
              Kazi Gift and Print House
            </span>
            <span className="hidden text-sm font-semibold text-[#14213D] md:block">
              Admin Panel
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-slate-800">{adminName}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {adminEmail}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        </header>

        <main className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default Sidebar;
