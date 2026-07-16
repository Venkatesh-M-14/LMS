import { test, expect, type Page } from '@playwright/test';

/**
 * M3 golden paths.
 * A fresh student account per run keeps the grading queue unambiguous and the
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

async function openLesson(page: Page, lessonTitle: string | RegExp) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /curriculum/i })
    .click();
  await page.getByText(lessonTitle).first().click();
}

test('quiz: answer → submit → reflection graded by instructor → student sees final score', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const studentName = `Quiz Taker ${stamp}`;
  const reflectionText = `Reflection-${stamp}: binary floats cannot represent 0.1 exactly, so equality comparisons drift; store integer paise instead.`;

  // Fresh student for an unambiguous grading queue.
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(studentName);
  await page.getByLabel(/email/i).fill(`quiz-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  // Take the "Bits, Bytes, and Binary" quiz.
  await openLesson(page, 'Bits, Bytes, and Binary');
  const quizCard = page.getByTestId('quiz-card');
  await expect(quizCard).toBeVisible();
  await quizCard.getByRole('button', { name: /start quiz/i }).click();

  // Q1 MCQ: 256, because 2⁸…
  await page.getByLabel(/256, because/i).check();
  // Q2 output prediction: parseInt('1100', 2) → 12
  await page.getByLabel(/your predicted output/i).fill('12');
  // Q3 multi-select: a, c, d
  await page.getByLabel(/same bytes can be text/i).check();
  await page.getByLabel(/#FF0000 encodes/i).check();
  await page.getByLabel(/floats have limited precision/i).check();
  // Q4 reflection
  await page.getByLabel(/your answer/i).fill(reflectionText);

  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // Reflection pending → grading banner.
  await expect(page.getByText(/grading in progress/i)).toBeVisible();

  // Instructor grades it.
  await logout(page);
  await login(page, 'instructor@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /grading/i })
    .click();
  const row = page.getByRole('row').filter({ hasText: studentName });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /grade/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(reflectionText)).toBeVisible();
  await dialog.getByLabel(/score/i).fill('4');
  await dialog.getByLabel(/feedback/i).fill('Clear explanation with a correct fix.');
  await dialog.getByRole('button', { name: /save score/i }).click();
  await expect(dialog.getByText(/all written answers.*graded/i)).toBeVisible();
  await dialog.getByRole('button', { name: /close/i }).click();
  await expect(page.getByRole('row').filter({ hasText: studentName })).toHaveCount(0);

  // Student sees the final, passed result with feedback.
  await logout(page);
  await login(page, `quiz-${stamp}@example.com`);
  await openLesson(page, 'Bits, Bytes, and Binary');
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /view last result/i })
    .click();

  await expect(page.getByText(/you passed/i)).toBeVisible();
  await expect(page.getByText(/score: 100%/i)).toBeVisible();
  await expect(page.getByText(/clear explanation with a correct fix/i)).toBeVisible();
});

test('quiz: wrong answers fail immediately when no reflection is written', async ({ page }) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`Fail Case ${stamp}`);
  await page.getByLabel(/email/i).fill(`fail-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  await openLesson(page, 'Bits, Bytes, and Binary');
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz/i })
    .click();

  // One wrong MCQ answer, everything else untouched (reflection left empty).
  await page.getByLabel(/8, because a byte has 8 bits/i).check();
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // Unanswered reflection auto-zeroes → graded immediately, failed.
  await expect(page.getByText(/not passed this time/i)).toBeVisible();
  await expect(page.getByTestId('attempt-results')).toBeVisible();

  // The correct answers are now revealed for learning.
  await expect(page.getByText(/256, because/i)).toBeVisible();
});
