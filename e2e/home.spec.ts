import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the placeholder home page loads and has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'RupAI ERP' })).toBeVisible();
  await expect(page).toHaveTitle('RupAI ERP');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
