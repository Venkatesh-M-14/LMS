import { test, expect, type Page } from '@playwright/test';

/**
 * M7 golden path: passing a quiz awards XP, unlocks achievements, moves the
 * dashboard stats and the leaderboard. A fresh student keeps the numbers
 * deterministic.
 */

const PASSWORD = 'Academy-dev1';

async function registerFreshStudent(page: Page, stamp: string): Promise<string> {
  const name = `Gamer ${stamp}`;
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(name);
  await page.getByLabel(/email/i).fill(`game-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
  return name;
}

test('passing a quiz earns XP, unlocks achievements, and updates the leaderboard', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = await registerFreshStudent(page, stamp);

  // New account: zero XP on the dashboard.
  await expect(page.getByTestId('dashboard-stats')).toBeVisible();
  await expect(page.getByTestId('dashboard-stats').getByText(/^0$/).first()).toBeVisible();

  // Pass the first lesson's quiz (auto-graded answers clear the 65% mark).
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByText('How a Computer Actually Works').click();
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz/i })
    .click();
  await page.getByLabel(/reads the next instruction/i).check();
  await page.getByLabel(/instructions and data live in the same memory/i).check();
  await page.getByLabel(/code can be treated as data/i).check();
  await page.getByLabel(/running untrusted code is dangerous/i).check();
  await page.getByLabel(/your predicted output/i).fill('16');
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();
  await expect(page.getByText(/you passed/i)).toBeVisible();

  // Dashboard now shows earned XP (30 quiz + 20 lesson + 25 achievements = 75).
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /dashboard/i })
    .click();
  await expect(page.getByTestId('dashboard-stats').getByText('75').first()).toBeVisible();

  // Achievements: First Steps and Quiz Taker are unlocked.
  await page.getByRole('button', { name: name }).click();
  await page.getByRole('menuitem', { name: /achievements/i }).click();
  await expect(page.getByRole('heading', { name: /achievements/i })).toBeVisible();
  const firstSteps = page.getByTestId('achievement-first-steps');
  const quizTaker = page.getByTestId('achievement-quiz-taker');
  await expect(firstSteps.getByText('Earned', { exact: true }).first()).toBeVisible();
  await expect(quizTaker.getByText('Earned', { exact: true }).first()).toBeVisible();
  // A streak-based one stays locked.
  await expect(page.getByTestId('achievement-dedicated').getByText('Locked')).toBeVisible();

  // Leaderboard lists this learner with their XP.
  await page.getByRole('button', { name: name }).click();
  await page.getByRole('menuitem', { name: /leaderboard/i }).click();
  const myRow = page.getByRole('row').filter({ hasText: name });
  await expect(myRow).toBeVisible();
  await expect(myRow.getByText(/75 XP/)).toBeVisible();
  await expect(myRow.getByText(/You/)).toBeVisible();
});

test('an unknown certificate code shows an invalid-verification page (public)', async ({
  page,
}) => {
  // No login — the verification route is public.
  await page.goto('/verify/00000000-0000-0000-0000-000000000000');
  await expect(page.getByTestId('verify-invalid')).toBeVisible();
  await expect(page.getByText(/certificate not found/i)).toBeVisible();
});
