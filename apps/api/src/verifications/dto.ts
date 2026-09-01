import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { VerificationType } from '@fleek/types';

export class RunVerificationDto {
  @IsEnum(VerificationType)
  type!: VerificationType;

  /** National ID number (7–9 digits). */
  @IsOptional() @IsString() @Matches(/^\d{7,9}$/, { message: 'idNumber must be 7-9 digits' })
  idNumber?: string;

  /** KRA PIN, e.g. A012345678Z. */
  @IsOptional() @IsString() @Matches(/^[AP]\d{9}[A-Z]$/, { message: 'Invalid KRA PIN format' })
  kraPin?: string;

  /** Kenyan mobile number, e.g. 0712345678 or +254712345678. */
  @IsOptional() @IsString() @Matches(/^(\+?254|0)7\d{8}$/, { message: 'Invalid phone number format' })
  phoneNumber?: string;

  /** Alien ID for foreign nationals */
  @IsOptional() @IsString()
  alienId?: string;

  /** Passport number */
  @IsOptional() @IsString()
  passportNumber?: string;

  /** Nationality for passport/alien checks */
  @IsOptional() @IsString()
  nationality?: string;

  /** Bank code (e.g., 01 for KCB, 02 for Equity) */
  @IsOptional() @IsString()
  bankCode?: string;

  /** Bank account number */
  @IsOptional() @IsString()
  accountNumber?: string;

  /** Employer name for employer verification */
  @IsOptional() @IsString()
  employerName?: string;

  /** Meter number for KPLC */
  @IsOptional() @IsString()
  meterNumber?: string;

  /** Vehicle registration number */
  @IsOptional() @IsString()
  vehicleRegNumber?: string;

  /** Driver's license number */
  @IsOptional() @IsString()
  dlNumber?: string;

  /** Business registration number */
  @IsOptional() @IsString()
  businessRegNumber?: string;

  /** Face image as base64 for face ID match */
  @IsOptional() @IsString()
  faceImageBase64?: string;

  /** Number of pages in scanned statement */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100)
  statementPages?: number;

  /** Scanned statement file as base64 */
  @IsOptional() @IsString()
  statementFileBase64?: string;

  /** Consent for credit bureau checks (required for Metropol, CreditInfo, BRS, Motor Vehicle) */
  @IsOptional() @IsBoolean()
  cbConsent?: boolean;

  /** Use backup provider (explicit user toggle) */
  @IsOptional() @IsBoolean()
  useBackup?: boolean;

  @IsBoolean()
  consent!: boolean;

  @IsString() @IsNotEmpty()
  consentCollectedBy!: string;
}

export class ListVerificationsQuery {
  @IsOptional() @IsEnum(VerificationType)
  type?: VerificationType;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  from?: string;

  @IsOptional() @IsString()
  to?: string;

  @Type(() => Number) @IsOptional()
  limit?: number = 50;

  @Type(() => Number) @IsOptional()
  offset?: number = 0;
}

export class ProductWithTiersDto {
  type!: VerificationType;
  enabled!: boolean;
  live!: boolean;
  active!: boolean;
  label!: string;
  category!: string;
  unitPriceKes!: number | null;
  backupPriceKes!: number | null;
  currentTier!: {
    minVolume: number;
    maxVolume: number | null;
    unitPriceMinor: number;
    backupPriceMinor: number | null;
  } | null;
  vatExclusive!: boolean;
  cbConsentRequired!: boolean;
  requiresFileUpload!: boolean;
  fileTypes!: string[];
}