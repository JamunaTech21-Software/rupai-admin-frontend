import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import { render } from '@testing-library/react';
import { type ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

import preview from '../.storybook/preview';

import { axeViolations } from './axe';

/**
 * Every story in the workspace, rendered in jsdom: axe must find no violations, and each story's `play`
 * function (keyboard and pointer checks) must pass. Colour contrast is checked in a real browser by
 * e2e-storybook/stories.spec.ts.
 */
setProjectAnnotations(preview);

/** The parts of a composed story this test uses. */
type ComposedStory = ComponentType & {
  readonly args: Record<string, unknown>;
  readonly play?: (context: { canvasElement: HTMLElement; args: Record<string, unknown> }) => Promise<void>;
};

type StoryModule = Parameters<typeof composeStories>[0];
const modules = import.meta.glob<StoryModule>('/src/**/*.stories.tsx', { eager: true });

const cases = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries(composeStories(module) as unknown as Record<string, ComposedStory>).map(
    ([name, story]) => [`${file} › ${name}`, story] as const,
  ),
);

describe('component workspace stories', () => {
  it('finds the stories', () => {
    expect(cases.length).toBeGreaterThan(20);
  });

  it.each(cases)(
    '%s renders without accessibility violations and passes its play function',
    async (_name, Story) => {
      const { container } = render(<Story />);
      if (Story.play) await Story.play({ canvasElement: container, args: Story.args });
      expect(await axeViolations(container)).toEqual([]);
    },
  );
});
