import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { jsonResponse, stubApi } from './test/fixtures';

describe('App', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('redirects / to /equipos inside the app shell', async () => {
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/equipment': () => jsonResponse([]),
      '/api/locations': () => jsonResponse([]),
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mantenimiento de Equipos' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Equipos' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/equipos');
    expect(await screen.findByText('API disponible')).toBeInTheDocument();
  });
});
