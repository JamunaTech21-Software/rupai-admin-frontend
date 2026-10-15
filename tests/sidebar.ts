import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Opens a sidebar group ("Master Data", "User Administration") and returns the navigation, so a test can find
 * the group's pages. Only one group is open at a time (R.1), so open the one you need right before looking.
 */
export async function openSidebarGroup(name: string): Promise<HTMLElement> {
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  const button = within(nav).getByRole('button', { name });
  if (button.getAttribute('aria-expanded') !== 'true') await userEvent.click(button);
  return nav;
}
