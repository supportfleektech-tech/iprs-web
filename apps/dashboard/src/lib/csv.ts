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
  faceImageBase64?: string;
  statementPages?: string;
  statementFileBase64?: string;
  cbConsent?: boolean;
  useBackup?: boolean;
}

/** Minimal quoted-CSV parser; first non-empty line must be a header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.some((c) => c.trim() !== '')) rows.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((c) => c.trim() !== '')) rows.push(record);

  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

const HEADER_ALIASEES: Record<string, keyof CsvRow> = {
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
  face_image_base64: 'faceImageBase64',
  faceimagebase64: 'faceImageBase64',
  statement_pages: 'statementPages',
  statementpages: 'statementPages',
  statement_file_base64: 'statementFileBase64',
  statementfilebase64: 'statementFileBase64',
  cb_consent: 'cbConsent',
  cbconsent: 'cbConsent',
  use_backup: 'useBackup',
  usebackup: 'useBackup',
};

export function csvRowsToInputs(records: Record<string, string>[]): CsvRow[] {
  return records.map((rec) => {
    const row: CsvRow = {};
    for (const [header, value] of Object.entries(rec)) {
      const key = HEADER_ALIASEES[header.toLowerCase().replace(/\s+/g, '_')] as
        keyof CsvRow | undefined;
      if (key && value) (row as Record<string, string>)[key] = value.replace(/\s+/g, '');
    }
    return row;
  });
}

/** Escapes and joins rows into a downloadable CSV string. */
export function toCsv(header: string[], dataRows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(esc).join(','), ...dataRows.map((r) => r.map(esc).join(','))].join('\n');
}
