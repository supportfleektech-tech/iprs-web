export type PaymentRailType = 'mpesa' | 'bank' | 'card' | 'paypal' | 'invoice';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

export interface WalletTopUp {
  id: string;
  amountMinor: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

export interface BankDetails {
  paybillNumber: string;
  paybillAccount: string;
  bankName: string;
  bankBranch: string;
  accountName: string;
}

export interface WalletPageData {
  balance: number | null;
  currency: string;
  transactions: WalletTransaction[];
  topUps: WalletTopUp[];
  rails: PaymentRailType[];
}

export interface PaymentRailProps {
  rail: PaymentRailType;
  balance: number | null;
  enabled: boolean;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export const PAYMENT_RAIL_LABELS: Record<PaymentRailType, string> = {
  mpesa: 'M-Pesa',
  bank: 'Bank / Paybill',
  card: 'Card',
  paypal: 'PayPal',
  invoice: 'Invoice',
};

export const PAYMENT_RAIL_DESCRIPTIONS: Record<PaymentRailType, string> = {
  mpesa: 'Instant STK push — enter your M-Pesa PIN when prompted.',
  bank: 'Manual bank transfer or Paybill — credited after confirmation.',
  card: 'Visa / Mastercard — settles instantly in sandbox.',
  paypal: 'Approve in PayPal, then capture — settles instantly in sandbox.',
  invoice: 'Manual invoicing — credited after admin approval.',
};

export const ALL_PAYMENT_RAILS: PaymentRailType[] = ['mpesa', 'bank', 'card', 'paypal', 'invoice'];

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

/**
 * Format KES with 2 decimals: KES 1,234.50
 */
export function formatKes(amount: number | null | undefined): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/**
 * Format wallet balance without decimals (locale aware): KES 1,234
 */
export function formatWalletBalance(balance: number | null | undefined): string {
  if (balance == null || !Number.isFinite(balance)) return 'KES —';
  return `KES ${new Intl.NumberFormat('en-KE').format(balance)}`;
}

/**
 * Format ledger amount with sign awareness.
 * topup => +KES, others => −KES
 */
export function formatLedgerAmount(tx: Pick<WalletTransaction, 'type' | 'amount'>): string {
  const abs = Math.abs(tx.amount);
  const formatted = `KES ${new Intl.NumberFormat('en-KE').format(abs)}`;
  const sign = isTopUpTransaction(tx.type) ? '+' : '−';
  return `${sign}${formatted}`;
}

export function getLedgerSign(type: string): string {
  return isTopUpTransaction(type) ? '+' : '−';
}

export function isTopUpTransaction(type: string): boolean {
  return type === 'topup';
}

export function getLedgerTone(type: string): 'positive' | 'negative' {
  return isTopUpTransaction(type) ? 'positive' : 'negative';
}

/** Convert amountMinor string (cents) to KES number */
export function topUpMinorToKes(amountMinor: string | number): number {
  const n = typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor;
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

export function formatTopUpAmount(amountMinor: string | number): string {
  return formatWalletBalance(topUpMinorToKes(amountMinor));
}

// ---------------------------------------------------------------------------
// Rail availability & permissions
// ---------------------------------------------------------------------------

export function canInitiatePayments(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isPaymentRailAvailable(rail: PaymentRailType, canManage: boolean): boolean {
  if (!ALL_PAYMENT_RAILS.includes(rail)) return false;
  return canManage;
}

export function getAvailablePaymentRails(canManage: boolean): PaymentRailType[] {
  if (!canManage) return [];
  return [...ALL_PAYMENT_RAILS];
}

export function getRailLabel(rail: PaymentRailType): string {
  return PAYMENT_RAIL_LABELS[rail] ?? rail;
}

export function getRailDescription(rail: PaymentRailType): string {
  return PAYMENT_RAIL_DESCRIPTIONS[rail] ?? '';
}

// ---------------------------------------------------------------------------
// Statement / export URL construction (wallet)
// ---------------------------------------------------------------------------

export interface StatementFilters {
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
}

export function buildWalletStatementUrl(filters: StatementFilters, format: ExportFormat): string {
  const params = new URLSearchParams();
  params.set('format', format);
  const from = (filters.from ?? filters.startDate)?.trim();
  if (from) params.set('from', from);
  const to = (filters.to ?? filters.endDate)?.trim();
  if (to) params.set('to', to);
  return `/exports/wallet/statement?${params.toString()}`;
}

export function buildWalletStatementFilename(format: ExportFormat, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `fleek-wallet-statement-${stamp}.${format}`;
}

// ---------------------------------------------------------------------------
// Helpers for UI
// ---------------------------------------------------------------------------

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function summarizeWalletActivity(transactions: WalletTransaction[], topUps: WalletTopUp[]): {
  txCount: number;
  topUpCount: number;
  pendingTopUps: number;
  lastMovementAt: string | null;
} {
  const pendingTopUps = topUps.filter((t) => t.status === 'pending').length;
  const lastMovementAt = transactions[0]?.createdAt ?? topUps[0]?.createdAt ?? null;
  return {
    txCount: transactions.length,
    topUpCount: topUps.length,
    pendingTopUps,
    lastMovementAt,
  };
}
