import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('design token reference (F0.02)', () => {
  test('shows every contrast pair passing, and axe finds no violations', async ({ page }) => {
    await page.goto('/design/tokens');
    await expect(page.getByRole('heading', { level: 1, name: 'Design tokens' })).toBeVisible();

    // The page measures every pair live from the stylesheet the browser is using.
    await expect(page.getByText(/^(\d+) of \1 pairs meet WCAG AA\.$/)).toBeVisible();
    await expect(page.getByText('✗ Fail')).toHaveCount(0);

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('loads the Bengali face for Bengali text', async ({ page }) => {
    await page.goto('/design/tokens');
    await page.getByText('শ্রমিক', { exact: false }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family.includes('Noto Sans Bengali') && font.status === 'loaded',
      ),
    );
    expect(loaded).toBe(true);
  });

  test('gives touch targets at least 44 px below md, and keeps body text at 16 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const link = page.getByRole('link', { name: 'View the design tokens' });
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const bodySize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    expect(bodySize).toBe('16px');
  });
});
