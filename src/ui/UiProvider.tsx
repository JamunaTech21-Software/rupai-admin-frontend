import { type ReactNode } from 'react';
import { RouterProvider } from 'react-aria-components';

export interface UiProviderProps {
  /** The router's navigate function, so ui Links navigate without a page reload. */
  readonly navigate: (path: string) => void;
  /** The router's href resolver (for base paths). */
  readonly useHref?: (href: string) => string;
  readonly children: ReactNode;
}

/**
 * Connects the component library to the app's router. ui/ stays router-agnostic; app/ passes React Router's
 * `navigate` and `useHref` in once, at the root.
 */
export function UiProvider({ navigate, useHref, children }: UiProviderProps) {
  return (
    <RouterProvider navigate={navigate} {...(useHref ? { useHref } : {})}>
      {children}
    </RouterProvider>
  );
}
