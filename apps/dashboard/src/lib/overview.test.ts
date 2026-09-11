import { describe, it, expect } from 'vitest';
import {
  formatMetricCount,
  formatCurrencyKes,
  calculateSuccessRate,
  getSuccessfulCount,
  classifyVerificationStatus,
  getStatusLabel,
  summarizeRecentCost,
  buildStatusDistribution,
  buildOverviewAnalytics,
  getAvailableProducts,
  formatActivitySummary,
} from './overview';

describe('formatMetricCount', () => {
  it('formats numbers with locale', () => {
    expect(formatMetricCount(0)).toBe('0');
    expect(formatMetricCount(1234)).toBe('1,234');
    expect(formatMetricCount(1000000)).toBe('1,000,000');
  });
  it('returns em dash for nullish', () => {
    expect(formatMetricCount(null)).toBe('—');
    expect(formatMetricCount(undefined)).toBe('—');
    expect(formatMetricCount(NaN)).toBe('—');
  });
});

describe('formatCurrencyKes', () => {
  it('formats KES with two decimals', () => {
    expect(formatCurrencyKes(0)).toBe('KES 0.00');
    expect(formatCurrencyKes(1234)).toBe('KES 1,234.00');
    expect(formatCurrencyKes(1234.5)).toBe('KES 1,234.50');
    expect(formatCurrencyKes(null)).toBe('KES 0.00');
    expect(formatCurrencyKes(undefined)).toBe('KES 0.00');
  });
  it('handles negative', () => {
    expect(formatCurrencyKes(-50)).toBe('KES -50.00');
  });
});

describe('calculateSuccessRate', () => {
  it('returns null for empty', () => {
    expect(calculateSuccessRate([])).toBeNull();
  });
  it('calculates rounded percentage', () => {
    expect(calculateSuccessRate([{ status: 'success' }, { status: 'failed' }])).toBe(50);
    expect(
      calculateSuccessRate([{ status: 'success' }, { status: 'success' }, { status: 'failed' }]),
    ).toBe(67);
    expect(calculateSuccessRate([{ status: 'success' }, { status: 'success' }])).toBe(100);
    expect(calculateSuccessRate([{ status: 'failed' }])).toBe(0);
  });
  it('is case-sensitive exact match to success only', () => {
    expect(calculateSuccessRate([{ status: 'SUCCESS' }])).toBe(0);
  });
});

describe('getSuccessfulCount', () => {
  it('counts only success', () => {
    expect(
      getSuccessfulCount([{ status: 'success' }, { status: 'failed' }, { status: 'success' }]),
    ).toBe(2);
    expect(getSuccessfulCount([])).toBe(0);
  });
});

describe('classifyVerificationStatus', () => {
  it('maps known statuses', () => {
    expect(classifyVerificationStatus('success')).toBe('green');
    expect(classifyVerificationStatus('SUCCESS')).toBe('green');
    expect(classifyVerificationStatus('failed')).toBe('red');
    expect(classifyVerificationStatus('not_found')).toBe('red');
    expect(classifyVerificationStatus('pending')).toBe('amber');
    expect(classifyVerificationStatus('processing')).toBe('amber');
    expect(classifyVerificationStatus('low')).toBe('blue');
    expect(classifyVerificationStatus('unknown_xyz')).toBe('slate');
  });
});

describe('getStatusLabel', () => {
  it('humanises known statuses', () => {
    expect(getStatusLabel('success')).toBe('Success');
    expect(getStatusLabel('not_found')).toBe('Not found');
    expect(getStatusLabel('pending')).toBe('Pending');
    expect(getStatusLabel('custom_status')).toBe('Custom status');
  });
});

describe('summarizeRecentCost', () => {
  it('sums costs', () => {
    expect(summarizeRecentCost([{ cost: 10 }, { cost: 20.5 }])).toBe(30.5);
    expect(summarizeRecentCost([])).toBe(0);
  });
  it('ignores non-finite', () => {
    expect(summarizeRecentCost([{ cost: NaN }, { cost: 10 }])).toBe(10);
  });
});

describe('buildStatusDistribution', () => {
  it('builds counts case-insensitive', () => {
    expect(
      buildStatusDistribution([{ status: 'success' }, { status: 'Success' }, { status: 'failed' }]),
    ).toEqual({
      success: 2,
      failed: 1,
    });
  });
  it('empty returns empty object', () => {
    expect(buildStatusDistribution([])).toEqual({});
  });
});

describe('buildOverviewAnalytics', () => {
  it('computes analytics from verifications', () => {
    const items = [
      {
        id: '1',
        type: 'iprs_standard',
        status: 'success',
        source: 'dashboard',
        cost: 30,
        latencyMs: 120,
        createdAt: new Date().toISOString(),
        subject: '123',
      },
      {
        id: '2',
        type: 'iprs_standard',
        status: 'failed',
        source: 'dashboard',
        cost: 0,
        latencyMs: 200,
        createdAt: new Date().toISOString(),
        subject: '456',
      },
    ];
    const a = buildOverviewAnalytics(items);
    expect(a.totalCost).toBe(30);
    expect(a.avgLatencyMs).toBe(160);
    expect(a.statusCounts).toEqual({ success: 1, failed: 1 });
    expect(a.points.length).toBe(2);
  });
  it('handles no latencies', () => {
    const items = [
      {
        id: '1',
        type: 'iprs_standard',
        status: 'success',
        source: 'dashboard',
        cost: 30,
        latencyMs: null,
        createdAt: new Date().toISOString(),
        subject: '123',
      },
    ];
    expect(buildOverviewAnalytics(items).avgLatencyMs).toBeNull();
  });
});

describe('getAvailableProducts', () => {
  it('filters by enabled and active', () => {
    const products = [
      {
        type: 'a',
        label: 'A',
        category: 'X',
        enabled: true,
        active: true,
        unitPriceKes: 10,
        backupPriceKes: null,
        cbConsentRequired: false,
        requiresFileUpload: false,
        backupAvailable: false,
        live: true,
      },
      {
        type: 'b',
        label: 'B',
        category: 'X',
        enabled: true,
        active: false,
        unitPriceKes: 10,
        backupPriceKes: null,
        cbConsentRequired: false,
        requiresFileUpload: false,
        backupAvailable: false,
        live: true,
      },
      {
        type: 'c',
        label: 'C',
        category: 'X',
        enabled: false,
        active: true,
        unitPriceKes: 10,
        backupPriceKes: null,
        cbConsentRequired: false,
        requiresFileUpload: false,
        backupAvailable: false,
        live: true,
      },
    ];
    expect(getAvailableProducts(products).map((p) => p.type)).toEqual(['a']);
  });
});

describe('formatActivitySummary', () => {
  it('returns no activity for zero', () => {
    expect(
      formatActivitySummary({ points: [], totalCost: 0, avgLatencyMs: null, statusCounts: {} }, 0),
    ).toBe('No activity yet');
  });
  it('summarises statuses', () => {
    expect(
      formatActivitySummary(
        { points: [], totalCost: 0, avgLatencyMs: 120, statusCounts: { success: 2, failed: 1 } },
        3,
      ),
    ).toBe('2 succeeded · 1 failed · avg 120ms');
  });
});
