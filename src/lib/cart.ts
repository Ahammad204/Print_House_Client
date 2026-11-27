import { db } from "@/lib/db";

/**
 * Database cart helpers (server-only). The mutation functions here are plain
 * server helpers — the actual server actions that client components call live
 * in `src/app/cart/actions.ts`, which wraps these with a session check.
 */

export type DbCartItemWithProduct = {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    discountPrice: number | null;
    stock: number;
    status: string;
    image: string | null;
    categoryName: string | null;
  };
};

/** Find the customer's cart, creating it when missing. */
export async function getDbCart(customerId: string) {
  const existing = await db.cart.findUnique({
    where: { customerId },
  });
  if (existing) return existing;
  return db.cart.create({ data: { customerId } });
}

/** Cart with items, each joined to its product (first image + category). */
export async function getDbCartWithItems(
  customerId: string,
): Promise<DbCartItemWithProduct[]> {
  const cart = await db.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: {
              category: { select: { name: true } },
              images: { orderBy: { order: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!cart) return [];
  return cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(item.product.price),
      discountPrice:
        item.product.discountPrice === null
          ? null
          : Number(item.product.discountPrice),
      stock: item.product.stock,
      status: item.product.status,
      image: item.product.images[0]?.url ?? null,
      categoryName: item.product.category?.name ?? null,
    },
  }));
}

function capAtStock(requested: number, stock: number): number {
  return Math.max(0, Math.min(Math.floor(requested), stock));
}

/**
 * Add a product to the DB cart (combining with an existing line). Quantity
 * is capped at available stock. Throws a friendly error when the product
 * does not exist, is not orderable, or is out of stock.
 */
export async function addToDbCart(
  customerId: string,
  productId: string,
  qty: number,
): Promise<{ quantity: number; capped: boolean }> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found.");
  if (product.status !== "available") {
    throw new Error(`"${product.name}" is not available for ordering right now.`);
  }
  if (product.stock <= 0) {
    throw new Error(`"${product.name}" is out of stock.`);
  }
  const wanted = Math.max(1, Math.floor(qty));
  const quantity = capAtStock(wanted, product.stock);
  const cart = await getDbCart(customerId);
  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  const finalQty = existing
    ? capAtStock(existing.quantity + quantity, product.stock)
    : quantity;
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    update: { quantity: finalQty },
    create: { cartId: cart.id, productId, quantity: finalQty },
  });
  return {
    quantity: finalQty,
    capped: finalQty < (existing ? existing.quantity + wanted : wanted),
  };
}

/**
 * Set a cart line's quantity. qty < 1 deletes the line. Quantity is capped
 * at stock; a line whose product is out of stock is removed.
 */
export async function updateDbCartItem(
  customerId: string,
  itemId: string,
  qty: number,
): Promise<{ quantity: number; capped: boolean; removed: boolean }> {
  const item = await db.cartItem.findFirst({
    where: { id: itemId, cart: { customerId } },
    include: { product: true },
  });
  if (!item) throw new Error("Cart item not found.");
  const wanted = Math.floor(qty);
  if (wanted < 1 || item.product.stock <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return { quantity: 0, capped: false, removed: true };
  }
  const quantity = capAtStock(wanted, item.product.stock);
  await db.cartItem.update({
    where: { id: item.id },
    data: { quantity },
  });
  return { quantity, capped: quantity < wanted, removed: false };
}

export async function removeDbCartItem(
  customerId: string,
  itemId: string,
): Promise<void> {
  await db.cartItem.deleteMany({
    where: { id: itemId, cart: { customerId } },
  });
}

export async function clearDbCart(customerId: string): Promise<void> {
  const cart = await db.cart.findUnique({ where: { customerId } });
  if (!cart) return;
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
}

/**
 * Merge guest (localStorage) cart lines into the DB cart after login.
 * Quantities combine with existing DB lines and are capped at stock.
 * Hidden / out-of-stock / missing products are skipped.
 */
export async function mergeGuestCart(
  customerId: string,
  items: { productId: string; quantity: number }[],
): Promise<{ merged: number; skipped: number }> {
  const deduped = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Math.floor(item.quantity);
    if (!Number.isFinite(qty) || qty < 1) continue;
    deduped.set(item.productId, (deduped.get(item.productId) ?? 0) + qty);
  }
  if (deduped.size === 0) return { merged: 0, skipped: 0 };

  const products = await db.product.findMany({
    where: { id: { in: [...deduped.keys()] } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const cart = await getDbCart(customerId);

  let merged = 0;
  let skipped = 0;
  for (const [productId, qty] of deduped) {
    const product = byId.get(productId);
    if (!product || product.status !== "available" || product.stock <= 0) {
      skipped += 1;
      continue;
    }
    const wanted = capAtStock(qty, product.stock);
    const existing = await db.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const finalQty = existing
      ? capAtStock(existing.quantity + wanted, product.stock)
      : wanted;
    await db.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: finalQty },
      create: { cartId: cart.id, productId, quantity: finalQty },
    });
    merged += 1;
  }
  return { merged, skipped };
}
