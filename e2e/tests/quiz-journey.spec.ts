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
  const reflectionText = `Reflection-${stamp}: a slow page means the main thread is executing too many instructions before paint; move heavy loops into a Web Worker.`;

  // Fresh student for an unambiguous grading queue.
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(studentName);
  await page.getByLabel(/email/i).fill(`quiz-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();

  // Take the first lesson's quiz (later lessons are gated in M4).
  await openLesson(page, 'How a Computer Actually Works');
  const quizCard = page.getByTestId('quiz-card');
  await expect(quizCard).toBeVisible();
  await quizCard.getByRole('button', { name: /start quiz/i }).click();

  // Q1 MCQ: fetch reads the next instruction from memory
  await page.getByLabel(/reads the next instruction/i).check();
  // Q2 multi-select: a, b, d
  await page.getByLabel(/instructions and data live in the same memory/i).check();
  await page.getByLabel(/code can be treated as data/i).check();
  await page.getByLabel(/running untrusted code is dangerous/i).check();
  // Q3 output prediction: 4 + 6 + 6 = 16
  await page.getByLabel(/your predicted output/i).fill('16');
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
  await openLesson(page, 'How a Computer Actually Works');
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

  await openLesson(page, 'How a Computer Actually Works');
  await page
    .getByTestId('quiz-card')
    .getByRole('button', { name: /start quiz/i })
    .click();

  // One wrong MCQ answer, everything else untouched (reflection left empty).
  await page.getByLabel(/waits for user input/i).check();
  await page.getByRole('button', { name: /submit answers/i }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /submit answers/i })
    .click();

  // Unanswered reflection auto-zeroes → graded immediately, failed.
  await expect(page.getByText(/not passed this time/i)).toBeVisible();
  await expect(page.getByTestId('attempt-results')).toBeVisible();

  // The correct answers are now revealed for learning.
  await expect(page.getByText(/reads the next instruction/i).first()).toBeVisible();
});
