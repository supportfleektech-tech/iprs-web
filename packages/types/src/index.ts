export enum VerificationType {
  IPRS_STANDARD = 'iprs_standard',
  MATCH_ID_PHONE = 'match_id_phone',
  EMPLOYER_VERIFICATION = 'employer_verification',
  FACE_ID_MATCH = 'face_id_match',
  BANK_ACCOUNT_VERIFICATION = 'bank_account_verification',
  ALIEN_ID = 'alien_id',
  AML_PEP_SCREEN = 'aml_pep_screen',
  PASSPORT_CHECK = 'passport_check',
  SIM_SWAP_CHECK = 'sim_swap_check',
  KPLC_LOCATION_CHECKER = 'kplc_location_checker',
  KRA_PIN_VERIFICATION = 'kra_pin_verification',
  SEARCH_NAME_BY_PHONE = 'search_name_by_phone',
  SEARCH_PHONES_BY_ID = 'search_phones_by_id',
  MOTOR_VEHICLE_OWNERSHIP = 'motor_vehicle_ownership',
  DRIVERS_LICENSE_VERIFICATION = 'drivers_license_verification',
  METROPOL_SCORE_ONLY = 'metropol_score_only',
  METROPOL_STANDARD_REPORT = 'metropol_standard_report',
  METROPOL_FULL_REPORT = 'metropol_full_report',
  CREDITINFO_SCORE_ONLY = 'creditinfo_score_only',
  CREDITINFO_COMPREHENSIVE = 'creditinfo_comprehensive',
  CREDITINFO_CRB_STATUS = 'creditinfo_crb_status',
  BRS = 'brs',
  SPIN_SCORE_ONLY = 'spin_score_only',
  SCANNED_STATEMENT = 'scanned_statement',
}

export const VERIFICATION_TYPES: VerificationType[] = Object.values(VerificationType);

export type VerificationSource = 'dashboard' | 'api';

export type VerificationStatus = 'pending' | 'success' | 'not_found' | 'failed';

export interface Consent {
  consent: boolean;
  consentCollectedBy: string;
  cbConsent?: boolean;
}

export interface IprsStandardResult {
  idNumber: string;
  surname: string;
  firstName: string;
  otherName?: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  citizenship: string;
  serialNumber: string;
  placeOfBirth?: string;
  placeOfLive?: string;
  photoBase64?: string | null;
  aliveStatus: boolean;
}

export interface MatchIdPhoneResult {
  idNumber: string;
  phoneNumber: string;
  match: boolean;
  ownerName: string;
}

export interface EmployerVerificationResult {
  idNumber: string;
  employerName: string;
  isCurrentEmployer: boolean;
  employmentStatus: 'active' | 'inactive' | 'unknown';
}

export interface FaceIdMatchResult {
  idNumber: string;
  matchScore: number;
  matched: boolean;
  referenceImageBase64?: string;
}

export interface BankAccountVerificationResult {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  accountStatus: 'active' | 'dormant' | 'closed' | 'unknown';
  idNumberMatch: boolean;
}

export interface AlienIdResult {
  alienId: string;
  fullName: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'invalid';
}

export interface AmlPepScreenResult {
  idNumber: string;
  fullName: string;
  amlMatch: boolean;
  pepMatch: boolean;
  watchlistMatches: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PassportCheckResult {
  passportNumber: string;
  nationality: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  expiryDate: string;
  issuingCountry: string;
  status: 'valid' | 'expired' | 'invalid';
}

export interface SimSwapCheckResult {
  phoneNumber: string;
  lastSwapDate?: string;
  daysSinceSwap?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface KplcLocationCheckerResult {
  meterNumber: string;
  accountNumber: string;
  customerName: string;
  location: string;
  status: 'active' | 'inactive' | 'disconnected';
}

export interface KraPinVerificationResult {
  kraPin: string;
  idNumber?: string;
  taxpayerName: string;
  status: 'active' | 'inactive' | 'deregistered';
  taxObligation?: string;
}

export interface SearchNameByPhoneResult {
  phoneNumber: string;
  ownerName: string;
  idNumber?: string;
}

export interface SearchPhonesByIdResult {
  idNumber: string;
  registeredNumbers: string[];
  primaryNumber: string;
}

export interface MotorVehicleOwnershipResult {
  vehicleRegNumber: string;
  ownerIdNumber: string;
  ownerName: string;
  make: string;
  model: string;
  year: number;
  color: string;
  engineNumber: string;
  chassisNumber: string;
  logbookStatus: 'valid' | 'expired' | 'cancelled';
}

export interface DriversLicenseVerificationResult {
  dlNumber: string;
  idNumber: string;
  fullName: string;
  dateOfBirth: string;
  licenseClass: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'suspended' | 'revoked';
}

export interface MetropolScoreOnlyResult {
  score: number;
  scoreBand: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MetropolStandardReportResult {
  score: number;
  scoreBand: string;
  accountsSummary: {
    total: number;
    active: number;
    closed: number;
    defaulted: number;
  };
  paymentHistory: Array<{
    accountType: string;
    status: string;
    monthsInArrears: number;
  }>;
}

export interface MetropolFullReportResult {
  score: number;
  scoreBand: string;
  identity: {
    idNumber: string;
    fullName: string;
    dateOfBirth: string;
  };
  accounts: Array<{
    accountType: string;
    institution: string;
    balance: number;
    status: string;
    openedDate: string;
    paymentHistory: string;
  }>;
  inquiries: Array<{
    date: string;
    institution: string;
    purpose: string;
  }>;
  publicRecords: Array<{
    type: string;
    amount: number;
    date: string;
    status: string;
  }>;
}

export interface CreditInfoScoreOnlyResult {
  score: number;
  scoreBand: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CreditInfoComprehensiveResult {
  score: number;
  scoreBand: string;
  identity: {
    idNumber: string;
    fullName: string;
  };
  creditAccounts: Array<{
    lender: string;
    productType: string;
    balance: number;
    status: string;
    limit: number;
    repaymentHistory: string;
  }>;
  guarantees: Array<{
    borrower: string;
    amount: number;
    status: string;
  }>;
}

export interface CreditInfoCrbStatusResult {
  status: 'clear' | 'listed' | 'watchlist';
  listingDetails?: Array<{
    lender: string;
    amount: number;
    dateListed: string;
    status: string;
  }>;
}

export interface BrsResult {
  businessRegNumber: string;
  businessName: string;
  registrationDate: string;
  status: 'active' | 'dormant' | 'dissolved';
  directors: Array<{
    name: string;
    idNumber: string;
    role: string;
  }>;
  shareholders: Array<{
    name: string;
    idNumber: string;
    shares: number;
  }>;
  registeredAddress: string;
  businessType: string;
}

export interface SpinScoreOnlyResult {
  score: number;
  scoreBand: string;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
}

export interface ScannedStatementResult {
  pagesProcessed: number;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    balance: number;
  }>;
  summary: {
    totalCredits: number;
    totalDebits: number;
    openingBalance: number;
    closingBalance: number;
    transactionCount: number;
  };
}

export type VerificationResultMap = {
  [VerificationType.IPRS_STANDARD]: IprsStandardResult;
  [VerificationType.MATCH_ID_PHONE]: MatchIdPhoneResult;
  [VerificationType.EMPLOYER_VERIFICATION]: EmployerVerificationResult;
  [VerificationType.FACE_ID_MATCH]: FaceIdMatchResult;
  [VerificationType.BANK_ACCOUNT_VERIFICATION]: BankAccountVerificationResult;
  [VerificationType.ALIEN_ID]: AlienIdResult;
  [VerificationType.AML_PEP_SCREEN]: AmlPepScreenResult;
  [VerificationType.PASSPORT_CHECK]: PassportCheckResult;
  [VerificationType.SIM_SWAP_CHECK]: SimSwapCheckResult;
  [VerificationType.KPLC_LOCATION_CHECKER]: KplcLocationCheckerResult;
  [VerificationType.KRA_PIN_VERIFICATION]: KraPinVerificationResult;
  [VerificationType.SEARCH_NAME_BY_PHONE]: SearchNameByPhoneResult;
  [VerificationType.SEARCH_PHONES_BY_ID]: SearchPhonesByIdResult;
  [VerificationType.MOTOR_VEHICLE_OWNERSHIP]: MotorVehicleOwnershipResult;
  [VerificationType.DRIVERS_LICENSE_VERIFICATION]: DriversLicenseVerificationResult;
  [VerificationType.METROPOL_SCORE_ONLY]: MetropolScoreOnlyResult;
  [VerificationType.METROPOL_STANDARD_REPORT]: MetropolStandardReportResult;
  [VerificationType.METROPOL_FULL_REPORT]: MetropolFullReportResult;
  [VerificationType.CREDITINFO_SCORE_ONLY]: CreditInfoScoreOnlyResult;
  [VerificationType.CREDITINFO_COMPREHENSIVE]: CreditInfoComprehensiveResult;
  [VerificationType.CREDITINFO_CRB_STATUS]: CreditInfoCrbStatusResult;
  [VerificationType.BRS]: BrsResult;
  [VerificationType.SPIN_SCORE_ONLY]: SpinScoreOnlyResult;
  [VerificationType.SCANNED_STATEMENT]: ScannedStatementResult;
};

export type VerificationResult =
  | IprsStandardResult
  | MatchIdPhoneResult
  | EmployerVerificationResult
  | FaceIdMatchResult
  | BankAccountVerificationResult
  | AlienIdResult
  | AmlPepScreenResult
  | PassportCheckResult
  | SimSwapCheckResult
  | KplcLocationCheckerResult
  | KraPinVerificationResult
  | SearchNameByPhoneResult
  | SearchPhonesByIdResult
  | MotorVehicleOwnershipResult
  | DriversLicenseVerificationResult
  | MetropolScoreOnlyResult
  | MetropolStandardReportResult
  | MetropolFullReportResult
  | CreditInfoScoreOnlyResult
  | CreditInfoComprehensiveResult
  | CreditInfoCrbStatusResult
  | BrsResult
  | SpinScoreOnlyResult
  | ScannedStatementResult;

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface ApiError {
  code: string;
  message: string;
}

export interface VerificationResponse<T extends VerificationResult = VerificationResult> {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  result: T | null;
  cost: number;
  createdAt: string;
  isBackup?: boolean;
  backupAvailable?: boolean;
  backupPrice?: number;
}

export const PRODUCT_LABELS: Record<VerificationType, string> = {
  [VerificationType.IPRS_STANDARD]: 'IPRS Standard Verification',
  [VerificationType.MATCH_ID_PHONE]: 'Match ID & Phone Number',
  [VerificationType.EMPLOYER_VERIFICATION]: 'Employer Verification',
  [VerificationType.FACE_ID_MATCH]: 'Face ID Match',
  [VerificationType.BANK_ACCOUNT_VERIFICATION]: 'Bank Account Verification',
  [VerificationType.ALIEN_ID]: 'Alien ID Verification',
  [VerificationType.AML_PEP_SCREEN]: 'AML & PEP Screen',
  [VerificationType.PASSPORT_CHECK]: 'Passport Check',
  [VerificationType.SIM_SWAP_CHECK]: 'SIM Swap Check',
  [VerificationType.KPLC_LOCATION_CHECKER]: 'KPLC Location Checker',
  [VerificationType.KRA_PIN_VERIFICATION]: 'KRA PIN Verification',
  [VerificationType.SEARCH_NAME_BY_PHONE]: 'Search Name by Phone Number',
  [VerificationType.SEARCH_PHONES_BY_ID]: 'Search Phone Numbers by ID',
  [VerificationType.MOTOR_VEHICLE_OWNERSHIP]: 'Motor Vehicle Ownership',
  [VerificationType.DRIVERS_LICENSE_VERIFICATION]: "Driver's License Verification",
  [VerificationType.METROPOL_SCORE_ONLY]: 'Metropol Score Only',
  [VerificationType.METROPOL_STANDARD_REPORT]: 'Metropol Standard Report',
  [VerificationType.METROPOL_FULL_REPORT]: 'Metropol Full Report',
  [VerificationType.CREDITINFO_SCORE_ONLY]: 'CreditInfo Score Only',
  [VerificationType.CREDITINFO_COMPREHENSIVE]: 'CreditInfo Comprehensive Report',
  [VerificationType.CREDITINFO_CRB_STATUS]: 'CreditInfo CRB Status',
  [VerificationType.BRS]: 'BRS (Business Registration)',
  [VerificationType.SPIN_SCORE_ONLY]: 'SPIN Score Only',
  [VerificationType.SCANNED_STATEMENT]: 'Scanned Statement Analysis',
};

export const PRODUCT_CATEGORIES: Record<string, VerificationType[]> = {
  'Identity — Standard': [
    VerificationType.IPRS_STANDARD,
    VerificationType.MATCH_ID_PHONE,
    VerificationType.EMPLOYER_VERIFICATION,
    VerificationType.FACE_ID_MATCH,
    VerificationType.BANK_ACCOUNT_VERIFICATION,
  ],
  'Identity — Premium': [
    VerificationType.ALIEN_ID,
    VerificationType.AML_PEP_SCREEN,
    VerificationType.PASSPORT_CHECK,
  ],
  Utility: [
    VerificationType.SIM_SWAP_CHECK,
    VerificationType.KPLC_LOCATION_CHECKER,
    VerificationType.KRA_PIN_VERIFICATION,
    VerificationType.SEARCH_NAME_BY_PHONE,
  ],
  'Identity & CRB': [VerificationType.SEARCH_PHONES_BY_ID],
  Vehicle: [
    VerificationType.MOTOR_VEHICLE_OWNERSHIP,
    VerificationType.DRIVERS_LICENSE_VERIFICATION,
  ],
  'Credit Reference — Metropol': [
    VerificationType.METROPOL_SCORE_ONLY,
    VerificationType.METROPOL_STANDARD_REPORT,
    VerificationType.METROPOL_FULL_REPORT,
  ],
  'Credit Reference — CreditInfo': [
    VerificationType.CREDITINFO_SCORE_ONLY,
    VerificationType.CREDITINFO_COMPREHENSIVE,
    VerificationType.CREDITINFO_CRB_STATUS,
  ],
  KYB: [VerificationType.BRS],
  Analytics: [VerificationType.SPIN_SCORE_ONLY, VerificationType.SCANNED_STATEMENT],
};

export const CB_CONSENT_REQUIRED_TYPES: VerificationType[] = [
  VerificationType.METROPOL_SCORE_ONLY,
  VerificationType.METROPOL_STANDARD_REPORT,
  VerificationType.METROPOL_FULL_REPORT,
  VerificationType.CREDITINFO_SCORE_ONLY,
  VerificationType.CREDITINFO_COMPREHENSIVE,
  VerificationType.CREDITINFO_CRB_STATUS,
  VerificationType.BRS,
  VerificationType.MOTOR_VEHICLE_OWNERSHIP,
];
