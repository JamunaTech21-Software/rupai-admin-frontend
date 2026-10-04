import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from './routes';

describe('route tree', () => {
  it('renders the lazy home route at /', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'RupAI ERP' })).toBeInTheDocument();
  });
});
