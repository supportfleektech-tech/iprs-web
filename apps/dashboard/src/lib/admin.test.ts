import { describe, it, expect } from 'vitest';
import {
  minorToKes,
  formatPriceMinor,
  formatKes,
  tierRangeLabel,
  selectTierForVolume,
  groupTiersByProduct,
  normalizeOrgPricingTiers,
  normalizeGlobalTiers,
  validatePriceInput,
  validateMinorInput,
  validateTierPrice,
  requiresFileUpload,
  requiresCbConsent,
  getProductLabel,
  getProductCategory,
  formatCount,
} from './admin';

describe('minorToKes / formatPriceMinor / formatKes', () => {
  it('converts minor units to KES', () => {
    expect(minorToKes(3000)).toBe(30);
    expect(minorToKes('5000')).toBe(50);
    expect(minorToKes(0)).toBe(0);
    expect(minorToKes(null)).toBe(0);
    expect(minorToKes('invalid')).toBe(0);
    expect(minorToKes(BigInt(4500))).toBe(45);
  });
  it('formats minor as KES with two decimals', () => {
    expect(formatPriceMinor(3000)).toBe('KES 30.00');
    expect(formatPriceMinor('500000')).toBe('KES 5,000.00');
    expect(formatPriceMinor(null)).toBe('KES 0.00');
    expect(formatPriceMinor('invalid')).toBe('KES 0.00');
    expect(formatPriceMinor(0)).toBe('KES 0.00');
  });
  it('formats KES number with two decimals', () => {
    expect(formatKes(30)).toBe('KES 30.00');
    expect(formatKes(null)).toBe('KES 0.00');
    expect(formatKes(NaN)).toBe('KES 0.00');
  });
  it('tierRangeLabel formats ranges', () => {
    expect(tierRangeLabel(0, 500)).toBe('0–500');
    expect(tierRangeLabel(30001, null)).toBe('30,001+');
    expect(tierRangeLabel(1001, 5000)).toBe('1,001–5,000');
  });
});

describe('selectTierForVolume', () => {
  const tiers = [
    { minVolume: 30001, maxVolume: null, unitPriceMinor: 2000 },
    { minVolume: 10001, maxVolume: 30000, unitPriceMinor: 2200 },
    { minVolume: 5001, maxVolume: 10000, unitPriceMinor: 2400 },
    { minVolume: 2501, maxVolume: 5000, unitPriceMinor: 2600 },
    { minVolume: 501, maxVolume: 2500, unitPriceMinor: 2800 },
    { minVolume: 0, maxVolume: 500, unitPriceMinor: 3000 },
  ];

  it('selects correct tier for volume', () => {
    expect(selectTierForVolume(tiers, 0)?.unitPriceMinor).toBe(3000);
    expect(selectTierForVolume(tiers, 500)?.unitPriceMinor).toBe(3000);
    expect(selectTierForVolume(tiers, 501)?.unitPriceMinor).toBe(2800);
    expect(selectTierForVolume(tiers, 2500)?.unitPriceMinor).toBe(2800);
    expect(selectTierForVolume(tiers, 10000)?.unitPriceMinor).toBe(2400);
    expect(selectTierForVolume(tiers, 50000)?.unitPriceMinor).toBe(2000);
  });
  it('handles spin score special bands', () => {
    const spinTiers = [
      { minVolume: 50000, maxVolume: 100000, unitPriceMinor: 1000 },
      { minVolume: 20001, maxVolume: 50000, unitPriceMinor: 1200 },
      { minVolume: 1, maxVolume: 1000, unitPriceMinor: 3000 },
    ];
    expect(selectTierForVolume(spinTiers, 1)?.unitPriceMinor).toBe(3000);
    expect(selectTierForVolume(spinTiers, 25000)?.unitPriceMinor).toBe(1200);
    expect(selectTierForVolume(spinTiers, 0)).toBeNull();
  });
  it('returns null for empty or below smallest min', () => {
    expect(selectTierForVolume([], 100)).toBeNull();
    expect(selectTierForVolume(tiers, -1)).toBeNull();
  });
  it('returns first tier when volume exceeds all bounded ranges', () => {
    // Already covered by open-ended null max, but test explicit
    expect(selectTierForVolume(tiers, 999999)?.unitPriceMinor).toBe(2000);
  });
});

describe('groupTiersByProduct', () => {
  it('groups and sorts by minVolume', () => {
    const tiers = [
      {
        id: '2',
        productType: 'iprs_standard',
        minVolume: 501,
        maxVolume: 2500,
        unitPriceMinor: 2800,
        backupPriceMinor: null,
        vatExclusive: true,
      },
      {
        id: '1',
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: 500,
        unitPriceMinor: 3000,
        backupPriceMinor: null,
        vatExclusive: true,
      },
      {
        id: '3',
        productType: 'kra_pin_verification',
        minVolume: 0,
        maxVolume: 500,
        unitPriceMinor: 2000,
        backupPriceMinor: null,
        vatExclusive: true,
      },
    ] as unknown as Parameters<typeof groupTiersByProduct>[0];
    const grouped = groupTiersByProduct(tiers);
    expect(grouped.get('iprs_standard')?.[0].id).toBe('1');
    expect(grouped.get('iprs_standard')?.[1].id).toBe('2');
    expect(grouped.get('kra_pin_verification')?.length).toBe(1);
  });
});

describe('normalizeOrgPricingTiers', () => {
  it('normalizes edits and ids maps', () => {
    const tiers = [
      {
        id: 'a',
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 3000,
        backupPriceMinor: null,
        vatExclusive: true,
      },
      {
        id: 'b',
        productType: 'kra_pin_verification',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 2000,
        backupPriceMinor: 2500,
        vatExclusive: true,
      },
    ] as unknown as Parameters<typeof normalizeOrgPricingTiers>[0];
    const { edits, ids } = normalizeOrgPricingTiers(tiers);
    expect(edits['iprs_standard']).toBe('3000');
    expect(edits['kra_pin_verification']).toBe('2000');
    expect(ids['iprs_standard']).toBe('a');
    expect(ids['b']).toBeUndefined();
    expect(ids['kra_pin_verification']).toBe('b');
  });
  it('handles empty', () => {
    const { edits, ids } = normalizeOrgPricingTiers([]);
    expect(edits).toEqual({});
    expect(ids).toEqual({});
  });
  it('keeps last occurrence per productType', () => {
    const tiers = [
      {
        id: 'first',
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 3000,
        backupPriceMinor: null,
        vatExclusive: true,
      },
      {
        id: 'second',
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 3500,
        backupPriceMinor: null,
        vatExclusive: true,
      },
    ] as unknown as Parameters<typeof normalizeOrgPricingTiers>[0];
    const { edits, ids } = normalizeOrgPricingTiers(tiers);
    expect(edits['iprs_standard']).toBe('3500');
    expect(ids['iprs_standard']).toBe('second');
  });
});

describe('normalizeGlobalTiers', () => {
  it('groups by productType sorted asc', () => {
    const tiers = [
      {
        id: '2',
        productType: 'iprs_standard',
        minVolume: 501,
        maxVolume: 2500,
        unitPriceMinor: 2800,
        backupPriceMinor: null,
        vatExclusive: true,
      },
      {
        id: '1',
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: 500,
        unitPriceMinor: 3000,
        backupPriceMinor: null,
        vatExclusive: true,
      },
    ] as unknown as Parameters<typeof normalizeGlobalTiers>[0];
    const out = normalizeGlobalTiers(tiers);
    expect(out['iprs_standard'][0].id).toBe('1');
    expect(out['iprs_standard'][1].id).toBe('2');
  });
});

describe('validation', () => {
  it('validatePriceInput', () => {
    expect(validatePriceInput('')).toBe('Enter a price');
    expect(validatePriceInput('abc')).toBe('Price must be a number');
    expect(validatePriceInput('0')).toBe('Price must be at least KES 1');
    expect(validatePriceInput('30')).toBeNull();
    expect(validatePriceInput('  45.50  ')).toBeNull();
  });
  it('validateMinorInput', () => {
    expect(validateMinorInput('')).toBe('Enter a price in minor units');
    expect(validateMinorInput('abc')).toBe('Price must be a number');
    expect(validateMinorInput('99')).toBe('Price must be at least 100 minor units (KES 1)');
    expect(validateMinorInput('100')).toBeNull();
    expect(validateMinorInput('3000')).toBeNull();
  });
  it('validateTierPrice', () => {
    expect(validateTierPrice('')).toBe('Price is required');
    expect(validateTierPrice('abc')).toBe('Price must be a number');
    expect(validateTierPrice('0')).toBe('Price must be at least 1');
    expect(validateTierPrice('3000')).toBeNull();
  });
});

describe('product catalog helpers', () => {
  it('requiresFileUpload', () => {
    expect(requiresFileUpload('face_id_match')).toBe(true);
    expect(requiresFileUpload('scanned_statement')).toBe(true);
    expect(requiresFileUpload('brs')).toBe(true);
    expect(requiresFileUpload('iprs_standard')).toBe(false);
  });
  it('requiresCbConsent', () => {
    expect(requiresCbConsent('metropol_score_only')).toBe(true);
    expect(requiresCbConsent('brs')).toBe(true);
    expect(requiresCbConsent('iprs_standard')).toBe(false);
  });
  it('getProductLabel', () => {
    expect(getProductLabel('iprs_standard')).toBe('IPRS Standard Verification');
    expect(getProductLabel('unknown_xyz')).toBe('unknown_xyz');
  });
  it('getProductCategory', () => {
    expect(getProductCategory('iprs_standard')).toBe('Identity — Standard');
    expect(getProductCategory('kra_pin_verification')).toBe('Utility');
    expect(getProductCategory('unknown')).toBe('Other');
  });
  it('formatCount', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(null)).toBe('—');
  });
});
