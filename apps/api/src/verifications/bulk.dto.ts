import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { VerificationType } from '@fleek/types';

export class BulkRowDto {
  @IsOptional() @IsNumberString({}, { message: 'idNumber must be digits' })
  idNumber?: string;

  @IsOptional() @IsString() @Matches(/^[AP]\d{9}[A-Z]$/, { message: 'Invalid KRA PIN format' })
  kraPin?: string;

  @IsOptional() @IsString() @Matches(/^(\+?254|0)7\d{8}$/, { message: 'Invalid phone number format' })
  phoneNumber?: string;

  @IsOptional() @IsString()
  alienId?: string;

  @IsOptional() @IsString()
  passportNumber?: string;

  @IsOptional() @IsString()
  nationality?: string;

  @IsOptional() @IsString()
  bankCode?: string;

  @IsOptional() @IsString()
  accountNumber?: string;

  @IsOptional() @IsString()
  employerName?: string;

  @IsOptional() @IsString()
  meterNumber?: string;

  @IsOptional() @IsString()
  vehicleRegNumber?: string;

  @IsOptional() @IsString()
  dlNumber?: string;

  @IsOptional() @IsString()
  businessRegNumber?: string;
}

export class CreateBatchDto {
  @IsEnum(VerificationType)
  type!: VerificationType;

  @IsString() @IsNotEmpty() @MaxLength(160)
  consentCollectedBy!: string;

  @IsArray()
  @ArrayMaxSize(1000, { message: 'A batch may contain at most 1000 rows' })
  @ValidateNested({ each: true })
  @Type(() => BulkRowDto)
  rows!: BulkRowDto[];
}

/** Shape of one line in an uploaded CSV after client-side parsing. */
export interface CsvRow {
  idNumber?: string;
  kraPin?: string;
  phoneNumber?: string;
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
}

/**
 * Minimal CSV parser: handles quoted fields, escaped quotes, CRLF.
 * First non-empty line must be a header row.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.some((c) => c.trim() !== '')) rows.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  record.push(field);
  if (record.some((c) => c.trim() !== '')) rows.push(record);

  if (rows.length < 2) return [];
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  id_number: 'idNumber',
  idnumber: 'idNumber',
  id: 'idNumber',
  national_id: 'idNumber',
  kra_pin: 'kraPin',
  krapin: 'kraPin',
  pin: 'kraPin',
  phone_number: 'phoneNumber',
  phonenumber: 'phoneNumber',
  phone: 'phoneNumber',
  msisdn: 'phoneNumber',
  alien_id: 'alienId',
  alienid: 'alienId',
  passport_number: 'passportNumber',
  passportnumber: 'passportNumber',
  passport: 'passportNumber',
  nationality: 'nationality',
  bank_code: 'bankCode',
  bankcode: 'bankCode',
  bank: 'bankCode',
  account_number: 'accountNumber',
  accountnumber: 'accountNumber',
  account: 'accountNumber',
  employer_name: 'employerName',
  employername: 'employerName',
  employer: 'employerName',
  meter_number: 'meterNumber',
  meternumber: 'meterNumber',
  meter: 'meterNumber',
  vehicle_reg_number: 'vehicleRegNumber',
  vehicleregnumber: 'vehicleRegNumber',
  vehicle_reg: 'vehicleRegNumber',
  dl_number: 'dlNumber',
  dlnumber: 'dlNumber',
  dl: 'dlNumber',
  drivers_license: 'dlNumber',
  business_reg_number: 'businessRegNumber',
  businessregnumber: 'businessRegNumber',
  business_reg: 'businessRegNumber',
  br_number: 'businessRegNumber',
};

/** Maps parsed CSV objects to verification inputs based on known headers. */
export function csvRowsToInputs(records: Record<string, string>[]): CsvRow[] {
  return records.map((rec) => {
    const row: CsvRow = {};
    for (const [header, value] of Object.entries(rec)) {
      const key = HEADER_ALIASES[header.toLowerCase().replace(/\s+/g, '_')];
      if (key && value) row[key] = value.replace(/\s+/g, '');
    }
    return row;
  });
}