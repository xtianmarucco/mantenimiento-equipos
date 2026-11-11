import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '../../app/routes';
import { jsonResponse, LOCATION_CENTRO, LOCATION_KIOSCO, makeEquipment } from '../../test/fixtures';

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

const CREATED = makeEquipment({
  id: '55555555-5555-4555-8555-555555555555',
  code: 'EQ-0100',
  name: 'Vitrina nueva',
});

/** Stubs `fetch` by "METHOD path"; unknown requests answer 404. */
function stubRequests(handlers: Record<string, Handler>) {
  const base: Record<string, Handler> = {
    'GET /api/health': () => jsonResponse({ status: 'ok' }),
    'GET /api/locations': () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
    [`GET /api/equipment/${CREATED.id}`]: () => jsonResponse(CREATED),
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
  await screen.findByRole('heading', { level: 2, name: 'Nuevo equipo' });
  await userEvent.type(screen.getByRole('textbox', { name: 'Código' }), 'eq-0100');
  await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Vitrina nueva');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Vitrina');
  await userEvent.type(screen.getByRole('textbox', { name: 'Marca' }), 'Gafa');
  await userEvent.type(screen.getByRole('textbox', { name: 'Modelo' }), 'V-200');
  fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-10-01' } });
  const location = screen.getByRole('combobox', { name: 'Ubicación' });
  await waitFor(() => expect(location).toBeEnabled());
  await userEvent.selectOptions(location, 'Heladería Centro');
}

const SUBMIT_CREATE = { name: 'Crear equipo' };

describe('EquipmentCreatePage', () => {
  it('creates the equipment and opens its detail', async () => {
    const fetchMock = stubRequests({
      'POST /api/equipment': () => jsonResponse(CREATED, { status: 201 }),
    });
    const router = renderAt('/equipos/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${CREATED.id}`));
    expect(sentBodies(fetchMock, 'POST')).toEqual([
      {
        code: 'EQ-0100',
        name: 'Vitrina nueva',
        type: 'DISPLAY_CASE',
        brand: 'Gafa',
        model: 'V-200',
        purchaseDate: '2026-10-01',
        locationId: LOCATION_CENTRO.id,
      },
    ]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Vitrina nueva' }),
    ).toBeInTheDocument();
  });

  it('validates on the client, in Spanish, and focuses the first invalid field', async () => {
    const fetchMock = stubRequests({});
    renderAt('/equipos/nuevo');
    await screen.findByRole('heading', { level: 2, name: 'Nuevo equipo' });

    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    const code = screen.getByRole('textbox', { name: 'Código' });
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription(/Este campo es obligatorio\./);
    expect(code).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveAccessibleDescription(
      'Seleccione un tipo.',
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('clears a field error once the field is edited', async () => {
    stubRequests({});
    renderAt('/equipos/nuevo');
    await screen.findByRole('heading', { level: 2, name: 'Nuevo equipo' });
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    const name = screen.getByRole('textbox', { name: 'Nombre' });
    await userEvent.type(name, 'X');

    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('maps a 409 conflict to the code field', async () => {
    stubRequests({
      'POST /api/equipment': () =>
        jsonResponse(
          { error: { message: 'Equipment code EQ-0100 is already in use' } },
          { status: 409 },
        ),
    });
    renderAt('/equipos/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    const code = screen.getByRole('textbox', { name: 'Código' });
    await waitFor(() =>
      expect(code).toHaveAccessibleDescription(/Ya existe un equipo con ese código\./),
    );
    expect(code).toHaveFocus();
    expect(screen.getByRole('button', SUBMIT_CREATE)).toBeEnabled();
  });

  it('maps 400 issues from the API to Spanish field errors', async () => {
    stubRequests({
      'POST /api/equipment': () =>
        jsonResponse(
          {
            error: {
              message: 'Location 1 not found',
              issues: [{ path: 'locationId', message: 'Location does not exist' }],
            },
          },
          { status: 400 },
        ),
    });
    renderAt('/equipos/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    const location = screen.getByRole('combobox', { name: 'Ubicación' });
    await waitFor(() =>
      expect(location).toHaveAccessibleDescription(
        'La ubicación seleccionada no existe. Elija otra.',
      ),
    );
    expect(location).toHaveFocus();
  });

  it('shows a form error on a network failure and keeps the values', async () => {
    stubRequests({
      'POST /api/equipment': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    renderAt('/equipos/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
    );
    expect(screen.getByRole('textbox', { name: 'Código' })).toHaveValue('eq-0100');
  });

  it('disables submit while saving', async () => {
    let respond: (response: Response) => void = () => {};
    const fetchMock = stubRequests({
      'POST /api/equipment': () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    });
    renderAt('/equipos/nuevo');

    await fillValidCreateForm();
    await userEvent.click(screen.getByRole('button', SUBMIT_CREATE));

    const saving = screen.getByRole('button', { name: 'Guardando…' });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(sentBodies(fetchMock, 'POST')).toHaveLength(1);
    respond(jsonResponse(CREATED, { status: 201 }));
    await screen.findByRole('heading', { level: 2, name: 'Vitrina nueva' });
  });

  it('retries the locations load after it fails', async () => {
    let locationsCalls = 0;
    stubRequests({
      'GET /api/locations': () => {
        locationsCalls += 1;
        if (locationsCalls === 1) {
          return jsonResponse({ error: { message: 'Boom' } }, { status: 500 });
        }
        return jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]);
      },
    });
    renderAt('/equipos/nuevo');

    const location = screen.getByRole('combobox', { name: 'Ubicación' });
    expect(location).toBeDisabled();
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    await userEvent.click(retry);

    await waitFor(() => expect(location).toBeEnabled());
    await userEvent.selectOptions(location, 'Heladería Centro');
  });
});

describe('EquipmentEditPage', () => {
  const ITEM = makeEquipment({ serialNumber: 'SN-1', notes: 'Nota' });
  const EDIT_PATH = `/equipos/${ITEM.id}/editar`;

  it('loads the item, PATCHes only the changed fields and opens the detail', async () => {
    const updated = { ...ITEM, name: 'Freezer vertical', notes: null };
    const fetchMock = stubRequests({
      [`GET /api/equipment/${ITEM.id}`]: () => jsonResponse(ITEM),
      [`PATCH /api/equipment/${ITEM.id}`]: () => jsonResponse(updated),
    });
    const router = renderAt(EDIT_PATH);

    const name = await screen.findByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveValue('Freezer horizontal');
    await userEvent.clear(name);
    await userEvent.type(name, 'Freezer vertical');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Notas (opcional)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}`));
    expect(sentBodies(fetchMock, 'PATCH')).toEqual([{ name: 'Freezer vertical', notes: null }]);
  });

  it('returns to the detail without a request when nothing changed', async () => {
    const fetchMock = stubRequests({
      [`GET /api/equipment/${ITEM.id}`]: () => jsonResponse(ITEM),
    });
    const router = renderAt(EDIT_PATH);

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}`));
    expect(sentBodies(fetchMock, 'PATCH')).toEqual([]);
  });

  it('maps the API warranty issue to the warranty field', async () => {
    stubRequests({
      [`GET /api/equipment/${ITEM.id}`]: () => jsonResponse(ITEM),
      [`PATCH /api/equipment/${ITEM.id}`]: () =>
        jsonResponse(
          {
            error: {
              message: 'Warranty cannot end before the purchase date',
              issues: [
                { path: 'warrantyUntil', message: 'Warranty cannot end before the purchase date' },
              ],
            },
          },
          { status: 400 },
        ),
    });
    renderAt(EDIT_PATH);

    fireEvent.change(await screen.findByLabelText('Garantía hasta (opcional)'), {
      target: { value: '2030-01-01' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const warranty = screen.getByLabelText('Garantía hasta (opcional)');
    await waitFor(() =>
      expect(warranty).toHaveAccessibleDescription(
        'La garantía no puede terminar antes de la fecha de compra.',
      ),
    );
  });

  it('shows "Equipo no encontrado" for a missing id', async () => {
    stubRequests({});
    renderAt('/equipos/44444444-4444-4444-8444-444444444444/editar');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Equipo no encontrado' }),
    ).toBeInTheDocument();
  });
});
