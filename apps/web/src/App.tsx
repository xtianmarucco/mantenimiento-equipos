import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from './app/routes';

export function App() {
  // Created once per mount (not at import time) so tests can set the URL before rendering.
  const [router] = useState(() => createBrowserRouter(routes));
  return <RouterProvider router={router} />;
}
