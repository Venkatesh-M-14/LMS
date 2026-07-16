import { test, expect } from '@playwright/test';

/**
 * M5 golden path: a coding challenge inside a quiz — instant client-side
 * test runs, submission, asynchronous judging in the server sandbox, and a
 * final graded result. Runs as the instructor (gating bypass) so the deep
 * lesson is reachable without completing the whole path first.
 */

const SOLUTION = `function binarySearch(sorted, target) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`;

test('coding item: client test run → submit → judge grades → passed', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('instructor@academy.local');
  await page.getByLabel(/password/i).fill('Academy-dev1');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  // Open the lesson carrying the binary-search challenge.
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByRole('link', { name: 'Thinking in Algorithms' }).click();
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz|retake quiz|resume attempt/i })
    .click();

  // Solve the coding item and run the visible tests locally first.
  const editor = page.getByLabel(/code editor — main\.js/i);
  await expect(editor).toBeVisible();
  await editor.fill(SOLUTION);

  await page.getByRole('button', { name: /run 2 visible test/i }).click();
  const clientResults = page.getByTestId('client-test-results');
  await expect(clientResults).toBeVisible();
  await expect(clientResults.getByText('finds an element in the middle')).toBeVisible();
  await expect(clientResults.locator('svg[data-testid="CheckCircleIcon"]')).toHaveCount(2);

  // Answer the auto-graded items (reflection stays empty).
  await page.getByLabel(/20 comparisons/i).check();
  await page.getByLabel(/your predicted output/i).fill('5');
  await page.getByLabel(/roughly O\(n×m\)/i).check();
  await page.getByLabel(/reduces it to roughly O\(n\+m\)/i).check();
  await page.getByLabel(/fix costs O\(m\) once/i).check();

  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // The judge grades asynchronously: grading banner first, then the result.
  await expect(page.getByText(/grading in progress|you passed/i).first()).toBeVisible();
  await expect(page.getByText(/you passed/i)).toBeVisible({ timeout: 30_000 });

  // The judge's verdict is visible: all tests passed, hidden tests included.
  await expect(page.getByText(/all tests passed/i)).toBeVisible();
  await expect(page.getByText(/finds the first and last elements/i)).toBeVisible();
});

test('coding item: wrong code fails the hidden tests and the judge says so', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('instructor@academy.local');
  await page.getByLabel(/password/i).fill('Academy-dev1');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByRole('link', { name: 'From Source Code to Execution' }).click();
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz|retake quiz|resume attempt/i })
    .click();

  // "Fix" the bug incorrectly: passes the visible test, fails hidden ones.
  const editor = page.getByLabel(/code editor — main\.js/i);
  await editor.fill(`function sumFirstN(numbers, n) {
  let total = 0;
  for (let i = 0; i < Math.min(n, 2); i++) total += numbers[i] ?? 0;
  return total;
}`);

  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // Judge verdict: some tests failed — hidden edge cases caught the fake fix.
  await expect(page.getByText(/some tests failed/i)).toBeVisible({ timeout: 30_000 });
});
