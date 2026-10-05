import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import '../src/app/index.css';

import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';

const preview: Preview = {
  // Links in stories navigate inside a memory router, so clicking one never leaves the workspace.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // Any axe violation fails the story's accessibility check (and the CI run in e2e/storybook.spec.ts).
    a11y: { test: 'error' },
    options: { storySort: { order: ['Introduction', 'Foundations', 'Primitives'] } },
  },
  tags: ['autodocs'],
};

export default preview;
