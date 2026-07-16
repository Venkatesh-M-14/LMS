import { test, expect, type Page } from '@playwright/test';

/**
 * M2 golden path: an instructor authors a lesson through the CMS, an admin
 * publishes it (four-eyes), and a student reads it. Unique slugs keep the
 * suite repeatable against one database.
 */

const PASSWORD = 'Academy-dev1';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('banner').getByRole('button').last().click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
}

test('instructor authors → admin publishes → student reads', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const title = `E2E Lesson ${stamp}`;
  const slug = `e2e-lesson-${stamp}`;

  // ── Instructor: create lesson + draft content ─────────────────────────────
  await login(page, 'instructor@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /instructor/i })
    .click();
  await expect(page.getByRole('heading', { name: /lesson authoring/i })).toBeVisible();

  await page.getByRole('button', { name: /new lesson/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/topic/i).click();
  await page.getByRole('option', { name: /browser internals/i }).click();
  await dialog.getByLabel(/lesson title/i).fill(title);
  await dialog.getByLabel(/slug/i).fill(slug);
  await dialog.getByLabel(/estimated minutes/i).fill('12');
  await dialog.getByRole('button', { name: /^create$/i }).click();
  await expect(dialog).toBeHidden();

  // Open the editor for the new lesson.
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  // Add a markdown block and save.
  await page.getByRole('button', { name: /add block/i }).click();
  await page.getByRole('menuitem', { name: /^markdown$/i }).click();
  await page
    .getByLabel(/markdown content/i)
    .fill(`# Hello from E2E ${stamp}\n\nThis paragraph was authored by the test.`);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('button', { name: /^saved$/i })).toBeVisible();

  // Tag a skill (required to publish).
  await page.getByPlaceholder(/tag skills/i).click();
  await page.getByRole('option').first().click();

  // Submit for review; the author must NOT be able to publish (four-eyes).
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByRole('button', { name: /^publish$/i })).toBeDisabled();

  // ── Student: the unpublished lesson is invisible ──────────────────────────
  await logout(page);
  await login(page, 'student@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await expect(page.getByRole('heading', { name: /frontend engineering/i })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);

  // ── Admin: publish the in-review version ──────────────────────────────────
  await logout(page);
  await login(page, 'admin@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /instructor/i })
    .click();
  await page.getByRole('link', { name: title }).click();
  const publishButton = page.getByRole('button', { name: /^publish$/i });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
  await expect(page.getByText(/^published$/i).first()).toBeVisible();

  // ── Student: reads the published lesson ───────────────────────────────────
  await logout(page);
  await login(page, 'student@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();

  // The lesson lives in module 01 → Browser Internals (module is expanded by default).
  await page.getByText(title).first().click();
  await expect(page.getByRole('heading', { name: `Hello from E2E ${stamp}` })).toBeVisible();
  await expect(page.getByText(/authored by the test/i)).toBeVisible();
});

test('students cannot open the instructor portal', async ({ page }) => {
  await login(page, 'student@academy.local');
  await expect(page.getByRole('navigation').getByRole('link', { name: /instructor/i })).toHaveCount(
    0,
  );
  await page.goto('/instructor');
  // RoleRoute bounces straight back to the dashboard.
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
});

test('seeded curriculum renders a deep lesson for students', async ({ page }) => {
  await login(page, 'student@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByText('How a Computer Actually Works').click();
  await expect(
    page.getByRole('heading', { name: /how a computer actually works/i, level: 1 }).first(),
  ).toBeVisible();
  await expect(page.getByText(/fetch–decode–execute/i).first()).toBeVisible();
});
