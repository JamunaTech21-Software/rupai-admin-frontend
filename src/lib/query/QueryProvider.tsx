import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { createQueryClient } from './queryClient';

/** Provides the query client to the app (app/RootLayout), or a given one in tests and stories. */
export function QueryProvider({
  client,
  children,
}: {
  readonly client?: QueryClient;
  readonly children: ReactNode;
}) {
  const [own] = useState(() => client ?? createQueryClient());
  return <QueryClientProvider client={own}>{children}</QueryClientProvider>;
}
