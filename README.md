# Kazi Gift and Print House

A complete full-stack web application for **Kazi Gift and Print House** — a gift,
printing and stationery shop in Bangladesh. Public storefront for customers and a
protected admin panel for managing products, daily accounts, reports and website
settings. Prices in Bangladeshi Taka (৳), timezone Asia/Dhaka.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** + hand-rolled **shadcn/ui** components + **Lucide** icons
- **Prisma ORM 6** with **PostgreSQL**
- Admin auth: credentials login, **bcryptjs** password hashing, **JWT (jose)**
  in an `httpOnly` cookie (`admin_session`), middleware protects `/admin/*`
- **Recharts** (dashboard/report charts), **Zod** (form validation),
  **react-hot-toast** (notifications), **jsPDF** (PDF report export)

Brand colours: Royal Blue `#2563EB`, Navy `#14213D`, Orange `#F59E0B`,
white, light grey `#F8FAFC`.

## What is included

**Public website (no login)**
- Home: sticky navbar (logo, Home, All Products, Categories, About, Contact,
  search, mobile menu), hero — *"Your Creativity, Our Printing & Gift Solutions."* —
  featured categories and products from the database, services, about and contact
  sections (address, phone, WhatsApp, hours, map, Facebook — all from Settings),
  footer.
- `/products`: search (name / description / category), filters (category, min/max
  price, availability, featured), sorting (newest, oldest, price low→high / high→low,
  name A–Z / Z–A), pagination, empty state with reset.
- `/products/[slug]`: large image + extra images, specs, related products, WhatsApp
  inquiry button opening `wa.me` with a pre-filled message, using the WhatsApp
  number from Settings.

**Admin panel (`/admin`, login required)**
- `/admin/login` — credentials login.
- `/admin/dashboard` — summary cards (today's income / expense / net, month's
  income / expense / net with comparisons), Recharts (daily income vs expense,
  monthly income vs expense, category breakdown), recent transactions. All figures
  are computed live from the database — nothing is hardcoded.
- `/admin/products` — full CRUD, search, category/availability filters, featured
  toggle, bulk select/delete, image upload with preview, Zod validation, delete
  confirmations.
- `/admin/categories` — CRUD, slug auto-generation with manual edit,
  duplicate-name prevention, delete blocked when products exist, active/inactive,
  display order, product counts.
- `/admin/accounts` — income/expense transaction CRUD (account category matched to
  type, amount, description, date including past dates, payment method
  Cash / bKash / Nagad / Bank / Other, reference/note), search and filters
  (date, type, category, payment method). Income and expense are visually distinct.
- `/admin/account-categories` — CRUD, type income/expense, status, delete blocked
  when used by transactions.
- `/admin/reports` — daily, monthly and custom-range reports; income / expense /
  net, category breakdowns, transaction lists; **CSV and PDF export** (shop name,
  title, date range, totals, transaction list).
- `/admin/settings` — general (shop name, logo/favicon upload, description, phone,
  WhatsApp, email, address, maps link, Facebook/Instagram, opening hours),
  homepage (hero title/description/image, featured products/categories, about,
  services), appearance (primary/accent colour), SEO (title, meta description,
  OG image). Every setting is stored in the database and reflected on the public
  site immediately.

**Image upload** — `POST /api/upload` accepts image files (max 5 MB) and stores
them under `public/uploads/`. Note: for production, move uploads to object storage
(S3 / Cloudinary / Vercel Blob) — local files do not persist across Vercel
deployments.

## Getting started (local)

### Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (see "Free PostgreSQL" below)

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:password@host:5432/database?sslmode=require` |
| `ADMIN_PASSWORD` | Password for the seed admin account (change before going live) |
| `JWT_SECRET` | Long random string used to sign admin session JWTs |
| `NEXT_PUBLIC_SITE_URL` | Public base URL of the site, e.g. `https://kazigiftprint.com` |

### 3. Free PostgreSQL

- **Neon** — https://neon.tech — create a free project, copy the connection string
  (pooled connection, `?sslmode=require`) into `DATABASE_URL`.
- **Supabase** — https://supabase.com — create a free project, then
  Settings → Database → Connection string (URI) into `DATABASE_URL`.

### 4. Create tables and seed sample data

```bash
npx prisma migrate dev --name init
npm run db:seed        # or: npx prisma db seed
```

The seed creates (all clearly marked as removable sample data in `prisma/seed.ts`):
- Admin user `admin@kazigiftprint.com` (password from `ADMIN_PASSWORD`)
- 5 product categories: Gifts, Stationery, Printing, Photocopy, Customized Gifts
- 7 sample products (Photo Frame, Mug, Notebook, Pen, Customized Photo Mug,
  Printed Photo, Gift Box)
- Income categories (Product Sales, Printing Income, Photocopy Income) and
  expense categories (Product Purchase, Shop Rent, Electricity, Transportation,
  Other Expenses)
- ~48 sample transactions spread over the last 6 months (including today and
  yesterday) so the dashboard charts render
- Default website settings (shop name, tagline, contact details, hero, services, SEO)

To remove the sample data before going live, delete the seeded rows (or clear the
tables and re-seed only what you need) — the seed file is safe to delete once the
real data is in.

### 5. Run

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
```

Useful scripts: `npm run lint`, `npx prisma studio` (database browser),
`npm run prisma:generate` (regenerate the Prisma client after schema changes).

## Default admin login

- URL: `/admin/login`
- Email: `admin@kazigiftprint.com`
- Password: the value of `ADMIN_PASSWORD` in `.env` (required — the seed fails if it is unset; there is no default password)

**Change the password before going live.** The seed upserts the admin account, so
the simplest way is:

```bash
# set a strong password in .env, then re-run the seed
ADMIN_PASSWORD="YourStrongPassword" npm run db:seed
```

(The seed only touches the admin row, categories, products, settings and sample
transactions it owns — re-running it refreshes the admin password hash.)

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repository.
3. Set the environment variables in the project settings:
   `DATABASE_URL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`.
4. Deploy. After the first deploy, run the migration and seed once against the
   production database from your machine:

```bash
DATABASE_URL="<production connection string>" npx prisma migrate deploy
DATABASE_URL="<production connection string>" ADMIN_PASSWORD="<strong password>" \
  JWT_SECRET="<same secret as Vercel>" npm run db:seed
```

(Or add a `vercel.json` build step — the manual run above keeps the admin password
out of build logs.)

5. Open `https://<your-domain>/admin/login` and sign in with the seeded admin.

Notes for production:
- Uploads are stored locally under `public/uploads/` — switch to object storage
  (S3 / Cloudinary / Vercel Blob) before relying on product images in production.
- The sample phone number `+880 1812-345678` and email `info@kazigiftprint.com`
  in Settings are placeholders — update them in **Admin → Settings**.

## Troubleshooting

- `prisma validate` / `prisma generate` failing with a network error on a
  restricted/sandboxed network: Prisma downloads its query/schema engine binaries
  from `binaries.prisma.sh` on first install. If that host is blocked, install
  with `npm install --ignore-scripts`, then download the engines for your
  platform with `curl` and point Prisma at them
  (`PRISMA_SCHEMA_ENGINE_BINARY`, or place the query-engine `.so.node` under
  `node_modules/@prisma/engines/`). On a normal machine or on Vercel this is
  automatic — no workaround is needed.
- All data pages are `force-dynamic`, so `next build` never touches the database.
  If the database is unreachable at runtime, the public site falls back to the
  built-in default settings instead of crashing.

## Customer accounts & e-commerce (added 27 Nov 2026)

The site is now a complete online shop. No new environment variables are
needed — customer sessions reuse `JWT_SECRET` (separate `customer_session`
cookie, separate from the `admin_session` cookie).

**Customer routes:** `/register`, `/login`, `/forgot-password`,
`/reset-password`, `/cart`, `/checkout`, `/order-success/[orderNumber]`,
`/track-order`, `/account` (dashboard), `/account/profile`,
`/account/addresses`, `/account/orders`, `/account/orders/[orderId]`.
Guest checkout works without an account; guests track orders with order
number + phone. Logged-in customers get a database cart (guest localStorage
carts merge into it on login), saved addresses, order history and reorder.

**Admin routes:** `/admin/orders` (+ `/admin/orders/[orderId]`),
`/admin/customers` (+ `/admin/customers/[customerId]`),
`/admin/inventory`, `/admin/settings/orders`.

**Order flow:** Pending → Confirmed → Processing → Ready for Pickup /
Shipped → Delivered (Cancelled is terminal). Order numbers are
`KGP-YYYYMMDD-SEQUENCE` (e.g. `KGP-20261127-0001`), generated server-side.
Prices, stock and totals are always recalculated server-side — the frontend
never supplies them.

**Stock:** checked at order time, deducted only when the admin confirms an
order, restored only when an order is cancelled (both recorded as
`StockMovement` rows; the `stockDeducted` flag prevents double
deduct/restore).

**Accounting:** an order is NOT income until payment is confirmed. Verified
mobile-banking payments and admin-confirmed COD / cash-at-shop payments each
create exactly one income `AccountTransaction` in the "Online Order Sales"
category, linked to the order (reference `pay:<paymentId>`). Cancelling a
paid order records a refund expense ("Order Refunds") — the original income
row is never deleted.

**Order settings** (Admin → Order Settings, stored in the database):
online ordering, guest checkout, registration, login, minimum order amount,
delivery fees (default fee, free-delivery threshold, per-area fees),
payment methods (COD, cash at shop, bKash, Nagad, Rocket) with payment
numbers and instructions, processing/delivery time estimates.

**Notifications & password reset:** order status changes create in-app
notifications (shown on the customer dashboard). There is NO email or SMS
sender configured: `order.emailNotificationsEnabled`,
`order.smsNotificationsEnabled` and `order.otpEnabled` are all OFF by
default and only enable the settings structure. Password reset works with
single-use, 1-hour tokens — the admin generates a reset link from the
customer detail page and shares it with the customer directly (e.g. via
WhatsApp). WhatsApp is click-to-chat links only; no automated sends.

**Migrations:** `prisma/migrations/20261127120000_init` (base tables) and
`prisma/migrations/20261127134500_ecommerce` (Customer, CustomerAddress,
Cart/CartItem, Order, OrderItem, OrderPayment, OrderStatusHistory,
StockMovement, Notification, CustomerResetToken, `Product.lowStockThreshold`,
`AccountTransaction.orderId`). After deploying, apply the new migration
against the production database (`npx prisma migrate deploy`) — the
`_prisma_migrations` bookkeeping row is part of the normal migrate flow.
