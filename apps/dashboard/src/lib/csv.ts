export interface CsvRow {
  idNumber?: string;
  kraPin?: string;
  phoneNumber?: string;
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

/** Escapes and joins rows into a downloadable CSV string. */
export function toCsv(header: string[], dataRows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(esc).join(','), ...dataRows.map((r) => r.map(esc).join(','))].join('\n');
}
