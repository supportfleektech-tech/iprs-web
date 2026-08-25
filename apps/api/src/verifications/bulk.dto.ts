import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { VerificationType } from '@fleek/types';

export class BulkRowDto {
  @IsOptional() @IsNumberString({}, { message: 'idNumber must be digits' })
  idNumber?: string;

  @IsOptional() @IsString()
  kraPin?: string;

  @IsOptional() @IsString()
  phoneNumber?: string;
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
