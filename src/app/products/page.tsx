import Link from "next/link";
import { SearchX } from "lucide-react";
import { db as prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import ProductCard from "@/components/public/ProductCard";
import type { PublicCategory } from "@/components/public/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const settings = await getSettings();

  const q = first(params.q).trim();
  const categorySlug = first(params.category).trim();
  const minPriceRaw = first(params.minPrice).trim();
  const maxPriceRaw = first(params.maxPrice).trim();
  const availability = first(params.availability).trim();
  const featured = first(params.featured).trim();
  const sort = first(params.sort).trim() || "newest";
  const pageRaw = parseInt(first(params.page), 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : NaN;
  const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : NaN;

  const where = {
    status: { not: "hidden" },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            {
              category: {
                name: { contains: q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)
      ? {
          price: {
            ...(Number.isNaN(minPrice) ? {} : { gte: minPrice }),
            ...(Number.isNaN(maxPrice) ? {} : { lte: maxPrice }),
          },
        }
      : {}),
    ...(availability === "available" || availability === "out_of_stock"
      ? { status: availability }
      : {}),
    ...(featured === "1" ? { featured: true } : {}),
  };

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "price-asc"
        ? { price: "asc" as const }
        : sort === "price-desc"
          ? { price: "desc" as const }
          : sort === "name-asc"
            ? { name: "asc" as const }
            : sort === "name-desc"
              ? { name: "desc" as const }
              : { createdAt: "desc" as const };

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: true,
        images: { orderBy: { order: "asc" } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.productCategory.findMany({
      where: { status: "active" },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { products: { where: { status: { not: "hidden" } } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // If the requested page is past the end, show the last page's results.
  const pageProducts =
    page > totalPages
      ? await prisma.product.findMany({
          where,
          include: {
            category: true,
            images: { orderBy: { order: "asc" } },
          },
          orderBy,
          skip: (currentPage - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : products;

  function pageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categorySlug) sp.set("category", categorySlug);
    if (minPriceRaw) sp.set("minPrice", minPriceRaw);
    if (maxPriceRaw) sp.set("maxPrice", maxPriceRaw);
    if (availability) sp.set("availability", availability);
    if (featured) sp.set("featured", featured);
    if (sort && sort !== "newest") sp.set("sort", sort);
    if (targetPage > 1) sp.set("page", String(targetPage));
    const query = sp.toString();
    return query ? `/products?${query}` : "/products";
  }

  const footerCategories: PublicCategory[] = categories;
  const hasActiveFilters =
    Boolean(q) ||
    Boolean(categorySlug) ||
    Boolean(minPriceRaw) ||
    Boolean(maxPriceRaw) ||
    Boolean(availability) ||
    featured === "1";

  return (
    <>
      <Navbar settings={settings} categories={footerCategories} />
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-navy">All Products</h1>
          <p className="mt-2 text-slate-600">
            {total > 0
              ? `${total} ${total === 1 ? "product" : "products"} found`
              : "Browse gifts, printing and stationery from our shop."}
          </p>

          <form
            method="get"
            action="/products"
            className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <label
                  htmlFor="filter-q"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Search
                </label>
                <input
                  id="filter-q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Search products…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-category"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Category
                </label>
                <select
                  id="filter-category"
                  name="category"
                  defaultValue={categorySlug}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="filter-minPrice"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Min price (৳)
                </label>
                <input
                  id="filter-minPrice"
                  name="minPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={minPriceRaw}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-maxPrice"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Max price (৳)
                </label>
                <input
                  id="filter-maxPrice"
                  name="maxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={maxPriceRaw}
                  placeholder="No limit"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-availability"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Availability
                </label>
                <select
                  id="filter-availability"
                  name="availability"
                  defaultValue={availability}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="filter-sort"
                  className="mb-1 block text-sm font-medium text-navy"
                >
                  Sort by
                </label>
                <select
                  id="filter-sort"
                  name="sort"
                  defaultValue={sort}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy">
                  <input
                    type="checkbox"
                    name="featured"
                    value="1"
                    defaultChecked={featured === "1"}
                    className="h-4 w-4 accent-primary"
                  />
                  Featured only
                </label>
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Apply Filters
                </button>
                {hasActiveFilters && (
                  <Link
                    href="/products"
                    className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-navy transition hover:bg-slate-100"
                  >
                    Reset filters
                  </Link>
                )}
              </div>
            </div>
          </form>

          {pageProducts.length > 0 ? (
            <>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pageProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-10 flex items-center justify-center gap-2"
                >
                  {currentPage > 1 ? (
                    <Link
                      href={pageHref(currentPage - 1)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy transition hover:bg-slate-100"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400">
                      ← Previous
                    </span>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNumber) => (
                      <Link
                        key={pageNumber}
                        href={pageHref(pageNumber)}
                        aria-current={
                          pageNumber === currentPage ? "page" : undefined
                        }
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          pageNumber === currentPage
                            ? "bg-primary text-white"
                            : "border border-slate-300 bg-white text-navy hover:bg-slate-100"
                        }`}
                      >
                        {pageNumber}
                      </Link>
                    ),
                  )}
                  {currentPage < totalPages ? (
                    <Link
                      href={pageHref(currentPage + 1)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy transition hover:bg-slate-100"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400">
                      Next →
                    </span>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SearchX className="h-8 w-8" />
              </span>
              <h2 className="mt-4 text-xl font-bold text-navy">
                No products found
              </h2>
              <p className="mx-auto mt-2 max-w-md text-slate-600">
                We could not find any products matching your filters. Try a
                different search or clear the filters to see everything.
              </p>
              <Link
                href="/products"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Reset filters
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer settings={settings} categories={footerCategories} />
    </>
  );
}
