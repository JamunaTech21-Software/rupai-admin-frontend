import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { startMocking } from './mocks';
import { routes } from './routes';
// Self-hosted fonts (no third-party font server): Inter for Latin, Noto Sans Bengali for Bengali names.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html.');

const router = createBrowserRouter(routes);

// In development, MSW must be listening before the first request (VITE_MOCK_API). Elsewhere this resolves at once.
void startMocking().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
