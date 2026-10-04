import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { routes } from './routes';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html.');

const router = createBrowserRouter(routes);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
