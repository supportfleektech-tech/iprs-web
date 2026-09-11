import { VerificationType } from '@fleek/types';
import { MockProvider } from './mock.provider';
import type { VerificationProvider } from './provider';
import { ProviderError } from './provider';

/**
 * Routes each verification to the configured provider for that check.
 *
 * Live routing is per-type and credential-gated:
 *   - enabledTypes    → which checks exist at all
 *   - primaryProvider → main real upstream (NRB/aggregator adapter)
 *   - backupProvider  → optional fallback upstream
 *   - liveTypes       → which checks route to the primary live upstream
 *   - backupTypes     → which checks have backup available
 *
 * Individual checks can go live one at a time while the rest stay in
 * sandbox — configuration only, no code changes.
 */
export class ProviderRegistry {
  private readonly mockProvider = new MockProvider();

  constructor(
    private readonly enabledTypes: Set<VerificationType> = new Set(Object.values(VerificationType)),
    private readonly primaryProvider: VerificationProvider | null = null,
    private readonly backupProvider: VerificationProvider | null = null,
    private readonly liveTypes: Set<VerificationType> = new Set(),
    private readonly backupTypes: Set<VerificationType> = new Set(),
  ) {}

  /**
   * Get the primary provider for a type (live if enabled, else mock)
   */
  resolve(type: VerificationType, useBackup = false): VerificationProvider {
    if (!this.enabledTypes.has(type)) {
      throw new ProviderError('UNKNOWN', `Check "${type}" is not enabled on this deployment`);
    }
    if (useBackup && this.backupProvider && this.backupTypes.has(type)) {
      return this.backupProvider;
    }
    if (this.primaryProvider && this.liveTypes.has(type)) return this.primaryProvider;
    return this.mockProvider;
  }

  /**
   * Check if a type is enabled at all
   */
  isEnabled(type: VerificationType): boolean {
    return this.enabledTypes.has(type);
  }

  /**
   * Check if a type is routed to the live primary provider
   */
  isLive(type: VerificationType): boolean {
    return this.primaryProvider != null && this.liveTypes.has(type);
  }

  /**
   * Check if backup is available for a type
   */
  hasBackup(type: VerificationType): boolean {
    return this.backupProvider != null && this.backupTypes.has(type);
  }

  /**
   * Get backup provider for a type (returns null if not available)
   */
  getBackupProvider(type: VerificationType): VerificationProvider | null {
    if (this.backupProvider && this.backupTypes.has(type)) {
      return this.backupProvider;
    }
    return null;
  }
}
