import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { jsonResponse, stubApi } from '../test/fixtures';
import { routes } from './routes';

function renderAt(path: string) {
  stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/equipment': () => jsonResponse([]),
    '/api/locations': () => jsonResponse([]),
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routes', () => {
  it('redirects / to /equipos', async () => {
    const router = renderAt('/');

    expect(await screen.findByRole('heading', { level: 2, name: 'Equipos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/equipos');
  });

  it('renders the shell navigation with the current section marked', async () => {
    renderAt('/ubicaciones');

    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ubicaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Equipos' })).toHaveAttribute('href', '/equipos');
  });

  it('renders the locations list page', async () => {
    renderAt('/ubicaciones');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Ubicaciones' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Próximamente/)).not.toBeInTheDocument();
  });

  it('shows a not found page for unknown paths', async () => {
    renderAt('/no-existe');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos',
    );
  });
});
