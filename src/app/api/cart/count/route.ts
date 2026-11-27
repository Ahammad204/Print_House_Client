import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";

/** GET /api/cart/count → { count } — total quantity in the DB cart, else 0. Never throws. */
export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ count: 0 });
    const cart = await db.cart.findUnique({
      where: { customerId: session.id },
      include: { items: { select: { quantity: true } } },
    });
    const count =
      cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
