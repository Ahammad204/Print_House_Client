"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, LONG_TRANSACTION } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import {
  CUSTOMER_CANCELLABLE_FROM,
  getOrderForCustomer,
  transitionOrderStatus,
} from "@/lib/orders";

export async function cancelCustomerOrder(orderId: string): Promise<void> {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/account/orders");

  const order = await getOrderForCustomer(orderId, session.id);
  if (!order) redirect("/account/orders");
  if (
    !(CUSTOMER_CANCELLABLE_FROM as readonly string[]).includes(order.status)
  ) {
    redirect(`/account/orders/${orderId}`);
  }

  await db.$transaction(async (tx) => {
    await transitionOrderStatus(
      tx,
      orderId,
      "cancelled",
      "customer",
      session.id,
      "Cancelled by customer",
    );
  }, LONG_TRANSACTION);

  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account/orders");
  revalidatePath("/account");
  redirect(`/account/orders/${orderId}`);
}
