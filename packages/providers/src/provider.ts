import type { VerificationType } from '@fleek/types';

export interface KraInput {
  kraPin?: string;
  idNumber?: string;
}

export interface PhoneInput {
  phoneNumber?: string;
  idNumber?: string;
}

/**
 * Contract every upstream data source must fulfil.
 * v1 ships a MockProvider; real adapters (NRB direct / aggregators)
 * implement this same interface behind feature flags.
 */
export interface VerificationProvider {
  readonly name: string;
  readonly sandbox: boolean;
  iprsIdLookup(idNumber: string): Promise<import('@fleek/types').IprsResult>;
  kraPinCheck(input: KraInput): Promise<import('@fleek/types').KraResult>;
  phoneOwnership(input: PhoneInput): Promise<import('@fleek/types').PhoneResult>;
  simSwapCheck(phoneNumber: string): Promise<import('@fleek/types').SimSwapResult>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'UPSTREAM_DOWN' | 'INVALID_INPUT' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function assertSupported(type: VerificationType, supported: VerificationType[]): void {
  if (!supported.includes(type)) {
    throw new ProviderError('INVALID_INPUT', `Provider does not support check type "${type}"`);
  }
}

export type { VerificationType };
