import { test, expect, type Page } from '@playwright/test';

/**
 * M9: failing a quiz raises in-app notifications (quiz result + revision), the
 * bell badge reflects the unread count, and marking all read clears it.
 */

const PASSWORD = 'Academy-dev1';

async function registerFreshStudent(page: Page, stamp: string) {
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`Notif ${stamp}`);
  await page.getByLabel(/email/i).fill(`notif-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
}

test('failing a quiz raises notifications shown in the bell', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerFreshStudent(page, stamp);

  // Fresh account → no unread notifications.
  const bell = page.getByTestId('notification-bell');
  await expect(bell).toBeVisible();
  await expect(bell.getByText(/^[1-9]/)).toBeHidden();

  // Fail the first lesson's quiz (wrong answer, reflection blank → auto-fail).
  await page.getByRole('navigation').getByRole('link', { name: /curriculum/i }).click();
  await page.getByText('How a Computer Actually Works').first().click();
  await page.getByTestId('quiz-card').getByRole('button', { name: /start quiz/i }).click();
  await page.getByLabel(/stores a result back to disk/i).check();
  await page.getByLabel(/your predicted output/i).fill('0');
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /submit answers/i }).click();
  await expect(page.getByText(/not passed this time/i)).toBeVisible();

  // The bell badge shows unread notifications; open it and mark all read.
  await expect(bell.getByText(/[1-9]/)).toBeVisible();
  await bell.click();
  await expect(page.getByText(/quiz not passed/i)).toBeVisible();
  await page.getByRole('button', { name: /mark all read/i }).click();
  await expect(bell.getByText(/^[1-9]/)).toBeHidden();
});
