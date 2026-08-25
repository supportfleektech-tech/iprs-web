import { describe, it, expect } from 'vitest';
import { VerificationType, type IprsResult } from '@fleek/types';
import { MockProvider } from '../src/mock.provider';
import { ProviderRegistry, ProviderError } from '../src/registry';

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('returns deterministic IPRS results for the same ID', async () => {
    const a = await provider.iprsIdLookup('12345678');
    const b = await provider.iprsIdLookup('12345678');
    expect((a as IprsResult).fullName).toBe((b as IprsResult).fullName);
    expect(a.idNumber).toBe('12345678');
    expect(a.fullName).toMatch(/^[A-Za-z]+ [A-Za-z]+ [A-Za-z]+$/);
  });

  it('rejects malformed ID numbers', async () => {
    await expect(provider.iprsIdLookup('abc')).rejects.toThrow(ProviderError);
  });

  it('validates KRA PIN format', async () => {
    const res = await provider.kraPinCheck({ kraPin: 'A012345678Z' });
    expect(res.status).toBe('active');
    await expect(provider.kraPinCheck({ kraPin: 'nope' })).rejects.toThrow(ProviderError);
  });

  it('normalizes Kenyan phone numbers', async () => {
    const res = await provider.phoneOwnership({ phoneNumber: '0712345678' });
    expect(res.registeredNumbers[0]).toMatch(/^\+2547/);
    expect(res.ownerName.length).toBeGreaterThan(3);
  });

  it('classifies sim swap risk', async () => {
    const res = await provider.simSwapCheck('+254711000111');
    expect(['low', 'medium', 'high']).toContain(res.riskLevel);
  });
});

describe('ProviderRegistry', () => {
  it('blocks disabled check types', () => {
    const registry = new ProviderRegistry(new Set([VerificationType.IPRS_ID]));
    expect(registry.isEnabled(VerificationType.KRA_PIN)).toBe(false);
    expect(() => registry.resolve(VerificationType.KRA_PIN)).toThrow(/not enabled/);
    expect(registry.resolve(VerificationType.IPRS_ID)).toBeDefined();
  });
});
