import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { mergeGuestCart } from "@/lib/cart";

/** POST /api/cart/merge { items: [{ productId, quantity }] } — requires a customer session. */
export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }
  try {
    const body: unknown = await request.json();
    const items = (body as { items?: unknown })?.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });
    }
    const parsed = items
      .filter(
        (i): i is { productId: string; quantity: number } =>
          typeof i === "object" &&
          i !== null &&
          typeof (i as { productId?: unknown }).productId === "string" &&
          typeof (i as { quantity?: unknown }).quantity === "number",
      )
      .map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const result = await mergeGuestCart(session.id, parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "Could not merge cart." },
      { status: 500 },
    );
  }
}
