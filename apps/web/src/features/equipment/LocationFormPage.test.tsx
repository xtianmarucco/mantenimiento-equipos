import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '../../app/routes';
import { jsonResponse, LOCATION_CENTRO, LOCATION_KIOSCO } from '../../test/fixtures';
import type { LocationResponse } from '@mantenimiento/shared';

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

const CREATED: LocationResponse = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Kiosco Plaza',
  kind: 'THIRD_PARTY',
  address: null,
  contactName: null,
  phone: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

const ITEM: LocationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. Siempre Viva 742',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

/** Stubs `fetch` by "METHOD path"; unknown requests answer 404. */
function stubRequests(handlers: Record<string, Handler>) {
  const base: Record<string, Handler> = {
    'GET /api/locations': () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
  };
  const all = { ...base, ...handlers };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), 'http://localhost');
    const handler = all[`${init?.method ?? 'GET'} ${pathname}`];
    return Promise.resolve(
      handler ? handler(init) : jsonResponse({ error: { message: 'Not found' } }, { status: 404 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentBodies(fetchMock: ReturnType<typeof stubRequests>, method: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function fillValidCreateForm() {
  await screen.findByRole('heading', { level: 2, name: 'Nueva ubicación' });
  await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Kiosco Plaza');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Kiosco');
}

describe('LocationCreatePage', () => {
  it('creates the location and returns to the list', async () => {
    const fetchMock = stubRequests({
      'POST /api/locations': () => jsonResponse(CREATED, { status: 201 }),
    });
    const router = renderAt('/ubicaciones/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear ubicación' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ubicaciones'));
    expect(sentBodies(fetchMock, 'POST')).toEqual([{ name: 'Kiosco Plaza', kind: 'THIRD_PARTY' }]);
  });

  it('validates on the client, in Spanish, and focuses the first invalid field', async () => {
    const fetchMock = stubRequests({});
    renderAt('/ubicaciones/nuevo');
    await screen.findByRole('heading', { level: 2, name: 'Nueva ubicación' });

    await userEvent.click(screen.getByRole('button', { name: 'Crear ubicación' }));

    const name = screen.getByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/Este campo es obligatorio\./);
    expect(name).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveAccessibleDescription(
      'Seleccione un tipo.',
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('shows a form error on a network failure and keeps the values', async () => {
    stubRequests({
      'POST /api/locations': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    renderAt('/ubicaciones/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear ubicación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
    );
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Kiosco Plaza');
  });
});

describe('LocationEditPage', () => {
  it('loads the location, PATCHes only the changed fields and returns to the list', async () => {
    const updated = { ...ITEM, name: 'Heladería Norte' };
    const fetchMock = stubRequests({
      [`GET /api/locations/${ITEM.id}`]: () => jsonResponse(ITEM),
      [`PATCH /api/locations/${ITEM.id}`]: () => jsonResponse(updated),
    });
    const router = renderAt(`/ubicaciones/${ITEM.id}/editar`);

    const name = await screen.findByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveValue('Heladería Centro');
    await userEvent.clear(name);
    await userEvent.type(name, 'Heladería Norte');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ubicaciones'));
    expect(sentBodies(fetchMock, 'PATCH')).toEqual([{ name: 'Heladería Norte' }]);
  });

  it('returns to the list without a request when nothing changed', async () => {
    const fetchMock = stubRequests({
      [`GET /api/locations/${ITEM.id}`]: () => jsonResponse(ITEM),
    });
    const router = renderAt(`/ubicaciones/${ITEM.id}/editar`);

    await screen.findByRole('button', { name: 'Guardar cambios' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ubicaciones'));
    expect(sentBodies(fetchMock, 'PATCH')).toEqual([]);
  });

  it('shows "Ubicación no encontrada" for a missing id', async () => {
    stubRequests({});
    renderAt('/ubicaciones/44444444-4444-4444-8444-444444444444/editar');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Ubicación no encontrada' }),
    ).toBeInTheDocument();
  });
});
