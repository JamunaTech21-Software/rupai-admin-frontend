import type { Meta, StoryObj } from '@storybook/react-vite';

import { TokensPage } from './TokensPage';

/** The F0.02 token reference, shown in the component workspace. */
const meta = {
  title: 'Foundations/Design tokens',
  component: TokensPage,
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TokensPage>;

export default meta;

export const Reference: StoryObj<typeof meta> = {};
