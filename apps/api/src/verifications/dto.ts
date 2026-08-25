import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { VerificationType } from '@fleek/types';

export class RunVerificationDto {
  @IsEnum(VerificationType)
  type!: VerificationType;

  /** National ID number (7–9 digits). */
  @IsOptional() @IsString() @Matches(/^\d{7,9}$/, { message: 'idNumber must be 7-9 digits' })
  idNumber?: string;

  /** KRA PIN, e.g. A012345678Z. */
  @IsOptional() @IsString()
  kraPin?: string;

  /** Kenyan mobile number, e.g. 0712345678 or +254712345678. */
  @IsOptional() @IsString()
  phoneNumber?: string;

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

  @Type(() => Number) @IsOptional()
  limit?: number = 50;

  @Type(() => Number) @IsOptional()
  offset?: number = 0;
}
