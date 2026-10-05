import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

interface IndexEntry {
  readonly id: string;
  readonly title: string;
  readonly name: string;
  readonly type: 'story' | 'docs';
}

const index = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'storybook-static', 'index.json'), 'utf8'),
) as {
  entries: Record<string, IndexEntry>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');

test('the workspace has stories', () => {
  expect(stories.length).toBeGreaterThan(20);
});

/** Storybook's preview state: the current story render and its phase (`playing`, `completed`, `errored`, …). */
interface PreviewWindow {
  __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } };
}

for (const story of stories) {
  test(`${story.title} › ${story.name} has no WCAG AA violations`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await page.locator('#storybook-root > *').first().waitFor();
    // Storybook runs the story's play function on load. Wait until it has finished, so axe sees the settled
    // page rather than a keyboard interaction half-way through; a play function that errors fails the test.
    const phase = await page
      .waitForFunction(() => {
        const current = (window as PreviewWindow).__STORYBOOK_PREVIEW__?.currentRender?.phase;
        return current && ['completed', 'finished', 'errored', 'aborted'].includes(current) ? current : null;
      })
      .then((handle) => handle.jsonValue());
    expect(phase, 'the story and its play function finish without error').not.toBe('errored');
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
