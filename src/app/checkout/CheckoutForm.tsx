"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { formatBDT } from "@/lib/utils";
import { formatDeliveryAddress } from "@/lib/orders";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/validation";
import {
  readGuestCart,
  clearGuestCart,
} from "@/lib/cart-store";
import { placeOrder } from "./actions";

export type CheckoutAddress = {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  street: string;
  postalCode: string | null;
  instructions: string | null;
  isDefault: boolean;
};

export type CheckoutLine = {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  stock: number;
  status: string;
};

export type CheckoutSettings = {
  enableHomeDelivery: boolean;
  enablePickup: boolean;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryAreas: { area: string; fee: number }[];
  enableCod: boolean;
  enableCashAtShop: boolean;
  enableBkash: boolean;
  enableNagad: boolean;
  enableRocket: boolean;
  bkashNumber: string;
  bkashInstructions: string;
  nagadNumber: string;
  nagadInstructions: string;
  rocketNumber: string;
  rocketInstructions: string;
  estimatedProcessingTime: string;
  estimatedDeliveryTime: string;
};

type ProductSnapshot = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  image: string | null;
  stock: number;
  status: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  cash_at_shop: "Cash at Shop",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
};

const MOBILE_METHODS = ["bkash", "nagad", "rocket"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const labelCls = "mb-1 block text-sm font-medium text-navy";

export default function CheckoutForm({
  isLoggedIn,
  customer,
  addresses,
  initialItems,
  settings,
  shopAddress,
}: {
  isLoggedIn: boolean;
  customer: { name: string; phone: string; email: string | null } | null;
  addresses: CheckoutAddress[];
  initialItems: CheckoutLine[];
  settings: CheckoutSettings;
  shopAddress: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [lines, setLines] = useState<CheckoutLine[]>(initialItems);
  const [loadingGuest, setLoadingGuest] = useState(!isLoggedIn);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // M21: one idempotency key per checkout attempt, generated when the
  // checkout session starts and stable across retries of the same
  // attempt (so a retry after a dropped response replays to the same
  // order instead of creating a duplicate). Persisted in sessionStorage
  // so a page reload mid-submit does not start a new attempt with a
  // fresh key. Regenerated after a successful order, so a later new
  // order gets a fresh key.
  const IDEMPOTENCY_KEY_STORAGE = "kgp-checkout-idempotency-key";
  const idempotencyKeyRef = useRef<string | null>(null);
  function getIdempotencyKey(): string {
    if (idempotencyKeyRef.current) return idempotencyKeyRef.current;
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
        if (stored) {
          idempotencyKeyRef.current = stored;
          return stored;
        }
      } catch {
        // Storage unavailable (private mode, etc.) — fall through to memory.
      }
    }
    const fresh = crypto.randomUUID();
    idempotencyKeyRef.current = fresh;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh);
      } catch {
        // Ignore — the in-memory key still deduplicates this attempt.
      }
    }
    return fresh;
  }
  function regenerateIdempotencyKey(): void {
    const fresh = crypto.randomUUID();
    idempotencyKeyRef.current = fresh;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh);
      } catch {
        // Ignore.
      }
    }
  }

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [addressId, setAddressId] = useState<string | "new">(
    addresses.find((a) => a.isDefault)?.id ?? "new",
  );
  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "pickup">(
    settings.enableHomeDelivery ? "home" : "pickup",
  );
  const [deliveryName, setDeliveryName] = useState(customer?.name ?? "");
  const [deliveryPhone, setDeliveryPhone] = useState(customer?.phone ?? "");
  const [street, setStreet] = useState("");
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState("");
  const [area, setArea] = useState("");
  const [areaOther, setAreaOther] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [instructions, setInstructions] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<string>(
    settings.enableCod
      ? "cod"
      : settings.enableCashAtShop
        ? "cash_at_shop"
        : settings.enableBkash
          ? "bkash"
          : settings.enableNagad
            ? "nagad"
            : settings.enableRocket
              ? "rocket"
              : "",
  );
  const [trxId, setTrxId] = useState("");
  const [senderPhone, setSenderPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  // Prefill from the saved (default) address on first render.
  useEffect(() => {
    const def = addresses.find((a) => a.isDefault);
    if (def) fillAddress(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillAddress(a: CheckoutAddress) {
    setDeliveryName(a.fullName);
    setDeliveryPhone(a.phone);
    setDivision(a.division);
    setDistrict(a.district);
    setUpazila(a.upazila);
    setArea(a.area);
    setAreaOther(
      settings.deliveryAreas.length > 0 &&
        !settings.deliveryAreas.some(
          (d) => d.area.toLowerCase() === a.area.toLowerCase(),
        ),
    );
    setStreet(a.street);
    setPostalCode(a.postalCode ?? "");
    setInstructions(a.instructions ?? "");
  }

  // Guest cart lives in localStorage — resolve it against live product data.
  useEffect(() => {
    if (isLoggedIn) return;
    const guestItems = readGuestCart();
    if (guestItems.length === 0) {
      setLines([]);
      setLoadingGuest(false);
      return;
    }
    fetch(
      `/api/cart/products?ids=${encodeURIComponent(guestItems.map((i) => i.productId).join(","))}`,
    )
      .then((r) => r.json() as Promise<ProductSnapshot[]>)
      .then((products) => {
        const byId = new Map(products.map((p) => [p.id, p]));
        setLines(
          guestItems
            .map((item) => {
              const p = byId.get(item.productId);
              if (!p) return null;
              const hasDiscount =
                p.discountPrice !== null &&
                p.discountPrice > 0 &&
                p.discountPrice < p.price;
              return {
                productId: p.id,
                name: p.name,
                slug: p.slug,
                image: p.image,
                unitPrice: hasDiscount ? p.discountPrice! : p.price,
                originalPrice: p.price,
                quantity: Math.min(item.quantity, Math.max(0, p.stock)),
                stock: p.stock,
                status: p.status,
              } satisfies CheckoutLine;
            })
            .filter((l): l is CheckoutLine => l !== null && l.quantity > 0),
        );
      })
      .catch(() => setLines([]))
      .finally(() => setLoadingGuest(false));
  }, [isLoggedIn]);

  const effectiveSubtotal = lines.reduce(
    (s, l) => s + l.unitPrice * l.quantity,
    0,
  );
  const originalSubtotal = lines.reduce(
    (s, l) => s + l.originalPrice * l.quantity,
    0,
  );
  const discount = originalSubtotal - effectiveSubtotal;

  // Client-side estimate of the delivery fee (server recomputes it at order time).
  const deliveryFee = useMemo(() => {
    if (deliveryMethod === "pickup") return 0;
    if (
      settings.freeDeliveryThreshold > 0 &&
      effectiveSubtotal >= settings.freeDeliveryThreshold
    ) {
      return 0;
    }
    const haystacks = [area, district]
      .filter(Boolean)
      .map((s) => s.trim().toLowerCase());
    for (const rule of settings.deliveryAreas) {
      const needle = rule.area.trim().toLowerCase();
      if (
        haystacks.some(
          (h) => h === needle || h.includes(needle) || needle.includes(h),
        )
      ) {
        return rule.fee;
      }
    }
    return settings.defaultDeliveryFee;
  }, [deliveryMethod, effectiveSubtotal, area, district, settings]);

  const grandTotal = effectiveSubtotal + deliveryFee;

  const paymentOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (settings.enableCod) opts.push({ value: "cod", label: "Cash on Delivery" });
    if (settings.enableCashAtShop)
      opts.push({ value: "cash_at_shop", label: "Cash at Shop" });
    if (settings.enableBkash) opts.push({ value: "bkash", label: "bKash" });
    if (settings.enableNagad) opts.push({ value: "nagad", label: "Nagad" });
    if (settings.enableRocket) opts.push({ value: "rocket", label: "Rocket" });
    return opts;
  }, [settings]);

  const mobileInfo: Record<string, { number: string; instructions: string }> = {
    bkash: { number: settings.bkashNumber, instructions: settings.bkashInstructions },
    nagad: { number: settings.nagadNumber, instructions: settings.nagadInstructions },
    rocket: { number: settings.rocketNumber, instructions: settings.rocketInstructions },
  };

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!name.trim()) return "Full name is required.";
      if (!isValidBdPhone(phone)) return "Please enter a valid Bangladeshi phone number.";
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return "Please enter a valid email address.";
      if (!isLoggedIn && createAccount) {
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
          return "Password must be at least 8 characters and include a letter and a number.";
        if (password !== confirmPassword) return "Passwords do not match.";
        if (!email.trim()) return "An email address is required to create an account.";
      }
      return null;
    }
    if (n === 2) {
      if (!deliveryName.trim()) return "Delivery name is required.";
      if (!isValidBdPhone(deliveryPhone))
        return "Please enter a valid delivery phone number.";
      if (deliveryMethod === "home") {
        if (!street.trim()) return "Street / house address is required.";
        if (!district.trim()) return "District is required.";
      }
      return null;
    }
    if (n === 3) {
      if (!paymentMethod) return "Please choose a payment method.";
      if (MOBILE_METHODS.includes(paymentMethod)) {
        if (!trxId.trim()) return "Transaction ID is required.";
        if (!isValidBdPhone(senderPhone))
          return "Please enter a valid sender phone number.";
      }
      return null;
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  async function submitOrder() {
    const err = validateStep(1) ?? validateStep(2) ?? validateStep(3);
    if (err) {
      setFormError(err);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await placeOrder({
        items: isLoggedIn
          ? undefined
          : readGuestCart().map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
        name: name.trim(),
        phone: normalizeBdPhone(phone) ?? phone.trim(),
        email: email.trim() || undefined,
        deliveryMethod,
        addressId: addressId === "new" ? null : addressId,
        deliveryName: deliveryName.trim(),
        deliveryPhone: normalizeBdPhone(deliveryPhone) ?? deliveryPhone.trim(),
        street: street.trim() || undefined,
        division: division.trim() || undefined,
        district: district.trim() || undefined,
        upazila: upazila.trim() || undefined,
        area: area.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        instructions: instructions.trim() || undefined,
        paymentMethod,
        trxId: trxId.trim() || undefined,
        senderPhone: senderPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        giftMessage: giftMessage.trim() || undefined,
        createAccount: !isLoggedIn && createAccount,
        password: createAccount ? password : undefined,
        confirmPassword: createAccount ? confirmPassword : undefined,
        idempotencyKey: getIdempotencyKey(),
      });
      if ("error" in result) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      // Success: this attempt is done — a later new order must not reuse
      // its key, or it would replay to this order.
      regenerateIdempotencyKey();
      if (!isLoggedIn) clearGuestCart();
      window.dispatchEvent(new Event("kgp-cart-changed"));
      router.push(`/order-success/${result.orderNumber}`);
    } catch {
      const message = "Could not place your order. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingGuest) {
    return <p className="py-16 text-center text-slate-500">Loading checkout…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-4 text-xl font-bold text-navy">Your cart is empty</h2>
        <p className="mt-2 text-slate-500">
          Add some products to your cart before checking out.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-dark"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const steps = ["Customer", "Delivery", "Payment", "Review"];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {/* Step indicator */}
        <ol className="flex flex-wrap items-center gap-2">
          {steps.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? "bg-green-600 text-white"
                      : active
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : n}
                </span>
                <span
                  className={`text-sm font-medium ${active ? "text-navy" : "text-slate-500"}`}
                >
                  {label}
                </span>
                {n < steps.length && (
                  <span className="mx-1 h-px w-6 bg-slate-300 sm:w-10" />
                )}
              </li>
            );
          })}
        </ol>

        {formError && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {step === 1 && (
            <section>
              <h2 className="text-lg font-bold text-navy">Customer Information</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="co-name">Full name *</label>
                  <input id="co-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="co-phone">Phone *</label>
                  <input id="co-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="co-email">Email {isLoggedIn ? "" : "(optional)"}</label>
                  <input id="co-email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
                </div>
              </div>
              {!isLoggedIn && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-surface p-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy">
                    <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="h-4 w-4 accent-primary" />
                    Create an account with this order
                  </label>
                  {createAccount && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelCls} htmlFor="co-password">Password *</label>
                        <input id="co-password" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters, letter + number" autoComplete="new-password" />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="co-confirm">Confirm password *</label>
                        <input id="co-confirm" type="password" className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
                      </div>
                      <p className="text-xs text-slate-500 sm:col-span-2">
                        Your account will be created together with the order, and you will be logged in automatically.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="text-lg font-bold text-navy">Delivery Method</h2>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                {settings.enableHomeDelivery && (
                  <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 ${deliveryMethod === "home" ? "border-primary bg-primary/5" : "border-slate-300"}`}>
                    <input type="radio" name="deliveryMethod" checked={deliveryMethod === "home"} onChange={() => setDeliveryMethod("home")} className="h-4 w-4 accent-primary" />
                    <span>
                      <span className="block font-semibold text-navy">Home Delivery</span>
                      <span className="block text-sm text-slate-500">Delivered to your address{settings.estimatedDeliveryTime ? ` in ${settings.estimatedDeliveryTime}` : ""}.</span>
                    </span>
                  </label>
                )}
                {settings.enablePickup && (
                  <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 ${deliveryMethod === "pickup" ? "border-primary bg-primary/5" : "border-slate-300"}`}>
                    <input type="radio" name="deliveryMethod" checked={deliveryMethod === "pickup"} onChange={() => setDeliveryMethod("pickup")} className="h-4 w-4 accent-primary" />
                    <span>
                      <span className="block font-semibold text-navy">Shop Pickup</span>
                      <span className="block text-sm text-slate-500">Collect from the shop — no delivery fee.</span>
                    </span>
                  </label>
                )}
              </div>

              {deliveryMethod === "pickup" ? (
                <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-slate-600">
                  Pickup address: <span className="font-medium text-navy">{shopAddress}</span>
                </p>
              ) : (
                <div className="mt-5">
                  {isLoggedIn && addresses.length > 0 && (
                    <div className="mb-4">
                      <label className={labelCls} htmlFor="co-address">Saved address</label>
                      <select
                        id="co-address"
                        className={inputCls}
                        value={addressId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddressId(v);
                          if (v !== "new") {
                            const a = addresses.find((x) => x.id === v);
                            if (a) fillAddress(a);
                          }
                        }}
                      >
                        <option value="new">New address</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title} — {a.street}, {a.area}, {a.district}
                            {a.isDefault ? " (default)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="co-dname">Receiver name *</label>
                      <input id="co-dname" className={inputCls} value={deliveryName} onChange={(e) => setDeliveryName(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-dphone">Receiver phone *</label>
                      <input id="co-dphone" className={inputCls} value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls} htmlFor="co-street">Street / house address *</label>
                      <input id="co-street" className={inputCls} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="House, road, building" />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-area">Area *</label>
                      {settings.deliveryAreas.length > 0 && !areaOther ? (
                        <select
                          id="co-area"
                          className={inputCls}
                          value={area}
                          onChange={(e) => {
                            if (e.target.value === "__other") {
                              setAreaOther(true);
                              setArea("");
                            } else {
                              setArea(e.target.value);
                            }
                          }}
                        >
                          <option value="">Select area</option>
                          {settings.deliveryAreas.map((a) => (
                            <option key={a.area} value={a.area}>
                              {a.area} — {formatBDT(a.fee)}
                            </option>
                          ))}
                          <option value="__other">Other area</option>
                        </select>
                      ) : (
                        <input id="co-area" className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Agrabad" />
                      )}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-district">District *</label>
                      <input id="co-district" className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Chattogram" />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-upazila">Upazila / Thana</label>
                      <input id="co-upazila" className={inputCls} value={upazila} onChange={(e) => setUpazila(e.target.value)} placeholder="e.g. Kotwali" />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-division">Division</label>
                      <input id="co-division" className={inputCls} value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Chattogram" />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-postal">Postal code</label>
                      <input id="co-postal" className={inputCls} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="e.g. 4100" inputMode="numeric" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls} htmlFor="co-instructions">Delivery instructions</label>
                      <textarea id="co-instructions" className={inputCls} rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Anything the delivery person should know" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="text-lg font-bold text-navy">Payment Method</h2>
              {paymentOptions.length === 0 ? (
                <p className="mt-4 text-sm text-red-600">No payment methods are enabled right now. Please contact the shop.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {paymentOptions.map((opt) => (
                    <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${paymentMethod === opt.value ? "border-primary bg-primary/5" : "border-slate-300"}`}>
                      <input type="radio" name="paymentMethod" checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} className="h-4 w-4 accent-primary" />
                      <span className="font-semibold text-navy">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {MOBILE_METHODS.includes(paymentMethod) && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-surface p-4">
                  <p className="text-sm text-slate-600">
                    Send <span className="font-bold text-navy">{formatBDT(grandTotal)}</span> to{" "}
                    <span className="font-bold text-navy">{PAYMENT_LABELS[paymentMethod]}</span>{" "}
                    {mobileInfo[paymentMethod]?.number ? (
                      <>number <span className="font-bold text-navy">{mobileInfo[paymentMethod].number}</span></>
                    ) : (
                      <>(payment number not set — please contact the shop)</>
                    )}
                    .
                  </p>
                  {mobileInfo[paymentMethod]?.instructions && (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{mobileInfo[paymentMethod].instructions}</p>
                  )}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="co-trxid">Transaction ID *</label>
                      <input id="co-trxid" className={inputCls} value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="e.g. 9HX7K2LMNP" />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="co-sender">Sender phone *</label>
                      <input id="co-sender" className={inputCls} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Your order will be verified against this transaction ID by the shop.
                  </p>
                </div>
              )}
              {paymentMethod === "cod" && (
                <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-slate-600">Pay in cash when your order is delivered.</p>
              )}
              {paymentMethod === "cash_at_shop" && (
                <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-slate-600">Pay in cash at the shop when you collect your order.</p>
              )}
            </section>
          )}

          {step === 4 && (
            <section>
              <h2 className="text-lg font-bold text-navy">Review Your Order</h2>
              <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {lines.map((line) => (
                  <li key={line.productId} className="flex items-center gap-3 p-3">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <Image src={line.image ?? "/images/products/gift-box.svg"} alt={line.name} fill className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{line.name}</span>
                      <span className="block text-xs text-slate-500">{line.quantity} × {formatBDT(line.unitPrice)}</span>
                    </span>
                    <span className="text-sm font-semibold text-navy">{formatBDT(line.unitPrice * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-surface p-3">
                  <dt className="font-semibold text-navy">Deliver to</dt>
                  <dd className="mt-1 text-slate-600">
                    {deliveryMethod === "pickup" ? (
                      <>Shop Pickup — {shopAddress}</>
                    ) : (
                      // Same shared formatter as order success / tracking /
                      // admin / invoice, so the full address shows here too.
                      <>{deliveryName} — {deliveryPhone}<br />{formatDeliveryAddress({ deliveryAddress: street, area, upazila, district, division, postalCode })}</>
                    )}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface p-3">
                  <dt className="font-semibold text-navy">Payment</dt>
                  <dd className="mt-1 text-slate-600">
                    {PAYMENT_LABELS[paymentMethod] ?? paymentMethod}
                    {MOBILE_METHODS.includes(paymentMethod) && trxId && (
                      <> — TrxID: {trxId}</>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="co-notes">Order notes (optional)</label>
                  <textarea id="co-notes" className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know about this order" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="co-gift">Gift message (optional)</label>
                  <textarea id="co-gift" className={inputCls} rows={2} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="A message to include with the gift" />
                </div>
              </div>
              {(settings.estimatedProcessingTime || settings.estimatedDeliveryTime) && (
                <p className="mt-4 text-xs text-slate-500">
                  Estimated processing: {settings.estimatedProcessingTime || "—"}
                  {deliveryMethod === "home" && ` · Estimated delivery: ${settings.estimatedDeliveryTime || "—"}`}
                </p>
              )}
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {step > 1 ? (
              <button type="button" onClick={() => { setFormError(null); setStep((s) => s - 1); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <Link href="/cart" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" /> Back to Cart
              </Link>
            )}
            {step < 4 ? (
              <button type="button" onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={submitOrder} disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60">
                {submitting ? "Placing your order…" : `Place Order — ${formatBDT(grandTotal)}`}
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-navy">Order Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-2">
              <span className="text-slate-600">{line.name} × {line.quantity}</span>
              <span className="font-medium text-navy">{formatBDT(line.unitPrice * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-medium text-navy">{formatBDT(originalSubtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Discount</dt>
              <dd className="font-medium text-green-700">-{formatBDT(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-600">Delivery fee</dt>
            <dd className="font-medium text-navy">{deliveryFee === 0 ? "Free" : formatBDT(deliveryFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-navy">
            <dt>Total</dt>
            <dd>{formatBDT(grandTotal)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Final prices, stock and delivery fee are confirmed by the shop when you place the order.
        </p>
      </aside>
    </div>
  );
}
