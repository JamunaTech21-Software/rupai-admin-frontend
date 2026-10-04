import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ALL_TOKENS, CONTRAST_PAIRS, DOCUMENT_STATES } from '@/ui';

import { axeViolations } from '../../../../tests/axe';

import { TokensPage } from './TokensPage';

describe('TokensPage', () => {
  it('shows every token', () => {
    render(<TokensPage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('heading', { level: 1, name: 'Design tokens' })).toBeInTheDocument();
    for (const token of ALL_TOKENS) {
      expect(screen.getAllByText(token.name, { exact: false }).length, token.name).toBeGreaterThan(0);
    }
  });

  it('labels every document state, so colour never stands alone', () => {
    render(<TokensPage />, { wrapper: MemoryRouter });
    const badges = within(screen.getByRole('list', { name: 'Document state badges' }));
    for (const state of DOCUMENT_STATES) expect(badges.getByText(state)).toBeInTheDocument();
  });

  it('lists every contrast pair', () => {
    render(<TokensPage />, { wrapper: MemoryRouter });
    const table = screen.getByRole('table', { name: /Contrast of every colour pair/ });
    expect(within(table).getAllByRole('row')).toHaveLength(CONTRAST_PAIRS.length + 1);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TokensPage />, { wrapper: MemoryRouter });
    expect(await axeViolations(container)).toEqual([]);
  });
});
