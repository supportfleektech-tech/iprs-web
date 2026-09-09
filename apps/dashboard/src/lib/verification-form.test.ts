import { describe, it, expect } from 'vitest';
import { VerificationType } from '@fleek/types';
import {
  VERIFICATION_FORM_FIELDS,
  getRequiredFieldKeys,
  hasRequiredValues,
  isConsentGatingBlocked,
  groupProductsByCategory,
  humanise,
  formatCurrency,
  formatResultValue,
  isSensitiveResultKey,
  filterSensitiveResultEntries,
  type ProductOption,
} from './verification-form';

describe('hasRequiredValues', () => {
  it('requires idNumber for iprs_standard', () => {
    expect(hasRequiredValues({ idNumber: '12345678' }, VerificationType.IPRS_STANDARD)).toBe(true);
    expect(hasRequiredValues({ idNumber: '' }, VerificationType.IPRS_STANDARD)).toBe(false);
    expect(hasRequiredValues({}, VerificationType.IPRS_STANDARD)).toBe(false);
    expect(hasRequiredValues({ idNumber: '   ' }, VerificationType.IPRS_STANDARD)).toBe(false);
  });

  it('requires both fields for match_id_phone', () => {
    expect(hasRequiredValues({ idNumber: '12345678', phoneNumber: '0712345678' }, VerificationType.MATCH_ID_PHONE)).toBe(true);
    expect(hasRequiredValues({ idNumber: '12345678' }, VerificationType.MATCH_ID_PHONE)).toBe(false);
    expect(hasRequiredValues({ phoneNumber: '0712345678' }, VerificationType.MATCH_ID_PHONE)).toBe(false);
  });

  it('requires file for face_id_match', () => {
    expect(hasRequiredValues({ idNumber: '12345678', faceImageBase64: 'data:image/jpeg;base64,xxx' }, VerificationType.FACE_ID_MATCH)).toBe(true);
    expect(hasRequiredValues({ idNumber: '12345678' }, VerificationType.FACE_ID_MATCH)).toBe(false);
  });

  it('requires employerName for employer_verification', () => {
    expect(hasRequiredValues({ idNumber: '12345678', employerName: 'Acme' }, VerificationType.EMPLOYER_VERIFICATION)).toBe(true);
    expect(hasRequiredValues({ idNumber: '12345678', employerName: '' }, VerificationType.EMPLOYER_VERIFICATION)).toBe(false);
  });

  it('optional idNumber for kra_pin_verification needs only kraPin', () => {
    expect(hasRequiredValues({ kraPin: 'A012345678Z' }, VerificationType.KRA_PIN_VERIFICATION)).toBe(true);
    expect(hasRequiredValues({ kraPin: 'A012345678Z', idNumber: '12345678' }, VerificationType.KRA_PIN_VERIFICATION)).toBe(true);
    // kraPin is required per fields
    expect(hasRequiredValues({ idNumber: '12345678' }, VerificationType.KRA_PIN_VERIFICATION)).toBe(false);
  });

  it('requires businessRegNumber and file for brs', () => {
    expect(hasRequiredValues({ businessRegNumber: 'BN123', statementFileBase64: 'data:pdf;base64,xxx' }, VerificationType.BRS)).toBe(true);
    expect(hasRequiredValues({ businessRegNumber: 'BN123' }, VerificationType.BRS)).toBe(false);
    expect(hasRequiredValues({ statementFileBase64: 'data:pdf;base64,xxx' }, VerificationType.BRS)).toBe(false);
    expect(hasRequiredValues({}, VerificationType.BRS)).toBe(false);
  });

  it('requires statementPages and file for scanned_statement', () => {
    expect(hasRequiredValues({ statementPages: '6', statementFileBase64: 'data:pdf;base64,xxx' }, VerificationType.SCANNED_STATEMENT)).toBe(true);
    expect(hasRequiredValues({ statementPages: '6' }, VerificationType.SCANNED_STATEMENT)).toBe(false);
    expect(hasRequiredValues({ statementFileBase64: 'data:pdf;base64,xxx' }, VerificationType.SCANNED_STATEMENT)).toBe(false);
  });
});

describe('getRequiredFieldKeys', () => {
  it('returns required keys', () => {
    expect(getRequiredFieldKeys(VerificationType.IPRS_STANDARD)).toEqual(['idNumber']);
    expect(getRequiredFieldKeys(VerificationType.MATCH_ID_PHONE)).toEqual(['idNumber', 'phoneNumber']);
    expect(getRequiredFieldKeys(VerificationType.BANK_ACCOUNT_VERIFICATION)).toEqual(['accountNumber', 'bankCode']);
  });
});

describe('isConsentGatingBlocked', () => {
  it('blocks when consent false', () => {
    expect(isConsentGatingBlocked({ consent: false }, false)).toBe(true);
    expect(isConsentGatingBlocked({}, false)).toBe(true);
    expect(isConsentGatingBlocked({ consent: true }, false)).toBe(false);
  });

  it('blocks when cbConsent required but missing', () => {
    expect(isConsentGatingBlocked({ consent: true }, true)).toBe(true);
    expect(isConsentGatingBlocked({ consent: true, cbConsent: false }, true)).toBe(true);
    expect(isConsentGatingBlocked({ consent: true, cbConsent: true }, true)).toBe(false);
  });

  it('allows when cbConsent provided but not required', () => {
    expect(isConsentGatingBlocked({ consent: true, cbConsent: false }, false)).toBe(false);
  });
});

describe('groupProductsByCategory', () => {
  it('groups by category', () => {
    const products: ProductOption[] = [
      { type: VerificationType.IPRS_STANDARD, label: 'IPRS', category: 'Identity — Standard', enabled: true, active: true, unitPriceKes: 30, backupPriceKes: null, vatExclusive: true, cbConsentRequired: false, requiresFileUpload: false, fileTypes: [], backupAvailable: false, live: true },
      { type: VerificationType.ALIEN_ID, label: 'Alien', category: 'Identity — Premium', enabled: true, active: true, unitPriceKes: 30, backupPriceKes: null, vatExclusive: true, cbConsentRequired: false, requiresFileUpload: false, fileTypes: [], backupAvailable: false, live: true },
      { type: VerificationType.IPRS_STANDARD, label: 'IPRS 2', category: 'Identity — Standard', enabled: true, active: true, unitPriceKes: 30, backupPriceKes: null, vatExclusive: true, cbConsentRequired: false, requiresFileUpload: false, fileTypes: [], backupAvailable: false, live: true },
    ] as ProductOption[];
    const grouped = groupProductsByCategory(products);
    expect(grouped.get('Identity — Standard')?.length).toBe(2);
    expect(grouped.get('Identity — Premium')?.length).toBe(1);
  });

  it('handles empty', () => {
    expect(groupProductsByCategory([]).size).toBe(0);
  });
});

describe('isSensitiveResultKey', () => {
  it('flags base64 and image keys', () => {
    expect(isSensitiveResultKey('photoBase64')).toBe(true);
    expect(isSensitiveResultKey('faceImageBase64')).toBe(true);
    expect(isSensitiveResultKey('referenceImageBase64')).toBe(true);
    expect(isSensitiveResultKey('imageUrl')).toBe(true);
    expect(isSensitiveResultKey('token')).toBe(true);
    expect(isSensitiveResultKey('secret')).toBe(true);
  });

  it('allows normal keys', () => {
    expect(isSensitiveResultKey('fullName')).toBe(false);
    expect(isSensitiveResultKey('idNumber')).toBe(false);
    expect(isSensitiveResultKey('match')).toBe(false);
    expect(isSensitiveResultKey('score')).toBe(false);
  });
});

describe('filterSensitiveResultEntries', () => {
  it('excludes base64 image fields from display', () => {
    const result = {
      fullName: 'John Doe',
      idNumber: '12345678',
      photoBase64: 'data:image/jpeg;base64,xxx',
      referenceImageBase64: 'data:image/jpeg;base64,yyy',
      match: true,
    };
    const filtered = filterSensitiveResultEntries(result);
    expect(filtered.map(([k]) => k)).toEqual(['fullName', 'idNumber', 'match']);
    expect(filtered.find(([k]) => k === 'photoBase64')).toBeUndefined();
  });

  it('handles null', () => {
    expect(filterSensitiveResultEntries(null)).toEqual([]);
  });
});

describe('formatResultValue', () => {
  it('formats primitives', () => {
    expect(formatResultValue(null)).toBe('—');
    expect(formatResultValue(undefined)).toBe('—');
    expect(formatResultValue(true)).toBe('Yes');
    expect(formatResultValue(false)).toBe('No');
    expect(formatResultValue(1234)).toBe('1,234');
    expect(formatResultValue('hello')).toBe('hello');
  });

  it('formats arrays', () => {
    expect(formatResultValue([1, 2])).toBe('1,234'.replace('1,234', '1, 2') || '1, 2');
    // Use actual locale - check contains
    const v = formatResultValue(['a', 'b']);
    expect(v).toBe('a, b');
  });

  it('stringifies objects', () => {
    expect(formatResultValue({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
  });
});

describe('backup banner visibility', () => {
  function shouldShowBackupBanner(detail: { backupAvailable?: boolean; backupPrice?: number | null; status?: string; errorMessage?: string | null }): boolean {
    return Boolean(detail.backupAvailable && detail.backupPrice != null && (detail.status === 'failed' || !!detail.errorMessage));
  }

  it('shows only when both available and price present and status failed', () => {
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: 45, status: 'failed' })).toBe(true);
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: 45, errorMessage: 'Upstream down', status: 'failed' })).toBe(true);
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: null, status: 'failed' })).toBe(false);
    expect(shouldShowBackupBanner({ backupAvailable: false, backupPrice: 45, status: 'failed' })).toBe(false);
    expect(shouldShowBackupBanner({ backupAvailable: true, status: 'failed' })).toBe(false);
    expect(shouldShowBackupBanner({})).toBe(false);
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: 0, status: 'failed' })).toBe(true);
  });

  it('does not show on success even if backup fields present', () => {
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: 45, status: 'success' })).toBe(false);
    expect(shouldShowBackupBanner({ backupAvailable: true, backupPrice: 45, status: 'success', errorMessage: null })).toBe(false);
  });
});

describe('result panel formatting', () => {
  it('humanise formats keys', () => {
    expect(humanise('idNumber')).toBe('Id Number');
    expect(humanise('fullName')).toBe('Full Name');
    expect(humanise('vehicleRegNumber')).toBe('Vehicle Reg Number');
  });

  it('formatCurrency formats KES', () => {
    expect(formatCurrency(30)).toBe('KES 30.00');
    expect(formatCurrency(null)).toBe('KES 0.00');
    expect(formatCurrency(1234.5)).toBe('KES 1,234.50');
  });

  it('VERIFICATION_FORM_FIELDS covers all 24 types', () => {
    expect(Object.keys(VERIFICATION_FORM_FIELDS).length).toBe(24);
  });
});
