import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../../tests/axe';

import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows the product name and the configured API base URL', () => {
    render(<HomePage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('heading', { level: 1, name: 'RupAI ERP' })).toBeInTheDocument();
    expect(screen.getByText('/api/v1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the design tokens' })).toHaveAttribute(
      'href',
      '/design/tokens',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<HomePage />, { wrapper: MemoryRouter });
    expect(await axeViolations(container)).toEqual([]);
  });
});
