'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { parseCsv, csvRowsToInputs, toCsv, type CsvRow } from '@/lib/csv';
import { VerificationType, PRODUCT_LABELS, PRODUCT_CATEGORIES } from '@fleek/types';

interface BatchSummary {
  id: string;
  type: VerificationType;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  notFoundCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface BatchResultRow {
  subject: string;
  status: string;
  name: string;
  detail: string;
  cost: number;
}

const PRODUCT_HINTS: Record<VerificationType, { hint: string; cbRequired: boolean }> = {
  [VerificationType.IPRS_STANDARD]: { hint: 'id_number', cbRequired: false },
  [VerificationType.MATCH_ID_PHONE]: { hint: 'id_number, phone_number', cbRequired: false },
  [VerificationType.EMPLOYER_VERIFICATION]: { hint: 'id_number, employer_name', cbRequired: false },
  [VerificationType.FACE_ID_MATCH]: { hint: 'id_number, face_image_base64', cbRequired: false },
  [VerificationType.BANK_ACCOUNT_VERIFICATION]: {
    hint: 'account_number, bank_code, id_number',
    cbRequired: false,
  },
  [VerificationType.ALIEN_ID]: { hint: 'alien_id', cbRequired: false },
  [VerificationType.AML_PEP_SCREEN]: { hint: 'id_number', cbRequired: false },
  [VerificationType.PASSPORT_CHECK]: { hint: 'passport_number, nationality', cbRequired: false },
  [VerificationType.SIM_SWAP_CHECK]: { hint: 'phone_number', cbRequired: false },
  [VerificationType.KPLC_LOCATION_CHECKER]: { hint: 'meter_number', cbRequired: false },
  [VerificationType.KRA_PIN_VERIFICATION]: { hint: 'kra_pin, id_number', cbRequired: false },
  [VerificationType.SEARCH_NAME_BY_PHONE]: { hint: 'phone_number', cbRequired: false },
  [VerificationType.SEARCH_PHONES_BY_ID]: { hint: 'id_number', cbRequired: false },
  [VerificationType.MOTOR_VEHICLE_OWNERSHIP]: { hint: 'vehicle_reg_number', cbRequired: true },
  [VerificationType.DRIVERS_LICENSE_VERIFICATION]: { hint: 'dl_number', cbRequired: false },
  [VerificationType.METROPOL_SCORE_ONLY]: { hint: 'id_number', cbRequired: true },
  [VerificationType.METROPOL_STANDARD_REPORT]: { hint: 'id_number', cbRequired: true },
  [VerificationType.METROPOL_FULL_REPORT]: { hint: 'id_number', cbRequired: true },
  [VerificationType.CREDITINFO_SCORE_ONLY]: { hint: 'id_number', cbRequired: true },
  [VerificationType.CREDITINFO_COMPREHENSIVE]: { hint: 'id_number', cbRequired: true },
  [VerificationType.CREDITINFO_CRB_STATUS]: { hint: 'id_number', cbRequired: true },
  [VerificationType.BRS]: { hint: 'business_reg_number', cbRequired: true },
  [VerificationType.SPIN_SCORE_ONLY]: { hint: 'id_number', cbRequired: true },
  [VerificationType.SCANNED_STATEMENT]: {
    hint: 'statement_pages, statement_file_base64',
    cbRequired: false,
  },
};

export default function BulkPage() {
  const { token } = useAuth();
  const [type, setType] = useState<VerificationType>(VerificationType.IPRS_STANDARD);
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchSummary | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBatches = useCallback(async () => {
    if (!token) return;
    setBatches(await apiFetch<BatchSummary[]>('/verifications/batches', { token }));
  }, [token]);

  useEffect(() => {
    void loadBatches().catch(() => undefined);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadBatches]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setRows(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) {
      setParseError('File too large (max 2 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = parseCsv(String(reader.result ?? ''));
        const inputs = csvRowsToInputs(records).filter(
          (r) =>
            r.idNumber ||
            r.phoneNumber ||
            r.kraPin ||
            r.alienId ||
            r.passportNumber ||
            r.meterNumber ||
            r.vehicleRegNumber ||
            r.dlNumber ||
            r.businessRegNumber,
        );
        if (inputs.length === 0)
          throw new Error('No usable rows found — include a header like id_number or phone_number');
        if (inputs.length > 1000)
          throw new Error(`Too many rows (${inputs.length}) — max is 1000 per batch`);
        setRows(inputs);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Could not parse CSV');
      }
    };
    reader.readAsText(file);
  }

  async function startBatch() {
    if (!rows) return;
    setError(null);
    try {
      const summary = await apiFetch<BatchSummary>('/verifications/batches', {
        method: 'POST',
        body: JSON.stringify({ type, consentCollectedBy: 'Fleek IPRS Console (bulk)', rows }),
        token,
      });
      setActiveBatch(summary);
      setRows(null);
      setFileName('');
      // Poll until the batch finishes
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await apiFetch<BatchSummary>(`/verifications/batches/${summary.id}`, { token });
        setActiveBatch(s);
        if (s.status !== 'processing') {
          if (pollRef.current) clearInterval(pollRef.current);
          void loadBatches();
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch');
    }
  }

  async function downloadResults(batchId: string) {
    const results = await apiFetch<BatchResultRow[]>(`/verifications/batches/${batchId}/results`, {
      token,
    });
    const csv = toCsv(
      ['subject', 'status', 'name', 'detail', 'cost_kes'],
      results.map((r) => [r.subject, r.status, r.name, r.detail, r.cost]),
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batchId.slice(-8)}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hint = PRODUCT_HINTS[type];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Bulk verification</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload a CSV of up to 1,000 rows. Include a header row with the required columns for your
        selected product.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>New batch</CardTitle>
          <CardDescription>
            Every row is billed individually; inconclusive lookups are free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Product</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as VerificationType)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm cursor-pointer"
              >
                {Object.entries(PRODUCT_CATEGORIES).map(([category, types]) => (
                  <optgroup key={category} label={category}>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {PRODUCT_LABELS[t]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:text-white hover:file:bg-navy-800"
              />
            </div>
          </div>

          {parseError && <p className="mt-3 text-xs text-red-500">{parseError}</p>}
          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

          {!rows && !parseError && (
            <p className="mt-4 text-xs text-slate-400">
              Expected columns for this product: <strong>{hint.hint}</strong>
              {hint.cbRequired && (
                <span className="ml-2 text-amber-600">(CB consent required per row)</span>
              )}
            </p>
          )}

          {rows && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-brand/5 border border-teal-brand/30 px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span> — {rows.length.toLocaleString()}{' '}
                rows
              </div>
              <Button onClick={() => void startBatch()}>Start batch</Button>
            </div>
          )}

          {activeBatch && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Batch …{activeBatch.id.slice(-8)}{' '}
                  <Badge
                    tone={
                      activeBatch.status === 'completed'
                        ? 'green'
                        : activeBatch.status === 'failed'
                          ? 'red'
                          : 'blue'
                    }
                  >
                    {activeBatch.status}
                  </Badge>
                </span>
                <span className="text-slate-400">
                  {activeBatch.processedRows}/{activeBatch.totalRows} processed
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-teal-brand transition-all duration-500"
                  style={{
                    width: `${Math.round((activeBatch.processedRows / Math.max(activeBatch.totalRows, 1)) * 100)}%`,
                  }}
                />
              </div>
              {activeBatch.status === 'processing' && (
                <p className="mt-2 text-xs text-slate-400">
                  Processing… you can leave this page and check history later.
                </p>
              )}
              {activeBatch.status === 'completed' && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    ✓ {activeBatch.successCount} verified · ⚠ {activeBatch.notFoundCount} not found
                    · ✕ {activeBatch.failedCount} failed
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void downloadResults(activeBatch.id)}
                  >
                    Download results CSV
                  </Button>
                </div>
              )}
              {activeBatch.errorMessage && (
                <p className="mt-2 text-xs text-red-500">{activeBatch.errorMessage}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Past batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No batches yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Batch</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Rows</th>
                  <th className="pb-2 text-right">✓ / ⚠ / ✕</th>
                  <th className="pb-2 text-right">When</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-mono text-xs">…{b.id.slice(-8)}</td>
                    <td className="py-2.5">{PRODUCT_LABELS[b.type] ?? b.type}</td>
                    <td className="py-2.5 text-right">{b.totalRows}</td>
                    <td className="py-2.5 text-right">
                      {b.successCount} / {b.notFoundCount} / {b.failedCount}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      {b.status === 'completed' && (
                        <button
                          onClick={() => void downloadResults(b.id)}
                          className="cursor-pointer text-xs text-teal-brand hover:underline"
                        >
                          Results CSV
                        </button>
                      )}
                      {b.status === 'processing' && (
                        <Link href="/console/bulk" className="text-xs text-slate-400">
                          running…
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
