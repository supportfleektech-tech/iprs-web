import { describe, it, expect, vi } from 'vitest';
import { VerificationType, type IprsResult } from '@fleek/types';
import { MockProvider } from '../src/mock.provider';
import { AggregatorAdapter } from '../src/aggregator.adapter';
import { ProviderError } from '../src/provider';
import { ProviderRegistry } from '../src/registry';

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

  it('routes only configured types to the live upstream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ idNumber: '12345678', fullName: 'TEST USER' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const live = new AggregatorAdapter({ baseUrl: 'https://upstream.example', apiKey: 'k' });
      const registry = new ProviderRegistry(
        new Set(Object.values(VerificationType)),
        live,
        new Set([VerificationType.IPRS_ID]), // only IPRS is live
      );

      expect(registry.isLive(VerificationType.IPRS_ID)).toBe(true);
      expect(registry.isLive(VerificationType.KRA_PIN)).toBe(false);

      await registry.resolve(VerificationType.IPRS_ID).iprsIdLookup('12345678');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // KRA still resolves to the mock — no upstream call
      const kra = await registry.resolve(VerificationType.KRA_PIN).kraPinCheck({ kraPin: 'A012345678Z' });
      expect(kra.status).toBe('active');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps upstream 404 to NOT_FOUND and non-200 to UPSTREAM_DOWN', async () => {
    const responses = [new Response('{}', { status: 404 }), new Response('{}', { status: 500 })];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(responses.shift()!)));
    try {
      const adapter = new AggregatorAdapter({ baseUrl: 'https://upstream.example', apiKey: 'k' });
      await expect(adapter.iprsIdLookup('00000000')).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(adapter.iprsIdLookup('11111111')).rejects.toMatchObject({ code: 'UPSTREAM_DOWN' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
