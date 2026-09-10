import { describe, it, expect } from 'vitest';
import {
  formatKes,
  formatWalletBalance,
  formatLedgerAmount,
  getLedgerSign,
  isTopUpTransaction,
  topUpMinorToKes,
  formatTopUpAmount,
  canInitiatePayments,
  isPaymentRailAvailable,
  getAvailablePaymentRails,
  buildWalletStatementUrl,
  buildWalletStatementFilename,
  getRailLabel,
  ALL_PAYMENT_RAILS,
} from './wallet';

describe('formatKes', () => {
  it('formats with two decimals', () => {
    expect(formatKes(0)).toBe('KES 0.00');
    expect(formatKes(1234)).toBe('KES 1,234.00');
    expect(formatKes(1234.5)).toBe('KES 1,234.50');
    expect(formatKes(null)).toBe('KES 0.00');
    expect(formatKes(undefined)).toBe('KES 0.00');
    expect(formatKes(NaN)).toBe('KES 0.00');
  });
  it('handles negative', () => {
    expect(formatKes(-50)).toBe('KES -50.00');
  });
});

describe('formatWalletBalance', () => {
  it('formats without decimals and handles null', () => {
    expect(formatWalletBalance(0)).toBe('KES 0');
    expect(formatWalletBalance(1234)).toBe('KES 1,234');
    expect(formatWalletBalance(1234567)).toBe('KES 1,234,567');
    expect(formatWalletBalance(null)).toBe('KES —');
  });
});

describe('formatLedgerAmount / getLedgerSign / isTopUpTransaction', () => {
  it('returns + for topup and − for others', () => {
    expect(isTopUpTransaction('topup')).toBe(true);
    expect(isTopUpTransaction('charge')).toBe(false);
    expect(getLedgerSign('topup')).toBe('+');
    expect(getLedgerSign('debit')).toBe('−');
  });
  it('formats ledger amount sign-aware', () => {
    expect(formatLedgerAmount({ type: 'topup', amount: 1000 })).toBe('+KES 1,000');
    expect(formatLedgerAmount({ type: 'charge', amount: 500 })).toBe('−KES 500');
    expect(formatLedgerAmount({ type: 'topup', amount: -200 })).toBe('+KES 200');
  });
});

describe('topUpMinorToKes / formatTopUpAmount', () => {
  it('converts minor units', () => {
    expect(topUpMinorToKes('500000')).toBe(5000);
    expect(topUpMinorToKes(10000)).toBe(100);
    expect(topUpMinorToKes('invalid')).toBe(0);
  });
  it('formats top-up amount', () => {
    expect(formatTopUpAmount('100000')).toBe('KES 1,000');
  });
});

describe('canInitiatePayments', () => {
  it('allows OWNER and ADMIN only', () => {
    expect(canInitiatePayments('OWNER')).toBe(true);
    expect(canInitiatePayments('ADMIN')).toBe(true);
    expect(canInitiatePayments('MEMBER')).toBe(false);
    expect(canInitiatePayments(undefined)).toBe(false);
    expect(canInitiatePayments('member')).toBe(false);
  });
});

describe('isPaymentRailAvailable / getAvailablePaymentRails', () => {
  it('returns false when cannot manage', () => {
    for (const rail of ALL_PAYMENT_RAILS) {
      expect(isPaymentRailAvailable(rail, false)).toBe(false);
    }
    expect(getAvailablePaymentRails(false)).toEqual([]);
  });
  it('returns true for all rails when can manage', () => {
    for (const rail of ALL_PAYMENT_RAILS) {
      expect(isPaymentRailAvailable(rail, true)).toBe(true);
    }
    expect(getAvailablePaymentRails(true)).toEqual(ALL_PAYMENT_RAILS);
    expect(getAvailablePaymentRails(true)).toHaveLength(5);
  });
  it('getRailLabel returns human label', () => {
    expect(getRailLabel('mpesa')).toBe('M-Pesa');
    expect(getRailLabel('bank')).toBe('Bank / Paybill');
  });
});

describe('buildWalletStatementUrl', () => {
  it('builds with format and no filters', () => {
    expect(buildWalletStatementUrl({}, 'csv')).toBe('/exports/wallet/statement?format=csv');
    expect(buildWalletStatementUrl({}, 'pdf')).toBe('/exports/wallet/statement?format=pdf');
    expect(buildWalletStatementUrl({}, 'xlsx')).toBe('/exports/wallet/statement?format=xlsx');
  });
  it('includes from/to filters and trims', () => {
    const url = buildWalletStatementUrl({ from: '2026-01-01', to: '2026-01-31' }, 'csv');
    const p = new URLSearchParams(url.split('?')[1]);
    expect(p.get('format')).toBe('csv');
    expect(p.get('from')).toBe('2026-01-01');
    expect(p.get('to')).toBe('2026-01-31');
  });
  it('supports startDate/endDate aliases and omits empty', () => {
    const url = buildWalletStatementUrl({ startDate: '2026-02-01', endDate: '  ' }, 'pdf');
    const p = new URLSearchParams(url.split('?')[1]);
    expect(p.get('from')).toBe('2026-02-01');
    expect(p.has('to')).toBe(false);
  });
  it('buildWalletStatementFilename includes stamp', () => {
    const d = new Date('2026-03-15T12:00:00.000Z');
    expect(buildWalletStatementFilename('csv', d)).toBe('fleek-wallet-statement-2026-03-15.csv');
  });
});
