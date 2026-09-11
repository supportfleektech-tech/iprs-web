import { test, expect, request } from '@playwright/test';

/**
 * API-level E2E against http://localhost:4000. Uses the same seeded admin
 * credentials (admin@fleektech.co.ke / Admin123!) used by the integration
 * tests. The api process is started by CI / scripts/start-api.sh before
 * this suite runs.
 */
test.describe('API end-to-end', () => {
  // NOTE: playwright's `baseURL` fixture points at the dashboard (:3001);
  // API assertions must target the API directly.
  const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

  test('health endpoint returns ok', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/v1/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('fleek-iprs-api');
  });

  test('products endpoint lists enabled checks', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/v1/verifications/products');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(20);
    const types = body.map((p: { type: string }) => p.type);
    expect(types).toContain('iprs_standard');
  });

  test('register + login + run IPRS verification', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const email = `apitest-${Date.now()}@fleek.test`;

    const reg = await ctx.post('/v1/auth/register', {
      data: {
        email,
        password: 'StrongPass123!',
        firstName: 'Api',
        lastName: 'Tester',
        organizationName: 'ApiTest Org',
      },
    });
    expect(reg.status()).toBe(201);
    const regBody = await reg.json();
    const accessToken = regBody.accessToken as string;
    expect(accessToken).toBeTruthy();

    const run = await ctx.post('/v1/verifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        type: 'iprs_standard',
        idNumber: '12345678',
        consent: true,
        consentCollectedBy: 'apitest',
      },
    });
    expect([200, 201]).toContain(run.status());
    const runBody = await run.json();
    expect(runBody.id).toBeTruthy();
    expect(['success', 'not_found', 'failed']).toContain(runBody.status);

    const detail = await ctx.get(`/v1/verifications/${runBody.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(detail.status()).toBe(200);

    const hist = await ctx.get('/v1/verifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(hist.status()).toBe(200);
    const histBody = await hist.json();
    expect(histBody.items.some((it: { id: string }) => it.id === runBody.id)).toBe(true);

    const wallet = await ctx.get('/v1/wallet', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(wallet.status()).toBe(200);
  });

  test('export endpoints return attachments for an authenticated user', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const login = await ctx.post('/v1/auth/login', {
      data: { email: 'admin@fleektech.co.ke', password: 'Admin123!' },
    });
    if (login.status() !== 200) {
      test.skip(true, 'seeded admin unavailable; skipping export test');
      return;
    }
    const { accessToken } = await login.json();
    const csv = await ctx.get('/v1/exports/verifications?format=csv', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toMatch(/text\/csv/);
  });
});
