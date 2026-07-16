import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * M10 golden paths: two members chat in the shared room, and a student's draft
 * question is accepted by an admin straight into a lesson's quiz.
 */

const PASSWORD = 'Academy-dev1';

async function register(page: Page, stamp: string, tag: string): Promise<string> {
  const name = `${tag}${stamp}`;
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(name);
  await page.getByLabel(/email/i).fill(`${tag}-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
  return name;
}

async function logout(page: Page) {
  await page.getByRole('banner').getByRole('button').last().click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
}

async function login(page: Page, email: string) {
  await logout(page);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
}

test('two members exchange messages in the circle room', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const ctxA: BrowserContext = await browser.newContext();
  const ctxB: BrowserContext = await browser.newContext();
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  await register(alice, stamp, 'alice');
  await register(bob, stamp, 'bob');

  await alice.goto('/chat');
  await bob.goto('/chat');
  await expect(alice.getByRole('heading', { name: /circle chat/i })).toBeVisible();

  const hello = `Hello from Alice ${stamp}`;
  await alice.getByTestId('chat-composer').fill(hello);
  await alice.getByTestId('chat-send').click();
  await expect(alice.getByText(hello).last()).toBeVisible();

  // Bob receives it live (Socket.IO) or on the 60s poll — allow generous time.
  await expect(bob.getByText(hello).last()).toBeVisible({ timeout: 15_000 });

  const reply = `Hi Alice, Bob here ${stamp}`;
  await bob.getByTestId('chat-composer').fill(reply);
  await bob.getByTestId('chat-send').click();
  await expect(alice.getByText(reply).last()).toBeVisible({ timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});

test('a student draft question is accepted into a lesson quiz by an admin', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const unique = `fetch-phase-${stamp}`;

  await register(page, stamp, 'suggester');

  // Submit a draft MCQ. Target a lesson no other test quizzes, so accepting it
  // (which appends a real question) can't disturb the other journeys.
  await page.goto('/suggestions');
  await page.getByRole('button', { name: /a draft question/i }).click();
  await page.getByLabel(/lesson \(required\)/i).click();
  await page.getByRole('option', { name: 'Meet the Command Line' }).click();
  await page.getByTestId('suggest-prompt').fill(`What does ${unique} do?`);
  // Two options; option A (the default correct) filled with the right answer.
  const optionInputs = page.getByPlaceholder(/option \d/i);
  await optionInputs.nth(0).fill('reads the next instruction');
  await optionInputs.nth(1).fill('stores to disk');
  await page.getByTestId('suggest-body').fill('Covers the fetch phase.');
  await page.getByTestId('suggest-submit').click();
  await expect(page.getByText(/your suggestion is with the admins/i)).toBeVisible();

  // Admin reviews and accepts it into the bank.
  await login(page, 'admin@academy.local');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /suggestions/i })
    .click();
  const card = page.getByTestId('suggestion-card').filter({ hasText: unique });
  await expect(card).toBeVisible();
  await card.getByTestId('suggestion-accept').click();

  // It moves out of the pending queue.
  await expect(page.getByTestId('suggestion-card').filter({ hasText: unique })).toBeHidden({
    timeout: 10_000,
  });
});
