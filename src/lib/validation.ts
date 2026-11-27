/** Shared validation helpers for customer-facing forms. */

/**
 * Normalize a Bangladeshi phone number to the canonical 11-digit form
 * (01XXXXXXXXX). Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX and
 * numbers with spaces/dashes. Returns null when it cannot be normalized.
 */
export function normalizeBdPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let normalized: string | null = null;
  if (/^01[3-9]\d{8}$/.test(digits)) {
    normalized = digits;
  } else if (/^8801[3-9]\d{8}$/.test(digits)) {
    normalized = `0${digits.slice(2)}`;
  }
  return normalized;
}

export function isValidBdPhone(raw: string): boolean {
  return normalizeBdPhone(raw) !== null;
}

/** Minimum password rule for customers: at least 8 chars, one letter, one digit. */
export function passwordMeetsRequirements(password: string): boolean {
  return (
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
  );
}

export const PASSWORD_RULE_TEXT =
  "Password must be at least 8 characters and include a letter and a number.";
