import type { VerificationType } from '@fleek/types';
import type {
  IprsStandardResult,
  MatchIdPhoneResult,
  EmployerVerificationResult,
  FaceIdMatchResult,
  BankAccountVerificationResult,
  AlienIdResult,
  AmlPepScreenResult,
  PassportCheckResult,
  SimSwapCheckResult,
  KplcLocationCheckerResult,
  KraPinVerificationResult,
  SearchNameByPhoneResult,
  SearchPhonesByIdResult,
  MotorVehicleOwnershipResult,
  DriversLicenseVerificationResult,
  MetropolScoreOnlyResult,
  MetropolStandardReportResult,
  MetropolFullReportResult,
  CreditInfoScoreOnlyResult,
  CreditInfoComprehensiveResult,
  CreditInfoCrbStatusResult,
  BrsResult,
  SpinScoreOnlyResult,
  ScannedStatementResult,
} from '@fleek/types';

export interface KraInput {
  kraPin?: string;
  idNumber?: string;
  [key: string]: unknown;
}

export interface PhoneInput {
  phoneNumber?: string;
  idNumber?: string;
  [key: string]: unknown;
}

export interface FaceIdInput {
  faceImageBase64: string;
  idNumber: string;
  [key: string]: unknown;
}

export interface BankAccountInput {
  accountNumber: string;
  bankCode: string;
  idNumber?: string;
  [key: string]: unknown;
}

export interface AlienIdInput {
  alienId: string;
  [key: string]: unknown;
}

export interface PassportInput {
  passportNumber: string;
  nationality: string;
  [key: string]: unknown;
}

export interface EmployerInput {
  idNumber: string;
  employerName: string;
  [key: string]: unknown;
}

export interface MeterInput {
  meterNumber: string;
  [key: string]: unknown;
}

export interface VehicleInput {
  vehicleRegNumber: string;
  [key: string]: unknown;
}

export interface DriversLicenseInput {
  dlNumber: string;
  [key: string]: unknown;
}

export interface BusinessRegInput {
  businessRegNumber: string;
  [key: string]: unknown;
}

export interface ScannedStatementInput {
  statementPages: number;
  fileBase64?: string;
  [key: string]: unknown;
}

/**
 * Contract every upstream data source must fulfil.
 * v1 ships a MockProvider; real adapters (NRB direct / aggregators / SPIN)
 * implement this same interface behind feature flags.
 */
export interface VerificationProvider {
  readonly name: string;
  readonly sandbox: boolean;
  readonly supported: VerificationType[];

  // Identity — Standard
  iprsStandardLookup(idNumber: string): Promise<IprsStandardResult>;
  matchIdPhone(input: { idNumber: string; phoneNumber: string }): Promise<MatchIdPhoneResult>;
  employerVerification(input: EmployerInput): Promise<EmployerVerificationResult>;
  faceIdMatch(input: FaceIdInput): Promise<FaceIdMatchResult>;
  bankAccountVerification(input: BankAccountInput): Promise<BankAccountVerificationResult>;

  // Identity — Premium
  alienIdLookup(input: AlienIdInput): Promise<AlienIdResult>;
  amlPepScreen(idNumber: string): Promise<AmlPepScreenResult>;
  passportCheck(input: PassportInput): Promise<PassportCheckResult>;

  // Utility
  simSwapCheck(phoneNumber: string): Promise<SimSwapCheckResult>;
  kplcLocationChecker(input: MeterInput): Promise<KplcLocationCheckerResult>;
  kraPinCheck(input: KraInput): Promise<KraPinVerificationResult>;
  searchNameByPhone(phoneNumber: string): Promise<SearchNameByPhoneResult>;

  // Identity & CRB
  searchPhonesById(idNumber: string): Promise<SearchPhonesByIdResult>;

  // Vehicle
  motorVehicleOwnership(input: VehicleInput): Promise<MotorVehicleOwnershipResult>;
  driversLicenseVerification(input: DriversLicenseInput): Promise<DriversLicenseVerificationResult>;

  // Credit Reference — Metropol
  metropolScoreOnly(idNumber: string): Promise<MetropolScoreOnlyResult>;
  metropolStandardReport(idNumber: string): Promise<MetropolStandardReportResult>;
  metropolFullReport(idNumber: string): Promise<MetropolFullReportResult>;

  // Credit Reference — CreditInfo
  creditInfoScoreOnly(idNumber: string): Promise<CreditInfoScoreOnlyResult>;
  creditInfoComprehensive(idNumber: string): Promise<CreditInfoComprehensiveResult>;
  creditInfoCrbStatus(idNumber: string): Promise<CreditInfoCrbStatusResult>;

  // KYB
  brsLookup(input: BusinessRegInput): Promise<BrsResult>;

  // Analytics
  spinScoreOnly(idNumber: string): Promise<SpinScoreOnlyResult>;
  scannedStatementAnalysis(input: ScannedStatementInput): Promise<ScannedStatementResult>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'UPSTREAM_DOWN' | 'INVALID_INPUT' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function assertSupported(type: VerificationType, supported: VerificationType[]): void {
  if (!supported.includes(type)) {
    throw new ProviderError('INVALID_INPUT', `Provider does not support check type "${type}"`);
  }
}

export type { VerificationType };
export type {
  IprsStandardResult,
  MatchIdPhoneResult,
  EmployerVerificationResult,
  FaceIdMatchResult,
  BankAccountVerificationResult,
  AlienIdResult,
  AmlPepScreenResult,
  PassportCheckResult,
  SimSwapCheckResult,
  KplcLocationCheckerResult,
  KraPinVerificationResult,
  SearchNameByPhoneResult,
  SearchPhonesByIdResult,
  MotorVehicleOwnershipResult,
  DriversLicenseVerificationResult,
  MetropolScoreOnlyResult,
  MetropolStandardReportResult,
  MetropolFullReportResult,
  CreditInfoScoreOnlyResult,
  CreditInfoComprehensiveResult,
  CreditInfoCrbStatusResult,
  BrsResult,
  SpinScoreOnlyResult,
  ScannedStatementResult,
};
