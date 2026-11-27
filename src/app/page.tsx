import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Copy,
  Facebook,
  Gift,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Printer,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCustomerSession } from "@/lib/customer-auth";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import HeroSection from "@/components/public/HeroSection";
import ProductCard from "@/components/public/ProductCard";
import CategoryCard from "@/components/public/CategoryCard";
import type { PublicCategory, PublicProduct } from "@/components/public/types";

export const dynamic = "force-dynamic";

const SERVICE_ICONS: Record<string, LucideIcon> = {
  Gift,
  Printer,
  Copy,
  Image: ImageIcon,
  Sparkles,
  BookOpen,
};

type ServiceItem = {
  title: string;
  description: string;
  icon?: string;
};

function parseServices(raw: string | undefined): ServiceItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ServiceItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ServiceItem).title === "string" &&
        typeof (item as ServiceItem).description === "string",
    );
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const settings = await getSettings();
  const customerSession = await getCustomerSession();
  const customer = customerSession ? { name: customerSession.name } : null;

  // Featured categories: admin-chosen order first, else active by `order`.
  const featuredCategoryIds = (settings.featuredCategoryIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  let categories: PublicCategory[];
  if (featuredCategoryIds.length > 0) {
    const found = await prisma.productCategory.findMany({
      where: { id: { in: featuredCategoryIds }, status: "active" },
      include: {
        _count: {
          select: { products: { where: { status: { not: "hidden" } } } },
        },
      },
    });
    categories = featuredCategoryIds
      .map((id) => found.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
  } else {
    categories = await prisma.productCategory.findMany({
      where: { status: "active" },
      orderBy: { order: "asc" },
      take: 7,
      include: {
        _count: {
          select: { products: { where: { status: { not: "hidden" } } } },
        },
      },
    });
  }

  // Featured products: admin-chosen order first, else featured + available.
  const featuredProductIds = (settings.featuredProductIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  let products: PublicProduct[];
  if (featuredProductIds.length > 0) {
    const found = await prisma.product.findMany({
      where: { id: { in: featuredProductIds }, status: { not: "hidden" } },
      include: {
        category: true,
        images: { orderBy: { order: "asc" } },
      },
    });
    products = featuredProductIds
      .map((id) => found.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  } else {
    products = await prisma.product.findMany({
      where: { featured: true, status: "available" },
      include: {
        category: true,
        images: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
  }

  const services = parseServices(settings.services);
  const whatsappDigits = (settings.whatsapp || "").replace(/\D/g, "");

  return (
    <>
      <Navbar settings={settings} categories={categories} customer={customer} />
      <main className="flex-1">
        <HeroSection settings={settings} />

        {categories.length > 0 && (
          <section id="categories" className="scroll-mt-20 bg-white py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-navy sm:text-3xl">
                Featured Categories
              </h2>
              <p className="mt-2 text-slate-600">
                Explore gifts, printing and stationery by category.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>
          </section>
        )}

        {products.length > 0 && (
          <section className="bg-surface py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-navy sm:text-3xl">
                    Featured Products
                  </h2>
                  <p className="mt-2 text-slate-600">
                    Hand-picked gifts and printing favourites from our shop.
                  </p>
                </div>
                <Link
                  href="/products"
                  className="hidden shrink-0 text-sm font-semibold text-primary hover:text-primary-dark sm:inline-block"
                >
                  View all products →
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="mt-8 text-center sm:hidden">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  View All Products
                </Link>
              </div>
            </div>
          </section>
        )}

        {services.length > 0 && (
          <section id="services" className="scroll-mt-20 bg-white py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-navy sm:text-3xl">
                Our Services
              </h2>
              <p className="mt-2 text-slate-600">
                Everything your creativity needs, under one roof.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => {
                  const Icon = SERVICE_ICONS[service.icon ?? ""] ?? Package;
                  return (
                    <div
                      key={service.title}
                      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold text-navy">
                        {service.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {service.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section id="about" className="scroll-mt-20 bg-surface py-14">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-navy sm:text-3xl">
                {settings.aboutTitle || "About Kazi Gift and Print House"}
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                {settings.aboutText ||
                  "Kazi Gift and Print House is your neighbourhood shop in Chattogram for customized gifts, quality printing, stationery and photocopy. We take pride in careful craftsmanship, honest prices and friendly service — whether it is a single personalized mug or a full batch of business printing."}
              </p>
              <div className="mt-6">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Browse Products
                </Link>
              </div>
            </div>
            <div>
              <Image
                src={settings.heroImage || "/images/hero.svg"}
                alt={settings.aboutTitle || "About Kazi Gift and Print House"}
                width={1200}
                height={900}
                className="h-auto w-full rounded-2xl object-cover shadow-lg"
              />
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-20 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy sm:text-3xl">
              Contact Us
            </h2>
            <p className="mt-2 text-slate-600">
              Visit our shop, call us, or message us on WhatsApp — we are
              happy to help.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {settings.address && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <MapPin className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-semibold text-navy">Address</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {settings.address}
                  </p>
                  {settings.mapsUrl && (
                    <a
                      href={settings.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:text-primary-dark"
                    >
                      View on Google Maps →
                    </a>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <Phone className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-navy">Phone & WhatsApp</h3>
                {settings.phone && (
                  <p className="mt-1 text-sm text-slate-600">
                    <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:text-primary">
                      {settings.phone}
                    </a>
                  </p>
                )}
                {whatsappDigits && (
                  <p className="mt-1">
                    <a
                      href={`https://wa.me/${whatsappDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chat on WhatsApp
                    </a>
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <Mail className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-navy">Email & Hours</h3>
                {settings.email && (
                  <p className="mt-1 text-sm text-slate-600">
                    <a href={`mailto:${settings.email}`} className="hover:text-primary">
                      {settings.email}
                    </a>
                  </p>
                )}
                {settings.openingHours && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    {settings.openingHours}
                  </p>
                )}
                {settings.facebook && (
                  <p className="mt-2">
                    <a
                      href={settings.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark"
                    >
                      <Facebook className="h-4 w-4" />
                      Follow us on Facebook
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer settings={settings} categories={categories} />
    </>
  );
}
