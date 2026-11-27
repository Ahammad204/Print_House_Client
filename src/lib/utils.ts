import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Convert a Prisma Decimal, string or number to a plain number. NaN-safe → 0. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format a value as Bangladeshi Taka, e.g. "৳1,234.50". */
export function formatBDT(
  value: number | string | { toNumber(): number },
): string {
  const n = toNumber(value);
  return `৳${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Dhaka",
});

/** e.g. "12 Jan 2026" (Asia/Dhaka). */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

/** e.g. "12 Jan 2026, 02:30 PM" (Asia/Dhaka). */
export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter
    .format(new Date(date))
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
}

function dhakaParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Start/end of a Dhaka calendar day, as UTC Date objects.
 * Asia/Dhaka is UTC+06:00 year-round (no DST), so a Dhaka midnight
 * is 18:00 UTC on the previous calendar day.
 */
function dhakaDayRangeFromParts(
  year: number,
  month: number,
  day: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, day, -6, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

/** Start/end of the current Asia/Dhaka day, as UTC Date objects. */
export function dhakaTodayRange(): { start: Date; end: Date } {
  const { year, month, day } = dhakaParts(new Date());
  return dhakaDayRangeFromParts(year, month, day);
}

/** Start/end of a given Asia/Dhaka month (month 1-based), as UTC Dates. */
export function dhakaMonthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, -6, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, -6, 0, 0, 0));
  const end = new Date(nextMonthStart.getTime() - 1);
  return { start, end };
}

/** Start/end of the Dhaka calendar day containing `date`, as UTC Dates. */
export function dhakaDayRange(date: Date): { start: Date; end: Date } {
  const { year, month, day } = dhakaParts(date);
  return dhakaDayRangeFromParts(year, month, day);
}
