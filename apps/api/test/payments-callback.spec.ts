import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * Mirrors the signature verifier embedded in payments.controller.ts. We
 * re-declare it here (private function, not exported) so we can pin the
 * Stripe-style `t=<unix>,v1=<hex>` contract.
 */
function verifyDarajaSignature(
  rawBody: string,
  header: string | undefined,
  secret: string | undefined,
  nowMs: number,
): { ok: true } | { ok: false; reason: string } {
  const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;
  if (!secret) return { ok: true };
  if (!header) return { ok: false, reason: 'missing signature header' };
  const parts = header.split(',').reduce<Record<string, string>>((acc, kv) => {
    const i = kv.indexOf('=');
    if (i > 0) acc[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    return acc;
  }, {});
  const tsRaw = parts['t'];
  const v1 = parts['v1'];
  if (!tsRaw || !v1) return { ok: false, reason: 'malformed signature header' };
  const tsSec = Number(tsRaw);
  if (!Number.isFinite(tsSec)) return { ok: false, reason: 'invalid signature timestamp' };
  if (Math.abs(nowMs - tsSec * 1000) > SIGNATURE_MAX_SKEW_MS)
    return { ok: false, reason: 'signature expired' };
  const expected = createHmac('sha256', secret)
    .update(`${tsRaw}.`)
    .update(rawBody, 'utf8')
    .digest('hex');
  if (expected.length !== v1.length) return { ok: false, reason: 'signature length mismatch' };
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i]! ^ b[i]!;
  return mismatch === 0 ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

function sign(secret: string, body: string, ts: number): string {
  const hex = createHmac('sha256', secret).update(`${ts}.`).update(body, 'utf8').digest('hex');
  return `t=${ts},v1=${hex}`;
}

describe('Daraja callback HMAC verification', () => {
  const secret = 'super-secret';
  const body = '{"Body":{"stkCallback":{"CheckoutRequestID":"ws_CO_123","ResultCode":0}}}';
  const now = 1_700_000_000_000;

  it('accepts a valid signature within skew', () => {
    const header = sign(secret, body, Math.floor(now / 1000));
    expect(verifyDarajaSignature(body, header, secret, now)).toEqual({ ok: true });
  });

  it('rejects a missing header', () => {
    const result = verifyDarajaSignature(body, undefined, secret, now);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyDarajaSignature(body, 'foo=bar', secret, now).ok).toBe(false);
  });

  it('rejects a tampered body', () => {
    const header = sign(secret, body, Math.floor(now / 1000));
    const tampered = body.replace('ResultCode":0', 'ResultCode":1');
    expect(verifyDarajaSignature(tampered, header, secret, now).ok).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    const oldTs = Math.floor((now - 10 * 60 * 1000) / 1000);
    const header = sign(secret, body, oldTs);
    expect(verifyDarajaSignature(body, header, secret, now).ok).toBe(false);
  });

  it('skips verification when secret is unset (sandbox)', () => {
    expect(verifyDarajaSignature(body, undefined, undefined, now)).toEqual({ ok: true });
  });
});
