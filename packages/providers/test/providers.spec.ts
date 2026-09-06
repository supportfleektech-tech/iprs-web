import { describe, it, expect, vi } from 'vitest';
import { VerificationType } from '@fleek/types';
import { MockProvider } from '../src/mock.provider';
import { AggregatorAdapter } from '../src/aggregator.adapter';
import { ProviderError } from '../src/provider';
import { ProviderRegistry } from '../src/registry';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('returns deterministic IPRS Standard results for the same ID', async () => {
    const a = await provider.iprsStandardLookup('12345678');
    const b = await provider.iprsStandardLookup('12345678');
    expect(a.fullName).toBe(b.fullName);
    expect(a.idNumber).toBe('12345678');
    expect(a.fullName).toMatch(/^[A-Za-z]+ [A-Za-z]+ [A-Za-z]+$/);
  });

  it('rejects malformed ID numbers', async () => {
    await expect(provider.iprsStandardLookup('abc')).rejects.toThrow(ProviderError);
  });

  it('validates KRA PIN format', async () => {
    const res = await provider.kraPinCheck({ kraPin: 'A012345678Z' });
    expect(res.status).toBe('active');
    await expect(provider.kraPinCheck({ kraPin: 'nope' })).rejects.toThrow(ProviderError);
  });

  it('normalizes Kenyan phone numbers', async () => {
    const res = await provider.searchNameByPhone('0712345678');
    expect(res.ownerName.length).toBeGreaterThan(3);
    expect(res.phoneNumber).toMatch(/^\+2547/);
  });

  it('classifies sim swap risk', async () => {
    const res = await provider.simSwapCheck('+254711000111');
    expect(['low', 'medium', 'high']).toContain(res.riskLevel);
  });
});

describe('ProviderRegistry', () => {
  it('blocks disabled check types with only IPRS_STANDARD enabled', () => {
    const enabled = new Set<VerificationType>([VerificationType.IPRS_STANDARD]);
    const registry = new ProviderRegistry(enabled);
    expect(registry.isEnabled(VerificationType.KRA_PIN_VERIFICATION)).toBe(false);
    expect(() => registry.resolve(VerificationType.KRA_PIN_VERIFICATION)).toThrow(/not enabled/);
    expect(registry.resolve(VerificationType.IPRS_STANDARD)).toBeDefined();
  });

  it('routes IPRS_STANDARD to mock by default', async () => {
    const registry = new ProviderRegistry(new Set<VerificationType>([VerificationType.IPRS_STANDARD]));
    const result = await registry.resolve(VerificationType.IPRS_STANDARD);
    expect(result.iprsStandardLookup('12345678')).resolves.toBeDefined();
  });
});