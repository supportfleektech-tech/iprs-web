import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

test.describe('public endpoints', () => {
  test('health check returns ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('fleek-iprs-api');
  });

  test('contact form rejects empty payloads with 400', async ({ request }) => {
    const res = await request.post(`${API}/contact`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('contact form accepts a valid submission', async ({ request }) => {
    const res = await request.post(`${API}/contact`, {
      data: {
        name: 'E2E tester',
        email: 'contact-e2e@fleek.test',
        company: 'Fleektech',
        message: 'Automated test from the IPRS-WEB CI suite — please ignore.',
      },
    });
    expect(res.status()).toBe(201);
  });
});
