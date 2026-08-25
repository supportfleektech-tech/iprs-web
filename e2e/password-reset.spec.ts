import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

/**
 * Password reset happy path (dev mode: API returns devResetToken so the
 * full flow is testable without an email inbox).
 */
test.describe.serial('password reset flow', () => {
  const email = `reset-e2e-${Date.now()}@fleek.test`;
  const oldPassword = 'OriginalPass1!';
  const newPassword = 'RotatedPass2!';

  let resetToken = '';

  test('register a throwaway account', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: {
        email,
        password: oldPassword,
        firstName: 'Reset',
        lastName: 'E2E',
        organizationName: 'Reset E2E Ltd',
      },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('forgot-password issues a dev token', async ({ request }) => {
    const res = await request.post(`${API}/auth/forgot-password`, { data: { email } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    resetToken = body.devResetToken ?? '';
    expect(resetToken).not.toBe('');
  });

  test('old password stops working, new one works in the UI', async ({ page }) => {
    await page.goto(`/reset-password?token=${resetToken}`);
    await page.getByLabel('New password (min 8 characters)').fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated')).toBeVisible({ timeout: 10_000 });

    // Old credential must now fail…
    const oldLogin = await page.request.post(`${API}/auth/login`, {
      data: { email, password: oldPassword },
    });
    expect(oldLogin.status()).toBe(401);

    // …and the new one signs in through the UI.
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/console/, { timeout: 15_000 });
  });
});
