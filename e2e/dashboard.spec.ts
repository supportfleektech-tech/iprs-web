import { test, expect } from '@playwright/test';

/**
 * Happy path against locally running services:
 *   api       :4000  (start via scripts/start-api.sh)
 *   dashboard :3001  (scripts/start-dashboard.sh)
 */
test.describe.serial('dashboard happy path', () => {
  const email = `e2e-${Date.now()}@fleek.test`;
  const password = 'E2ePassword123!';

  test('register -> verify IPRS ID -> see result', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('Organization name').fill('E2E Org Ltd');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel(/Password/).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/console/, { timeout: 15_000 });

    // Run an IPRS verification
    await page.getByLabel('National ID number').fill('12345678');
    await page.getByRole('button', { name: 'Verify now' }).click();
    await expect(page.getByText('SUCCESS')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Full name')).toBeVisible();
    await expect(page.getByText(/Cost KES \d+/)).toBeVisible();
  });

  test('login with the new account works', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/console/, { timeout: 15_000 });
  });
});
