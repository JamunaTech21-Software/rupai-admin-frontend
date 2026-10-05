import { type ReactNode } from 'react';
import { RouterProvider } from 'react-aria-components';

import { ToastRegion } from './Toast';
import { type UiText, UiTextContext, UI_TEXT_EN } from './uiText';

export interface UiProviderProps {
  /** The router's navigate function, so ui Links navigate without a page reload. */
  readonly navigate: (path: string) => void;
  /** The router's href resolver (for base paths). */
  readonly useHref?: (href: string) => string;
  /** The component library's words in the active language (app/ builds it from the i18n `ui` namespace). */
  readonly text?: UiText;
  readonly children: ReactNode;
}

/**
 * Connects the component library to the app's router. ui/ stays router-agnostic; app/ passes React Router's
 * `navigate` and `useHref` in once, at the root. It also renders the one toast region the app shows.
 */
export function UiProvider({ navigate, useHref, text = UI_TEXT_EN, children }: UiProviderProps) {
  return (
    <UiTextContext.Provider value={text}>
      <RouterProvider navigate={navigate} {...(useHref ? { useHref } : {})}>
        {children}
        <ToastRegion />
      </RouterProvider>
    </UiTextContext.Provider>
  );
}
