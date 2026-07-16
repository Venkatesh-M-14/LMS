import { test, expect, type Page } from '@playwright/test';

/**
 * M4 golden path: prerequisite gating end-to-end. A fresh student sees only
 * the first lesson unlocked; passing its quiz unlocks the second — in the UI
 * AND at the API (direct URL access).
 */

const PASSWORD = 'Academy-dev1';

async function registerFreshStudent(page: Page, stamp: string) {
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`Gate Tester ${stamp}`);
  await page.getByLabel(/email/i).fill(`gate-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
}

test('fresh student: only lesson 1 unlocked; passing its quiz unlocks lesson 2', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerFreshStudent(page, stamp);

  // Curriculum: lesson 1 available, lesson 2 locked (disabled + hint).
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  const lesson1 = page.getByRole('link', { name: /how a computer actually works/i });
  const lesson2 = page.getByRole('link', { name: /bits, bytes, and binary/i });
  await expect(lesson1).toBeVisible();
  await expect(lesson2).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/complete the previous lessons to unlock/i).first()).toBeVisible();

  // Server-side enforcement: direct URL access to the locked lesson is refused.
  const lockedHref = await lesson2.getAttribute('href');
  expect(lockedHref).toBeTruthy();
  await page.goto(lockedHref!);
  await expect(page.getByText(/this lesson is locked/i)).toBeVisible();

  // Pass lesson 1's quiz using only auto-graded answers (threshold 65%).
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await lesson1.click();
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz/i })
    .click();
  await page.getByLabel(/reads the next instruction/i).check();
  await page.getByLabel(/instructions and data live in the same memory/i).check();
  await page.getByLabel(/code can be treated as data/i).check();
  await page.getByLabel(/running untrusted code is dangerous/i).check();
  await page.getByLabel(/your predicted output/i).fill('16');
  // Reflection intentionally left empty → auto-gradable score 8/12 = 66.7%.
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();
  await expect(page.getByText(/you passed/i)).toBeVisible();

  // Lesson 2 is now unlocked in the UI…
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await expect(lesson1.getByText(/how a computer actually works/i)).toBeVisible();
  await expect(lesson2).not.toHaveAttribute('aria-disabled', 'true');

  // …and at the API: the previously refused URL now serves content.
  await page.goto(lockedHref!);
  await expect(
    page.getByRole('heading', { name: /bits, bytes, and binary/i, level: 1 }).first(),
  ).toBeVisible();

  // Progress is visible on the dashboard.
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /dashboard/i })
    .click();
  await expect(page.getByText(/1\/\d+ lessons/)).toBeVisible();
  await expect(page.getByRole('link', { name: /continue/i })).toBeVisible();
});

test('instructors bypass gating', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('instructor@academy.local');
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  // A deep lesson (topic 2) opens directly for instructors.
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByText('Meet the Command Line').click();
  await expect(
    page.getByRole('heading', { name: /meet the command line/i, level: 1 }).first(),
  ).toBeVisible();
});
