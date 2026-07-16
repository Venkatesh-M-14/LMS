import { test, expect, type Page } from '@playwright/test';

/**
 * M6 golden path: submit → review → changes requested → resubmit → approve,
 * with the feedback thread and rubric scores visible to the student.
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

test('project: submit → review → changes requested → resubmit → approve', async ({ page }) => {
  test.setTimeout(150_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const studentName = `Project Builder ${stamp}`;
  const feedback = `Feedback-${stamp}: the loop example never terminates — check your JUMP_IF_ZERO condition.`;

  // Fresh student (topic 1 is accessible from the start).
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(studentName);
  await page.getByLabel(/email/i).fill(`proj-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  // Open the topic project from the curriculum and submit.
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByRole('link', { name: /build a toy computer simulator/i }).click();
  await expect(
    page.getByRole('heading', { name: /build a toy computer simulator/i }),
  ).toBeVisible();
  await expect(page.getByText(/scoring rubric/i)).toBeVisible();

  await page.getByLabel(/repository url/i).fill(`https://github.com/example/toy-cpu-${stamp}`);
  await page
    .getByLabel(/notes for the reviewer/i)
    .fill('First pass — all five instructions implemented.');
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText(/with the review team/i)).toBeVisible();

  // Instructor: start review, request changes.
  await logout(page);
  await login(page, 'instructor@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /projects/i })
    .click();
  const row = page.getByRole('row').filter({ hasText: studentName });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: /review/i }).click();

  await page.getByRole('button', { name: /start review/i }).click();
  await expect(page.getByText(/score the rubric/i)).toBeVisible();
  await page.getByLabel(/what should the student change/i).fill(feedback);
  await page.getByRole('button', { name: /request changes/i }).click();
  await expect(page.getByText(/waiting for the student/i)).toBeVisible();

  // Student: sees the feedback, resubmits.
  await logout(page);
  await login(page, `proj-${stamp}@example.com`);
  await page.goto('/curriculum');
  await page.getByRole('link', { name: /build a toy computer simulator/i }).click();
  await expect(page.getByText(/reviewer asked for changes/i)).toBeVisible();
  await expect(page.getByTestId('feedback-thread').getByText(feedback)).toBeVisible();

  await page.getByLabel(/repository url/i).fill(`https://github.com/example/toy-cpu-${stamp}-v2`);
  await page.getByRole('button', { name: /resubmit for review/i }).click();
  await expect(page.getByText(/with the review team/i)).toBeVisible();
  await expect(page.getByText(/round 2/i).first()).toBeVisible();

  // Instructor: approve with rubric scores.
  await logout(page);
  await login(page, 'instructor@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /projects/i })
    .click();
  await page
    .getByRole('row')
    .filter({ hasText: studentName })
    .getByRole('link', { name: /review/i })
    .click();
  await page.getByRole('button', { name: /start review/i }).click();

  const scoreInputs = page.getByLabel(/score \(max/i);
  await scoreInputs.nth(0).fill('9');
  await scoreInputs.nth(1).fill('5');
  await scoreInputs.nth(2).fill('4');
  await page.getByRole('button', { name: /approve with these scores/i }).click();
  await expect(page.getByText(/approved: 18\/20/i)).toBeVisible();

  // Student: sees approval + rubric breakdown.
  await logout(page);
  await login(page, `proj-${stamp}@example.com`);
  await page.goto('/curriculum');
  await page.getByRole('link', { name: /build a toy computer simulator/i }).click();
  await expect(page.getByTestId('project-approved')).toBeVisible();
  await expect(page.getByText(/18\/20/).first()).toBeVisible();
});

test('project: locked topics hide their projects from students', async ({ page }) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`Locked Out ${stamp}`);
  await page.getByLabel(/email/i).fill(`locked-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  // Topic 2's project (process monitor) is behind topic 1 — disabled in the UI.
  const lockedProject = page.getByRole('link', { name: /process monitor page/i });
  await expect(lockedProject).toHaveAttribute('aria-disabled', 'true');

  // And refused at the API even with a direct URL.
  const href = await lockedProject.getAttribute('href');
  await page.goto(href!);
  await expect(page.getByText(/complete the previous topics/i)).toBeVisible();
});
