import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.2 AA gate. Scans representative pages with axe-core and fails on any
 * violation at the wcag2a / wcag2aa / wcag21aa / wcag22aa levels.
 */

const PASSWORD = 'Academy-dev1';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page, context?: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target).flat(),
  }));
  expect(violations, `axe violations on ${context ?? page.url()}:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

async function registerFreshStudent(page: Page, stamp: string) {
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`A11y ${stamp}`);
  await page.getByLabel(/email/i).fill(`a11y-${stamp}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible();
}

test('public auth pages have no WCAG violations', async ({ page }) => {
  await page.goto('/login');
  await scan(page, 'login');
  await page.goto('/register');
  await scan(page, 'register');
});

test('core student pages have no WCAG violations', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerFreshStudent(page, stamp);
  await scan(page, 'dashboard');

  await page.getByRole('navigation').getByRole('link', { name: /curriculum/i }).click();
  await expect(page.getByRole('heading', { name: /frontend engineering/i })).toBeVisible();
  await scan(page, 'curriculum');

  await page.getByRole('navigation').getByRole('link', { name: /ai mentor/i }).click();
  await expect(page.getByRole('heading', { name: /ai mentor/i })).toBeVisible();
  await scan(page, 'mentor');
});
