import { test, expect, type Page } from '@playwright/test';

/**
 * The M1 golden path: a new learner registers, lands on the dashboard,
 * logs out, and logs back in. Each run uses a unique email, so the suite
 * is repeatable against the same database.
 */
const password = 'e2e-Passw0rd!';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function expectDashboard(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: new RegExp(`Welcome, ${name}`) })).toBeVisible();
}

test('register → dashboard → logout → login → dashboard', async ({ page }) => {
  const email = uniqueEmail();

  // Register
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill('E2E Learner');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expectDashboard(page, 'E2E Learner');

  // Session survives a full reload (refresh cookie + silent refresh).
  await page.reload();
  await expectDashboard(page, 'E2E Learner');

  // Logout
  await page.getByRole('button', { name: 'E2E Learner' }).click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // Protected route now redirects to login.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // Login again
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expectDashboard(page, 'E2E Learner');
});

test('rejects wrong credentials with a readable error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('nobody@example.com');
  await page.getByLabel(/password/i).fill('definitely-wrong-1');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('alert')).toContainText(/email or password is incorrect/i);
});

test('registration enforces the password policy client-side', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill('Weak Password');
  await page.getByLabel(/email/i).fill(uniqueEmail());
  await page.getByLabel(/password/i).fill('short');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
});
