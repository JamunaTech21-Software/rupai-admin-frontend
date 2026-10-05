import { type ReactNode } from 'react';

/** Text for screen readers only: present in the accessibility tree, invisible on screen. */
export function VisuallyHidden({ children }: { readonly children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
