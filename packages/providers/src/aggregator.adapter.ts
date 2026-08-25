import type {
  IprsResult,
  KraResult,
  PhoneResult,
  SimSwapResult,
  VerificationType,
} from '@fleek/types';
import { ProviderError } from './provider';
import type { KraInput, PhoneInput, VerificationProvider } from './provider';

export interface AggregatorConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

/**
 * Adapter for a generic HTTP verification aggregator.
 *
 * Expected upstream contract (configure your aggregator to match, or adapt
 * the mapping methods below to its actual shapes):
 *
 *   Authorization: Bearer <apiKey>
 *   POST {base}/iprs      {"idNumber": "12345678"}          → IprsResult
 *   POST {base}/kra       {"kraPin"?: string,"idNumber"?}   → KraResult
 *   POST {base}/phone     {"phoneNumber"?,"idNumber"?}      → PhoneResult
 *   POST {base}/sim-swap  {"phoneNumber": "07…"}            → SimSwapResult
 *
 * Non-200 responses and 404s map to ProviderError codes so the platform
 * billing rules (only conclusive results are billed) keep working unchanged.
 */
export class AggregatorAdapter implements VerificationProvider {
  readonly name: string;
  readonly sandbox = false;
  readonly supported: VerificationType[] = [
    'iprs_id',
    'kra_pin',
    'phone_ownership',
    'sim_swap',
  ] as VerificationType[];

  constructor(
    private readonly cfg: AggregatorConfig,
    name = 'aggregator',
  ) {
    this.name = name;
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
  }

  private readonly timeoutMs: number;

  private async call<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 404) {
        throw new ProviderError('NOT_FOUND', `No record found at ${path}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError('UPSTREAM_DOWN', 'Upstream rejected our API key');
      }
      if (!res.ok) {
        throw new ProviderError('UPSTREAM_DOWN', `Upstream error ${res.status} from ${path}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        err instanceof Error && err.name === 'AbortError' ? 'UPSTREAM_DOWN' : 'UNKNOWN',
        `Upstream call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async iprsIdLookup(idNumber: string): Promise<IprsResult> {
    return this.call<IprsResult>('/iprs', { idNumber });
  }

  async kraPinCheck(input: KraInput): Promise<KraResult> {
    return this.call<KraResult>('/kra', { kraPin: input.kraPin, idNumber: input.idNumber });
  }

  async phoneOwnership(input: PhoneInput): Promise<PhoneResult> {
    return this.call<PhoneResult>('/phone', {
      phoneNumber: input.phoneNumber,
      idNumber: input.idNumber,
    });
  }

  async simSwapCheck(phoneNumber: string): Promise<SimSwapResult> {
    return this.call<SimSwapResult>('/sim-swap', { phoneNumber });
  }
}
