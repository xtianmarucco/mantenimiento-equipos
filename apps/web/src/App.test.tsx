import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the shell with the app name and the API health status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mantenimiento de Equipos' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('API disponible')).toBeInTheDocument();
  });
});
