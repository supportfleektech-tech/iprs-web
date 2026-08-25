import { VerificationType } from '@fleek/types';
import { MockProvider } from './mock.provider';
import type { VerificationProvider } from './provider';
import { ProviderError } from './provider';

/**
 * Routes each verification to the configured provider for that check.
 *
 * Live routing is per-type and credential-gated:
 *   - enabledTypes  → which checks exist at all
 *   - liveProvider  → optional real upstream (NRB/aggregator adapter)
 *   - liveTypes     → which checks route to the live upstream
 *
 * Individual checks can go live one at a time while the rest stay in
 * sandbox — configuration only, no code changes.
 */
export class ProviderRegistry {
  private readonly mockProvider = new MockProvider();

  constructor(
    private readonly enabledTypes: Set<VerificationType> = new Set(Object.values(VerificationType)),
    private readonly liveProvider: VerificationProvider | null = null,
    private readonly liveTypes: Set<VerificationType> = new Set(),
  ) {}

  resolve(type: VerificationType): VerificationProvider {
    if (!this.enabledTypes.has(type)) {
      throw new ProviderError('UNKNOWN', `Check "${type}" is not enabled on this deployment`);
    }
    if (this.liveProvider && this.liveTypes.has(type)) return this.liveProvider;
    return this.mockProvider;
  }

  isLive(type: VerificationType): boolean {
    return this.liveProvider != null && this.liveTypes.has(type);
  }

  isEnabled(type: VerificationType): boolean {
    return this.enabledTypes.has(type);
  }
}
