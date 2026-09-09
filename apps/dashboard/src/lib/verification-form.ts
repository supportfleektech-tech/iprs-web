import {
  PRODUCT_LABELS,
  type VerificationType,
} from '@fleek/types';

export interface VerificationFormValues {
  idNumber?: string;
  phoneNumber?: string;
  kraPin?: string;
  alienId?: string;
  passportNumber?: string;
  nationality?: string;
  bankCode?: string;
  accountNumber?: string;
  employerName?: string;
  meterNumber?: string;
  vehicleRegNumber?: string;
  dlNumber?: string;
  businessRegNumber?: string;
  statementPages?: string;
  faceImageBase64?: string;
  statementFileBase64?: string;
  cbConsent?: boolean;
  consent?: boolean;
}

export type VerificationInputType =
  | 'search'
  | 'number'
  | 'tel'
  | 'text'
  | 'none'
  | 'email'
  | 'url'
  | 'decimal'
  | 'file';

export interface VerificationFormField {
  key: keyof VerificationFormValues;
  label: string;
  hint: string;
  inputType?: VerificationInputType;
  inputMode?: 'numeric' | 'tel' | 'decimal' | 'email' | 'url' | 'search' | 'text' | 'none';
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

// Mirrors /verifications/products response shape — used as ProductOption in workspace/form
export interface ProductOption {
  type: VerificationType;
  label: string;
  category: string;
  enabled: boolean;
  active: boolean;
  unitPriceKes: number | null;
  backupPriceKes: number | null;
  currentTier?: {
    minVolume: number;
    maxVolume: number | null;
    unitPriceMinor: number;
    backupPriceMinor: number | null;
  } | null;
  vatExclusive: boolean;
  cbConsentRequired: boolean;
  requiresFileUpload: boolean;
  fileTypes: string[];
  backupAvailable: boolean;
  live: boolean;
}

export const VERIFICATION_FORM_FIELDS: Record<VerificationType, VerificationFormField[]> = {
  iprs_standard: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  match_id_phone: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
    { key: 'phoneNumber', label: 'Phone number', hint: 'Use an 07 or +2547 Kenyan mobile number.', inputMode: 'tel', placeholder: '0712345678', required: true },
  ],
  employer_verification: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
    { key: 'employerName', label: 'Employer name', hint: 'Enter the employer exactly as registered.', placeholder: 'Acme Ltd', required: true },
  ],
  face_id_match: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
    { key: 'faceImageBase64', label: 'Face image', hint: 'Upload a clear JPEG or PNG face image (max 5 MB).', inputType: 'file', required: true },
  ],
  bank_account_verification: [
    { key: 'accountNumber', label: 'Account number', hint: 'Enter the beneficiary account number.', inputMode: 'numeric', placeholder: '0123456789', required: true },
    { key: 'bankCode', label: 'Bank code', hint: 'Enter the bank code, for example 01 for KCB.', inputMode: 'numeric', placeholder: '01', required: true },
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the account holder ID when requested by the provider.', inputMode: 'numeric', placeholder: '12345678' },
  ],
  alien_id: [
    { key: 'alienId', label: 'Alien ID number', hint: 'Enter the alien ID issued by Kenyan authorities.', placeholder: 'A123456', required: true },
  ],
  aml_pep_screen: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  passport_check: [
    { key: 'passportNumber', label: 'Passport number', hint: 'Enter the passport number.', placeholder: 'A1234567', required: true },
    { key: 'nationality', label: 'Nationality', hint: 'Enter the nationality shown on the passport.', placeholder: 'Kenyan', required: true },
  ],
  sim_swap_check: [
    { key: 'phoneNumber', label: 'Phone number', hint: 'Use an 07 or +2547 Kenyan mobile number.', inputMode: 'tel', placeholder: '0712345678', required: true },
  ],
  kplc_location_checker: [
    { key: 'meterNumber', label: 'KPLC meter number', hint: 'Enter the meter number shown on the electricity bill.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  kra_pin_verification: [
    { key: 'kraPin', label: 'KRA PIN', hint: 'Enter a KRA PIN, for example A012345678Z.', placeholder: 'A012345678Z', required: true },
    { key: 'idNumber', label: 'National ID number', hint: 'Optional when the KRA PIN is provided.', inputMode: 'numeric', placeholder: '12345678' },
  ],
  search_name_by_phone: [
    { key: 'phoneNumber', label: 'Phone number', hint: 'Use an 07 or +2547 Kenyan mobile number.', inputMode: 'tel', placeholder: '0712345678', required: true },
  ],
  search_phones_by_id: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  motor_vehicle_ownership: [
    { key: 'vehicleRegNumber', label: 'Vehicle registration number', hint: 'Enter the registration number without spaces.', placeholder: 'KAA123A', required: true },
  ],
  drivers_license_verification: [
    { key: 'dlNumber', label: 'Driving licence number', hint: 'Enter the licence number.', placeholder: 'DL123456', required: true },
  ],
  metropol_score_only: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  metropol_standard_report: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  metropol_full_report: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  creditinfo_score_only: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  creditinfo_comprehensive: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  creditinfo_crb_status: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  brs: [
    { key: 'businessRegNumber', label: 'Business registration number', hint: 'Enter the business registration number.', placeholder: 'BN123456', required: true },
  ],
  spin_score_only: [
    { key: 'idNumber', label: 'National ID number', hint: 'Enter the 7–9 digit Kenyan ID number.', inputMode: 'numeric', placeholder: '12345678', required: true },
  ],
  scanned_statement: [
    { key: 'statementPages', label: 'Statement pages', hint: 'Enter the number of statement pages included in the upload.', inputType: 'number', inputMode: 'numeric', placeholder: '6', required: true },
    { key: 'statementFileBase64', label: 'Statement file', hint: 'Upload a PDF, JPEG, or PNG statement (max 5 MB).', inputType: 'file', required: true },
  ],
};

export function getVerificationFormValues(type: VerificationType): VerificationFormValues {
  return Object.fromEntries(VERIFICATION_FORM_FIELDS[type].map((field) => [field.key, ''])) as VerificationFormValues;
}

export function hasRequiredValues(values: VerificationFormValues, type: VerificationType): boolean {
  return VERIFICATION_FORM_FIELDS[type].every((field) => {
    const value = values[field.key];
    return field.required ? Boolean(String(value ?? '').trim()) : true;
  });
}

export function getRequiredFieldKeys(type: VerificationType): Array<keyof VerificationFormValues> {
  return VERIFICATION_FORM_FIELDS[type].filter((f) => f.required).map((f) => f.key);
}

export function groupProductsByCategory(products: ProductOption[]): Map<string, ProductOption[]> {
  const groups = new Map<string, ProductOption[]>();
  for (const product of products) {
    const current = groups.get(product.category) ?? [];
    current.push(product);
    groups.set(product.category, current);
  }
  return groups;
}

export function isConsentGatingBlocked(values: VerificationFormValues, requiresCbConsent: boolean): boolean {
  if (values.consent !== true) return true;
  if (requiresCbConsent && values.cbConsent !== true) return true;
  return false;
}

export function humanise(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatCurrency(value: number | null | undefined): string {
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)}`;
}

export function maskSubject(value: string | null | undefined): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
  return `${'*'.repeat(Math.max(trimmed.length - 4, 0))}${trimmed.slice(-4)}`;
}

export function formatResultValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatResultValue).join(', ');
  return JSON.stringify(value);
}

export function isSensitiveResultKey(key: string): boolean {
  return /base64|image|secret|token/i.test(key);
}

export function getVerificationLabel(type: VerificationType): string {
  return PRODUCT_LABELS[type];
}

export function filterSensitiveResultEntries(result: Record<string, unknown> | null): Array<[string, unknown]> {
  if (!result) return [];
  return Object.entries(result).filter(([key]) => !isSensitiveResultKey(key));
}
