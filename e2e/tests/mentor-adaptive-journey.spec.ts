import { test, expect, type Page } from '@playwright/test';

/**
 * M8 golden paths (run with MENTOR_PROVIDER=fake so no API key is needed):
 *  1. Failing a quiz assigns an adaptive revision; reviewing the lesson clears it.
 *  2. The lesson-anchored AI Mentor streams a grounded reply.
 */

const PASSWORD = 'Academy-dev1';

async function registerFreshStudent(page: Page, stamp: string): Promise<string> {
  const name = `Learner ${stamp}`;
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(name);
  await page.getByLabel(/email/i).fill(`m8-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
  return name;
}

async function openFirstLesson(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByText('How a Computer Actually Works').first().click();
  await expect(
    page.getByRole('heading', { name: 'How a Computer Actually Works' }).first(),
  ).toBeVisible();
}

test('failing a quiz assigns a revision, and reviewing the lesson clears it', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerFreshStudent(page, stamp);

  await openFirstLesson(page);
  const quizCard = page.getByTestId('quiz-card');
  await quizCard.getByRole('button', { name: /start quiz/i }).click();

  // Answer everything wrong; leave the reflection blank so it auto-finalizes
  // (a filled written answer would route to manual grading instead).
  await page.getByLabel(/stores a result back to disk/i).check();
  await page.getByLabel(/your predicted output/i).fill('0');
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // Finalized as a fail (no manual grading was pending).
  await expect(page.getByText(/not passed this time/i)).toBeVisible();

  // The dashboard now shows an adaptive revision assignment with a blocking notice.
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /dashboard/i })
    .click();
  const panel = page.getByTestId('revision-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/review the assigned lessons/i)).toBeVisible();
  const reviewButton = panel.getByRole('link', { name: /review/i }).first();
  await expect(reviewButton).toBeVisible();

  // Reviewing the targeted lesson completes the assignment.
  await reviewButton.click();
  await expect(
    page.getByRole('heading', { name: 'How a Computer Actually Works' }).first(),
  ).toBeVisible();

  await page
    .getByRole('navigation')
    .getByRole('link', { name: /dashboard/i })
    .click();
  await expect(page.getByTestId('revision-panel').getByText(/reviewed/i).first()).toBeVisible();
  await expect(page.getByText(/review the assigned lessons/i)).toBeHidden();
});

test('the lesson AI Mentor streams a grounded reply', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerFreshStudent(page, stamp);

  await openFirstLesson(page);

  // Open the lesson-anchored mentor drawer and ask a question.
  await page.getByTestId('mentor-fab').click();
  const composer = page.getByTestId('mentor-composer');
  await expect(composer).toBeVisible();
  await composer.fill('Can you explain the fetch-decode-execute cycle?');
  await page.getByTestId('mentor-send').click();

  // The user's message and a streamed assistant reply both appear.
  await expect(page.getByText('Can you explain the fetch-decode-execute cycle?')).toBeVisible();
  await expect(page.getByText(/let me help you think it through/i)).toBeVisible();

  // Budget usage moved off its initial full value.
  await expect(page.getByText(/tokens left today/i)).toBeVisible();
});
