import { VerificationType } from '@fleek/types';
import { MockProvider } from './mock.provider';
import type { VerificationProvider } from './provider';
import { ProviderError } from './provider';

export * from './provider';
export * from './mock.provider';

/**
 * Routes each verification to the configured provider for that check.
 * Per-product enable flags let individual checks go live independently.
 */
export class ProviderRegistry {
  private readonly liveProvider: VerificationProvider;

  constructor(
    private readonly enabledTypes: Set<VerificationType> = new Set(Object.values(VerificationType)),
    private readonly useLiveUpstream = false,
    live?: VerificationProvider,
  ) {
    // v1: no real upstream exists — everything routes through MockProvider.
    // When an NRB/aggregator adapter lands, register it here behind
    // useLiveUpstream + per-type flags.
    this.liveProvider = live ?? new MockProvider();
    void this.useLiveUpstream;
  }

  resolve(type: VerificationType): VerificationProvider {
    if (!this.enabledTypes.has(type)) {
      throw new ProviderError('UNKNOWN', `Check "${type}" is not enabled on this deployment`);
    }
    return this.liveProvider;
  }

  isEnabled(type: VerificationType): boolean {
    return this.enabledTypes.has(type);
  }
}
