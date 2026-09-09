'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, FieldError, Input, Label } from '@fleek/ui';
import type { VerificationType } from '@fleek/types';
import { apiFetch } from '@/lib/auth';
import { DashboardIcon } from './dashboard-icons';
import {
  VERIFICATION_FORM_FIELDS,
  getVerificationFormValues,
  hasRequiredValues,
  isConsentGatingBlocked,
  type ProductOption,
  type VerificationFormValues,
} from '@/lib/verification-form';

export interface VerificationResultPayload {
  id: string;
  type: string;
  status: string;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  cost: number;
  latencyMs?: number | null;
  createdAt: string;
  source?: string;
  consent?: boolean;
  consentCollectedBy?: string | null;
  cbConsent?: boolean;
  isBackup?: boolean;
  backupAvailable?: boolean;
  backupPrice?: number;
}

export interface VerificationFormProps {
  product: ProductOption;
  token: string | null;
  onResult: (detail: VerificationResultPayload) => void;
  onError?: (message: string) => void;
  onPayload?: (payload: Record<string, unknown>) => void;
}

export function VerificationForm({ product, token, onResult, onError, onPayload }: VerificationFormProps) {
  const [values, setValues] = useState<VerificationFormValues>(() => getVerificationFormValues(product.type as VerificationType));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNotes, setFileNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(getVerificationFormValues(product.type as VerificationType));
    setError(null);
    setFileNotes({});
  }, [product.type]);

  const fields = useMemo(() => VERIFICATION_FORM_FIELDS[product.type as VerificationType] ?? [], [product.type]);
  const requiresCbConsent = product.cbConsentRequired;

  const canSubmit = useMemo(() => {
    if (!product.active || !product.enabled) return false;
    if (!hasRequiredValues(values, product.type as VerificationType)) return false;
    if (isConsentGatingBlocked(values, requiresCbConsent)) return false;
    return true;
  }, [product.active, product.enabled, product.type, requiresCbConsent, values]);

  function updateValue(key: keyof VerificationFormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value as string }));
  }

  function readFile(file: File, key: keyof VerificationFormValues) {
    const allowed = product.fileTypes.length ? product.fileTypes : ['image/jpeg', 'image/png', 'application/pdf'];
    const isAllowed = allowed.includes(file.type) || file.type.match(/^image\/(jpeg|png)$/) || file.type === 'application/pdf';
    if (!isAllowed) {
      const msg = 'Please choose a valid file type: ' + allowed.join(', ');
      setError(msg);
      onError?.(msg);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'File is too large. Please choose a file under 5 MB.';
      setError(msg);
      onError?.(msg);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValues((current) => ({ ...current, [key]: String(reader.result ?? '') }));
      setFileNotes((current) => ({ ...current, [key]: file.name }));
      setError(null);
    };
    reader.onerror = () => {
      const msg = 'Could not read that file. Please try again.';
      setError(msg);
      onError?.(msg);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasRequiredValues(values, product.type as VerificationType)) {
      const msg = 'Please complete the required fields before running this check.';
      setError(msg);
      onError?.(msg);
      return;
    }
    if (isConsentGatingBlocked(values, requiresCbConsent)) {
      const msg = requiresCbConsent
        ? 'Consent and credit bureau consent are required before running this check.'
        : 'Consent is required before running this check.';
      setError(msg);
      onError?.(msg);
      return;
    }
    if (!token) {
      const msg = 'Session expired. Please sign in again.';
      setError(msg);
      onError?.(msg);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Build payload matching RunVerificationDto — DTO fields must be sent even if empty
      const payload: Record<string, unknown> = {
        type: product.type,
        consent: values.consent === true,
        consentCollectedBy: 'console',
        cbConsent: values.cbConsent === true ? true : undefined,
        useBackup: false,
      };

      // Map form values to DTO fields; trim strings and coerce statementPages to number
      const dtoKeys: Array<keyof VerificationFormValues> = [
        'idNumber',
        'kraPin',
        'phoneNumber',
        'alienId',
        'passportNumber',
        'nationality',
        'bankCode',
        'accountNumber',
        'employerName',
        'meterNumber',
        'vehicleRegNumber',
        'dlNumber',
        'businessRegNumber',
        'faceImageBase64',
        'statementFileBase64',
      ];
      for (const key of dtoKeys) {
        const raw = values[key];
        if (typeof raw === 'string' && raw.trim() !== '') {
          payload[key] = raw.trim();
        }
      }
      if (values.statementPages && String(values.statementPages).trim() !== '') {
        const n = Number(String(values.statementPages).trim());
        if (Number.isFinite(n)) payload.statementPages = n;
      }

      // File uploads via JSON base64 (multipart also supported by API but base64 is deterministic in sandbox)
      // Never log PII or base64 payloads.
      onPayload?.(payload);

      const run = await apiFetch<{ id: string; status: string; backupAvailable?: boolean; backupPrice?: number }>(
        '/verifications',
        {
          method: 'POST',
          body: JSON.stringify(payload),
          token,
        },
      );

      // Fetch detail for structured evidence
      const detail = await apiFetch<VerificationResultPayload>(`/verifications/${run.id}`, { token });
      onResult(detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="verification-form-title"
      noValidate
    >
      <div className="space-y-5">
        {fields.map((field) => {
          const id = `verification-${String(field.key)}`;
          const hintId = `${id}-hint`;
          const fileNote = fileNotes[String(field.key)];
          const value = String(values[field.key] ?? '');

          return (
            <div key={String(field.key)}>
              <Label htmlFor={id}>
                {field.label}
                {field.required ? (
                  <span className="ml-1 text-red-600" aria-hidden="true">
                    *
                  </span>
                ) : null}
                {!field.required && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
              </Label>
              {field.inputType === 'file' ? (
                <div className="mt-1.5">
                  <input
                    id={id}
                    type="file"
                    accept={product.fileTypes.join(',') || undefined}
                    aria-describedby={hintId}
                    aria-required={field.required}
                    className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600 file:mr-3 file:rounded-md file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) readFile(file, field.key);
                    }}
                  />
                  {fileNote && <p className="mt-1 text-xs text-slate-500">Selected: {fileNote}</p>}
                </div>
              ) : field.inputType === 'number' ? (
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  required={field.required}
                  aria-describedby={hintId}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  type={field.inputType as 'search' | 'number' | 'tel' | 'text' | 'none' | 'email' | 'url' | 'decimal' | undefined}
                  inputMode={field.inputMode}
                  required={field.required}
                  aria-describedby={hintId}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                />
              )}
              <p id={hintId} className="mt-1 text-xs text-slate-500">
                {field.hint}
              </p>
            </div>
          );
        })}

        <fieldset className="rounded-lg bg-[#eef3f7] p-4">
          <legend className="sr-only">Consent</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              required
              checked={values.consent === true}
              onChange={(event) => updateValue('consent', event.target.checked ? true : (false as unknown as string))}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              aria-label="Confirm subject consent for this verification"
            />
            <span className="text-sm text-slate-700">
              I confirm that the subject has given explicit consent for this verification.
              <span className="ml-1 text-red-600" aria-hidden="true">
                *
              </span>
            </span>
          </label>
          {requiresCbConsent && (
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                required
                checked={values.cbConsent === true}
                onChange={(event) => updateValue('cbConsent', event.target.checked ? true : (false as unknown as string))}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                aria-label="Confirm credit bureau consent for this verification"
              />
              <span className="text-sm text-slate-700">
                Credit bureau consent is required for this product — the subject has authorized CRB and registry checks.
                <span className="ml-1 text-red-600" aria-hidden="true">
                  *
                </span>
              </span>
            </label>
          )}
        </fieldset>

        {error && (
          <div role="alert" aria-live="assertive">
            <FieldError>{error}</FieldError>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500" aria-live="polite">
            {product.unitPriceKes != null && product.active
              ? `Estimated charge KES ${Number(product.unitPriceKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })} per successful check · VAT exclusive`
              : product.active
                ? 'No charge until a check completes successfully'
                : 'Product unavailable — pricing not configured'}
            {product.backupAvailable && product.backupPriceKes != null && ` · backup KES ${Number(product.backupPriceKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
          </p>
          <Button
            type="submit"
            disabled={busy || !canSubmit}
            aria-busy={busy}
            className="h-11 min-h-11 transition-[transform,opacity,background-color] duration-200 motion-reduce:transition-none"
          >
            {busy ? (
              <>
                <DashboardIcon name="refresh" className="h-4 w-4 animate-spin" aria-hidden="true" /> Running check…
              </>
            ) : (
              <>
                <DashboardIcon name="search" className="h-4 w-4" aria-hidden="true" /> Run verification
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
