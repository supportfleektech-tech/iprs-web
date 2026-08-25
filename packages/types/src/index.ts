export enum VerificationType {
  IPRS_ID = 'iprs_id',
  KRA_PIN = 'kra_pin',
  PHONE_OWNERSHIP = 'phone_ownership',
  SIM_SWAP = 'sim_swap',
}

export const VERIFICATION_TYPES: VerificationType[] = Object.values(VerificationType);

export type VerificationSource = 'dashboard' | 'api';

export type VerificationStatus = 'pending' | 'success' | 'not_found' | 'failed';

export interface Consent {
  consent: boolean;
  consentCollectedBy: string;
}

export interface IprsResult {
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
  photoBase64?: string;
  aliveStatus: boolean;
}

export interface KraResult {
  idNumber?: string;
  kraPin: string;
  taxpayerName: string;
  status: 'active' | 'inactive' | 'deregistered';
  taxObligation?: string;
}

export interface PhoneResult {
  ownerName: string;
  idNumber?: string;
  registeredNumbers: string[];
  mpesaRegistered: boolean;
}

export interface SimSwapResult {
  phoneNumber: string;
  lastSwapDate?: string;
  daysSinceSwap?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export type VerificationResultMap = {
  [VerificationType.IPRS_ID]: IprsResult;
  [VerificationType.KRA_PIN]: KraResult;
  [VerificationType.PHONE_OWNERSHIP]: PhoneResult;
  [VerificationType.SIM_SWAP]: SimSwapResult;
};

export type VerificationResult = IprsResult | KraResult | PhoneResult | SimSwapResult;

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
}

export const PRODUCT_LABELS: Record<VerificationType, string> = {
  [VerificationType.IPRS_ID]: 'IPRS ID Verification',
  [VerificationType.KRA_PIN]: 'KRA PIN Checker',
  [VerificationType.PHONE_OWNERSHIP]: 'Hakikisha / Phone Check',
  [VerificationType.SIM_SWAP]: 'SIM-swap Detection',
};
