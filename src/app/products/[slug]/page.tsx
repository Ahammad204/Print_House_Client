import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatBDT } from "@/lib/utils";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import ProductCard from "@/components/public/ProductCard";
import ProductGallery from "@/components/public/ProductGallery";
import { effectivePrice } from "@/components/public/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getSettings();
  const shopName = settings.shopName || "Kazi Gift and Print House";
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, description: true, status: true },
  });
  if (!product || product.status === "hidden") {
    return { title: `Product Not Found | ${shopName}` };
  }
  return {
    title: `${product.name} | ${shopName}`,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const settings = await getSettings();

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { order: "asc" } },
    },
  });

  if (!product || product.status === "hidden") {
    notFound();
  }

  const { current, original } = effectivePrice(product);
  const whatsappDigits = (settings.whatsapp || "").replace(/\D/g, "");
  const whatsappText = encodeURIComponent(
    `Hello, I am interested in ${product.name} from Kazi Gift and Print House. Please provide more details.`,
  );
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${whatsappText}`
    : null;

  const related = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      status: "available",
    },
    include: {
      category: true,
      images: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  const footerCategories = await prisma.productCategory.findMany({
    where: { status: "active" },
    orderBy: { order: "asc" },
    include: {
      _count: {
        select: { products: { where: { status: { not: "hidden" } } } },
      },
    },
  });

  const isAvailable = product.status === "available";

  return (
    <>
      <Navbar settings={settings} categories={footerCategories} />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/products" className="hover:text-primary">
                  Products
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-navy">{product.name}</li>
            </ol>
          </nav>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <ProductGallery
              images={product.images}
              productName={product.name}
            />

            <div>
              <Link
                href={`/products?category=${encodeURIComponent(product.category.slug)}`}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                {product.category.name}
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-navy">
                {product.name}
              </h1>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-navy">
                  {formatBDT(current)}
                </span>
                {original !== null && (
                  <span className="text-lg text-slate-400 line-through">
                    {formatBDT(original)}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isAvailable ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                    Out of Stock
                  </span>
                )}
                {isAvailable && (
                  <span className="text-sm text-slate-600">
                    In stock: {product.stock}
                  </span>
                )}
              </div>

              <p className="mt-6 leading-relaxed text-slate-600">
                {product.description}
              </p>

              <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200">
                {product.sku && (
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-sm font-medium text-slate-500">SKU</dt>
                    <dd className="text-sm font-semibold text-navy">
                      {product.sku}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-sm font-medium text-slate-500">
                    Category
                  </dt>
                  <dd className="text-sm font-semibold text-navy">
                    <Link
                      href={`/products?category=${encodeURIComponent(product.category.slug)}`}
                      className="hover:text-primary"
                    >
                      {product.category.name}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-sm font-medium text-slate-500">Stock</dt>
                  <dd className="text-sm font-semibold text-navy">
                    {product.stock}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-sm font-medium text-slate-500">Status</dt>
                  <dd className="text-sm font-semibold text-navy">
                    {isAvailable ? "Available" : "Out of Stock"}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap gap-4">
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Inquire on WhatsApp
                  </a>
                ) : (
                  <a
                    href="/#contact"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-green-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Contact Us
                  </a>
                )}
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-lg border border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5"
                >
                  Back to Products
                </Link>
              </div>
            </div>
          </div>

          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-bold text-navy">
                Related Products
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
