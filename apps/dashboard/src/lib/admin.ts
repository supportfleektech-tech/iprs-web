'use client';

import { CB_CONSENT_REQUIRED_TYPES, PRODUCT_CATEGORIES, PRODUCT_LABELS } from '@fleek/types';

// ---------------------------------------------------------------------------
// Types mirroring admin endpoints
// ---------------------------------------------------------------------------
export interface AdminStats {
  organizations: number;
  verifications: number;
  pendingTopUps: number;
}

export interface AdminTopUp {
  id: string;
  organizationId: string;
  amountMinor: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  organization?: { name: string } | null;
}

export interface ProductPricing {
  id: string;
  type: string;
  priceMinor: string | number | bigint;
  active: boolean;
}

export interface ProductPricingTier {
  id: string;
  productType: string;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number | string;
  backupPriceMinor: number | string | null;
  vatExclusive: boolean;
}

export interface OrgPricingTier {
  id: string;
  productType: string;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number;
  backupPriceMinor: number | null;
  vatExclusive: boolean;
}

export interface OrgEnabledCheck {
  productType: string;
  enabled: boolean;
}

export interface OrgSummary {
  id: string;
  name: string;
  wallet?: { balanceMinor: string } | null;
  _count?: { users: number };
}

// ---------------------------------------------------------------------------
// Price formatting — VAT-exclusive, minor units (cents) → KES
// ---------------------------------------------------------------------------

/**
 * Convert minor-unit value (string | number | bigint | null) to KES number.
 * Minor units are cents (e.g., 3000 → KES 30).
 */
export function minorToKes(minor: number | string | bigint | null | undefined): number {
  if (minor == null) return 0;
  const n = typeof minor === 'bigint' ? Number(minor) : Number(minor);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

/**
 * Format minor units as "KES 1,234.00" with two decimals.
 * Handles string/number/bigint, null, invalid → KES 0.00.
 */
export function formatPriceMinor(minor: number | string | bigint | null | undefined): string {
  const kes = minorToKes(minor);
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kes)}`;
}

/**
 * Format KES number (already in KES, not minor) as "KES 1,234.00".
 */
export function formatKes(kes: number | null | undefined): string {
  const n = typeof kes === 'number' && Number.isFinite(kes) ? kes : 0;
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/**
 * Format wallet-style balance without decimals: "KES 1,234"
 */
export function formatKesCompact(kes: number | null | undefined): string {
  if (kes == null || !Number.isFinite(kes)) return 'KES —';
  return `KES ${new Intl.NumberFormat('en-KE').format(Math.round(kes))}`;
}

// ---------------------------------------------------------------------------
// Tier helpers — selection & labeling
// ---------------------------------------------------------------------------

export function tierRangeLabel(minVolume: number, maxVolume: number | null): string {
  if (maxVolume == null) return `${new Intl.NumberFormat('en-KE').format(minVolume)}+`;
  return `${new Intl.NumberFormat('en-KE').format(minVolume)}–${new Intl.NumberFormat('en-KE').format(maxVolume)}`;
}

/**
 * Select the applicable tier for a given monthly volume from a desc-sorted list.
 * Mirrors server-side `VerificationsService.selectTierInMemory` but accepts plain numbers.
 * Returns null if volume below smallest tier's minVolume or list empty.
 */
export function selectTierForVolume<T extends { minVolume: number; maxVolume: number | null }>(
  tiers: T[],
  volume: number,
): T | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  // Primary: first tier where minVolume <= volume <= maxVolume (or null max)
  for (const tier of tiers) {
    if (tier.minVolume <= volume && (tier.maxVolume === null || tier.maxVolume >= volume)) {
      return tier;
    }
  }
  // Deterministic fallback: tiers expected sorted desc by minVolume; last is smallest min.
  const smallest = tiers[tiers.length - 1];
  if (volume < smallest.minVolume) return null;
  // Fallback to most specific (first) when volume exceeds all bounded ranges but list non-empty
  return tiers[0] ?? null;
}

/**
 * Group tiers by productType, sorted asc by minVolume within each group.
 */
export function groupTiersByProduct(tiers: ProductPricingTier[]): Map<string, ProductPricingTier[]> {
  const map = new Map<string, ProductPricingTier[]>();
  for (const t of tiers) {
    const arr = map.get(t.productType) ?? [];
    arr.push(t);
    map.set(t.productType, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => a.minVolume - b.minVolume);
    map.set(k, arr);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Org pricing normalization
// ---------------------------------------------------------------------------

/**
 * Normalize org pricing tiers array into lookup maps for editing.
 * Returns { edits: Record<productType, unitPriceMinor string>, ids: Record<productType, id> }
 * Keeps last occurrence per productType (tiers have unique constraint per org+type).
 */
export function normalizeOrgPricingTiers(tiers: OrgPricingTier[]): {
  edits: Record<string, string>;
  ids: Record<string, string>;
} {
  const edits: Record<string, string> = {};
  const ids: Record<string, string> = {};
  for (const t of tiers) {
    edits[t.productType] = String(t.unitPriceMinor);
    ids[t.productType] = t.id;
  }
  return { edits, ids };
}

/**
 * Normalize global tiers into edit state: map productType -> tiers[]
 */
export function normalizeGlobalTiers(tiers: ProductPricingTier[]): Record<string, ProductPricingTier[]> {
  const out: Record<string, ProductPricingTier[]> = {};
  for (const t of tiers) {
    if (!out[t.productType]) out[t.productType] = [];
    out[t.productType].push(t);
  }
  // Sort each group asc by minVolume
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.minVolume - b.minVolume);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation — explicit, retryable errors
// ---------------------------------------------------------------------------

export function validatePriceInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a price';
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 'Price must be a number';
  if (n < 1) return 'Price must be at least KES 1';
  if (!Number.isInteger(Math.round(n * 100))) return 'Price must be a valid KES amount';
  return null;
}

export function validateMinorInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a price in minor units';
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 'Price must be a number';
  if (!Number.isInteger(n)) return 'Minor units must be an integer';
  if (n < 100) return 'Price must be at least 100 minor units (KES 1)';
  return null;
}

export function validateTierPrice(minor: string, field: string = 'Price'): string | null {
  const trimmed = minor.trim();
  if (!trimmed) return `${field} is required`;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return `${field} must be a number`;
  if (n < 1) return `${field} must be at least 1`;
  return null;
}

// ---------------------------------------------------------------------------
// Product catalog enrichment — consent/upload/backup metadata from types
// ---------------------------------------------------------------------------

export function requiresFileUpload(type: string): boolean {
  return ['face_id_match', 'scanned_statement', 'brs'].includes(type);
}

export function getFileTypes(type: string): string[] {
  if (type === 'face_id_match') return ['image/jpeg', 'image/png'];
  if (type === 'scanned_statement' || type === 'brs') return ['application/pdf', 'image/jpeg', 'image/png'];
  return [];
}

export function requiresCbConsent(type: string): boolean {
  return (CB_CONSENT_REQUIRED_TYPES as string[]).includes(type);
}

export function getProductLabel(type: string): string {
  return (PRODUCT_LABELS as Record<string, string>)[type] ?? type;
}

export function getProductCategory(type: string): string {
  for (const [cat, types] of Object.entries(PRODUCT_CATEGORIES)) {
    if ((types as string[]).includes(type)) return cat;
  }
  return 'Other';
}

export function getAllProductTypes(): string[] {
  return Object.keys(PRODUCT_LABELS);
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-KE').format(value);
}

export function formatTopUpMinor(minor: string | number): string {
  const n = Number(minor);
  if (!Number.isFinite(n)) return 'KES —';
  return formatPriceMinor(n);
}
