/**
 * Normalize Kenyan phone number to +2547XXXXXXXX format.
 * Accepts: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX, 7XXXXXXXX
 */
export function normalizeKePhone(phone: string): string {
  if (!phone) return phone;
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('254')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+254${cleaned.slice(1)}`;
  if (cleaned.startsWith('7') && cleaned.length === 9) return `+254${cleaned}`;
  return cleaned; // Return as-is if format not recognized
}

/**
 * Validate Kenyan mobile number format
 */
export function isValidKePhone(phone: string): boolean {
  const normalized = normalizeKePhone(phone);
  return /^\+2547\d{8}$/.test(normalized);
}

/**
 * Format phone for display (07XX XXX XXX)
 */
export function formatKePhoneDisplay(phone: string): string {
  const normalized = normalizeKePhone(phone);
  if (!isValidKePhone(phone)) return phone;
  const national = normalized.slice(4); // Remove +254
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
}