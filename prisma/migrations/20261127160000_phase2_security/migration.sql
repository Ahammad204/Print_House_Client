-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_orderId_reference_key" ON "AccountTransaction"("orderId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");


-- Phase 2 (security & data integrity) — hand-written constraints Prisma cannot
-- express in the datamodel. DO NOT apply to production until the read-only
-- pre-checks pass (see AUDIT-REPORT Phase 2 notes):
--   (a) no duplicate (method, trxId) among OrderPayment rows with trxId set,
--   (b) no duplicate (orderId, reference) among AccountTransaction rows,
--   (c) no Product with stock < 0,
--   (d) no Order with two OrderItems for the same productId.
-- If any check finds rows, resolve the data first — otherwise this migration
-- will fail on the offending CREATE UNIQUE INDEX / CHECK.

-- C1: one mobile-payment TrxID can pay only one order (partial unique index;
-- NULL trxId values, e.g. COD/cash rows, are exempt). The status filter
-- matches the application-level reuse checks (pending_verification /
-- verified only): a TrxID on a REJECTED payment can be submitted again,
-- and a cancelled unpaid order's TrxID is reusable once its payment
-- status is set back to unpaid (M10). A TrxID on a verified (or refunded)
-- payment stays burned, which is correct — that money is spent/returned.
CREATE UNIQUE INDEX "OrderPayment_method_trxId_key" ON "OrderPayment"("method", "trxId") WHERE "trxId" IS NOT NULL AND "status" IN ('pending_verification', 'verified');

-- H7: stock can never go below zero at the database level.
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_non_negative" CHECK ("stock" >= 0);
