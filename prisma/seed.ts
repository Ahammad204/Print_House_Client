// Sample/seed data — safe to delete before production.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

/** Deterministic pseudo-random generator (mulberry32) so re-seeds are stable. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261127);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Bank"] as const;

function dateDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  // ---- Admin -------------------------------------------------------------
  const envPassword = process.env.ADMIN_PASSWORD;
  const adminPassword = envPassword || "Admin@1234";
  if (!envPassword) {
    console.warn(
      "WARNING: ADMIN_PASSWORD is not set — seeding the default admin password (Admin@1234). Change it before going live.",
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.admin.upsert({
    where: { email: "admin@kazigiftprint.com" },
    update: { name: "Admin", password: passwordHash },
    create: {
      email: "admin@kazigiftprint.com",
      name: "Admin",
      password: passwordHash,
    },
  });
  console.log(`Admin: ${admin.email}`);

  // ---- Product categories -------------------------------------------------
  const categoryDefs = [
    {
      name: "Gifts",
      slug: "gifts",
      description: "Thoughtful gift items for birthdays, weddings and every occasion.",
      order: 1,
    },
    {
      name: "Stationery",
      slug: "stationery",
      description: "Notebooks, pens and everyday stationery essentials.",
      order: 2,
    },
    {
      name: "Printing",
      slug: "printing",
      description: "Digital printing and photo printing services.",
      order: 3,
    },
    {
      name: "Photocopy",
      slug: "photocopy",
      description: "Fast, clear photocopy for documents, notes and forms.",
      order: 4,
    },
    {
      name: "Customized Gifts",
      slug: "customized-gifts",
      description: "Personalized mugs, frames and gifts made just for you.",
      order: 5,
    },
  ] as const;

  const categoryIds: Record<string, string> = {};
  for (const def of categoryDefs) {
    const category = await prisma.productCategory.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
        status: "active",
        order: def.order,
      },
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        status: "active",
        order: def.order,
      },
    });
    categoryIds[def.slug] = category.id;
  }
  console.log(`Product categories: ${categoryDefs.length}`);

  // ---- Products ------------------------------------------------------------
  const productDefs = [
    {
      name: "Photo Frame",
      slug: "photo-frame",
      description:
        "A beautiful wooden photo frame to display your favourite memories at home or in the office.",
      price: 450,
      discountPrice: null,
      sku: "KGP-001",
      stock: 25,
      status: "available",
      featured: true,
      categorySlug: "gifts",
      image: "/images/products/photo-frame.svg",
    },
    {
      name: "Mug",
      slug: "mug",
      description:
        "A sturdy ceramic mug with a smooth finish — perfect for tea, coffee or a daily desk companion.",
      price: 350,
      discountPrice: null,
      sku: "KGP-002",
      stock: 40,
      status: "available",
      featured: true,
      categorySlug: "gifts",
      image: "/images/products/mug.svg",
    },
    {
      name: "Notebook",
      slug: "notebook",
      description:
        "A premium ruled notebook with smooth pages, ideal for class notes, journaling and everyday writing.",
      price: 120,
      discountPrice: null,
      sku: "KGP-003",
      stock: 120,
      status: "available",
      featured: true,
      categorySlug: "stationery",
      image: "/images/products/notebook.svg",
    },
    {
      name: "Pen",
      slug: "pen",
      description:
        "A smooth-writing ballpoint pen with a comfortable grip, sold individually.",
      price: 45,
      discountPrice: null,
      sku: "KGP-004",
      stock: 300,
      status: "available",
      featured: false,
      categorySlug: "stationery",
      image: "/images/products/pen.svg",
    },
    {
      name: "Customized Photo Mug",
      slug: "customized-photo-mug",
      description:
        "Your photo or message printed on a premium ceramic mug — a personal gift for someone special.",
      price: 550,
      discountPrice: 499,
      sku: "KGP-005",
      stock: 15,
      status: "available",
      featured: true,
      categorySlug: "customized-gifts",
      image: "/images/products/gift-set.svg",
    },
    {
      name: "Printed Photo",
      slug: "printed-photo",
      description:
        "Vivid, high-quality photo prints in standard sizes, printed on glossy photo paper.",
      price: 60,
      discountPrice: null,
      sku: "KGP-006",
      stock: 0,
      status: "out_of_stock",
      featured: false,
      categorySlug: "printing",
      image: "/images/products/printed-photo.svg",
    },
    {
      name: "Gift Box",
      slug: "gift-box",
      description:
        "A ready-to-gift decorated box with ribbon and tissue — just add your gift inside.",
      price: 850,
      discountPrice: 799,
      sku: "KGP-007",
      stock: 18,
      status: "available",
      featured: false,
      categorySlug: "gifts",
      image: "/images/products/gift-box.svg",
    },
  ] as const;

  for (const def of productDefs) {
    const product = await prisma.product.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
        price: def.price,
        discountPrice: def.discountPrice,
        sku: def.sku,
        stock: def.stock,
        status: def.status,
        featured: def.featured,
        categoryId: categoryIds[def.categorySlug],
      },
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        price: def.price,
        discountPrice: def.discountPrice,
        sku: def.sku,
        stock: def.stock,
        status: def.status,
        featured: def.featured,
        categoryId: categoryIds[def.categorySlug],
      },
    });
    // One image per product; replace on re-seed so the seed stays idempotent.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        url: def.image,
        alt: def.name,
        order: 0,
        productId: product.id,
      },
    });
  }
  console.log(`Products: ${productDefs.length}`);

  // ---- Account categories --------------------------------------------------
  const accountCategoryDefs = [
    { name: "Product Sales", type: "income", description: "Income from gift and stationery sales." },
    { name: "Printing Income", type: "income", description: "Income from printing services." },
    { name: "Photocopy Income", type: "income", description: "Income from photocopy services." },
    { name: "Product Purchase", type: "expense", description: "Buying stock from suppliers." },
    { name: "Shop Rent", type: "expense", description: "Monthly shop rent." },
    { name: "Electricity", type: "expense", description: "Monthly electricity bill." },
    { name: "Transportation", type: "expense", description: "Delivery and transport costs." },
    { name: "Other Expenses", type: "expense", description: "Miscellaneous shop expenses." },
  ] as const;

  const accountCategoryIds: Record<string, string> = {};
  for (const def of accountCategoryDefs) {
    const category = await prisma.accountCategory.upsert({
      where: { name_type: { name: def.name, type: def.type } },
      update: { description: def.description, status: "active" },
      create: {
        name: def.name,
        type: def.type,
        description: def.description,
        status: "active",
      },
    });
    accountCategoryIds[`${def.type}:${def.name}`] = category.id;
  }
  console.log(`Account categories: ${accountCategoryDefs.length}`);

  // ---- Transactions (~48 over the last 6 months) ---------------------------
  // Re-create from scratch on each seed so re-running never duplicates rows.
  await prisma.accountTransaction.deleteMany();

  const incomeDescriptions: Record<string, string[]> = {
    "Product Sales": [
      "Gift box and mug sale",
      "Photo frame sale",
      "Notebook and pen sale",
      "Gift items sale to walk-in customer",
      "Stationery sale",
      "Customized mug order payment",
    ],
    "Printing Income": [
      "Colour printing order",
      "Document printing service",
      "Photo printing order",
      "Banner and leaflet printing",
      "Bulk printing for school",
    ],
    "Photocopy Income": [
      "Photocopy service",
      "Bulk photocopy for exam notes",
      "Photocopy and binding",
      "Document photocopy",
    ],
  };
  const expenseDescriptions: Record<string, string[]> = {
    "Product Purchase": [
      "Bought mugs and frames from supplier",
      "Restocked notebooks and pens",
      "Bought gift boxes and wrapping paper",
      "Bought printing paper and ink",
      "Bought photo paper stock",
    ],
    Electricity: [
      "Monthly electricity bill",
      "Electricity bill payment",
    ],
    Transportation: [
      "Delivery to customer",
      "Rickshaw fare for stock pickup",
      "Courier charge for online order",
    ],
    "Other Expenses": [
      "Shop cleaning supplies",
      "Packaging tape and bags",
      "Printer maintenance",
      "Tea and refreshments for staff",
    ],
  };

  type TxInput = {
    type: "income" | "expense";
    amount: number;
    description: string;
    date: Date;
    paymentMethod: (typeof PAYMENT_METHODS)[number];
    categoryId: string;
  };
  const transactions: TxInput[] = [];

  // Shop rent: once per month (~৳8,000) for each of the last 6 months.
  const now = new Date();
  for (let m = 0; m < 6; m++) {
    const rentDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    transactions.push({
      type: "expense",
      amount: 8000,
      description: "Monthly shop rent",
      date: rentDate,
      paymentMethod: "Cash",
      categoryId: accountCategoryIds["expense:Shop Rent"],
    });
  }

  // Remaining 42 transactions spread over the last ~180 days,
  // including today (day 0) and yesterday (day 1).
  const otherCount = 42;
  for (let i = 0; i < otherCount; i++) {
    const isIncome = rand() < 0.62;
    const type = isIncome ? "income" : "expense";
    // Weight towards Product Sales / Product Purchase as the main flows.
    const categoryName = isIncome
      ? pick(["Product Sales", "Product Sales", "Printing Income", "Photocopy Income"] as const)
      : pick(["Product Purchase", "Product Purchase", "Electricity", "Transportation", "Other Expenses"] as const);
    const descriptions = isIncome
      ? incomeDescriptions[categoryName]
      : expenseDescriptions[categoryName];
    const amount = isIncome
      ? Math.round(randInt(100, 15000) / 10) * 10
      : Math.round(randInt(50, 12000) / 10) * 10;
    // Spread days across the last 180 days; first two rows land today/yesterday.
    const dayOffset =
      i === 0 ? 0 : i === 1 ? 1 : Math.floor((i / otherCount) * 180) + randInt(0, 3);
    transactions.push({
      type,
      amount,
      description: pick(descriptions),
      date: dateDaysAgo(Math.min(dayOffset, 180)),
      paymentMethod: pick(PAYMENT_METHODS),
      categoryId: accountCategoryIds[`${type}:${categoryName}`],
    });
  }

  for (const tx of transactions) {
    await prisma.accountTransaction.create({ data: tx });
  }
  console.log(`Transactions: ${transactions.length}`);

  // ---- Website settings ------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.websiteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log(`Website settings: ${Object.keys(DEFAULT_SETTINGS).length}`);

  // ---- Summary ---------------------------------------------------------------
  const counts = {
    admins: await prisma.admin.count(),
    productCategories: await prisma.productCategory.count(),
    products: await prisma.product.count(),
    productImages: await prisma.productImage.count(),
    accountCategories: await prisma.accountCategory.count(),
    transactions: await prisma.accountTransaction.count(),
    websiteSettings: await prisma.websiteSetting.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
