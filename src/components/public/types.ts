// Shared public-facing types. These mirror the Prisma models (see
// prisma/schema.prisma) but stay structural so the public components do not
// depend on the generated Prisma client types directly.
export type PublicProductImage = {
  id: string;
  url: string;
  alt?: string | null;
  order: number;
};

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  // Prisma Decimal — always convert with Number() before formatting.
  price: unknown;
  discountPrice?: unknown | null;
  sku?: string | null;
  stock: number;
  status: string;
  featured: boolean;
  category: { id: string; name: string; slug: string };
  images: PublicProductImage[];
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  status: string;
  order: number;
  _count?: { products: number };
};

export type Settings = Record<string, string>;

export function effectivePrice(product: PublicProduct): {
  current: number;
  original: number | null;
} {
  const price = Number(product.price);
  const discount =
    product.discountPrice === null || product.discountPrice === undefined
      ? null
      : Number(product.discountPrice);
  if (discount !== null && !Number.isNaN(discount) && discount > 0 && discount < price) {
    return { current: discount, original: price };
  }
  return { current: price, original: null };
}
