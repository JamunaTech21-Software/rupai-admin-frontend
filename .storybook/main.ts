import type { StorybookConfig } from '@storybook/react-vite';

/**
 * The component workspace (F0.03): every component in every state, with prop docs generated from the
 * TypeScript types and an axe accessibility panel. Run with `npm run storybook`.
 */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  staticDirs: ['../public'],
  typescript: { reactDocgen: 'react-docgen' },
  // No usage data leaves the machine.
  core: { disableTelemetry: true },
};

export default config;
