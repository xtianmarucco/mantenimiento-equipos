import type { EquipmentEventResponse, EquipmentResponse } from '@mantenimiento/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '../../app/routes';
import {
  jsonResponse,
  LOCATION_CENTRO,
  LOCATION_KIOSCO,
  makeEquipment,
  sentBodies,
  stubApi,
} from '../../test/fixtures';
import { todayIsoDate } from './dates';

const ITEM = makeEquipment({ status: 'IN_REPAIR', locationId: LOCATION_CENTRO.id });
const OTHER = makeEquipment({
  id: '55555555-5555-4555-8555-555555555555',
  code: 'EQ-0002',
  name: 'Vitrina nueva',
});

function recordedEvent(
  item: EquipmentResponse,
  overrides: Partial<EquipmentEventResponse> = {},
): { event: EquipmentEventResponse; equipment: EquipmentResponse } {
  return {
    event: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      equipmentId: item.id,
      type: 'MAINTENANCE',
      occurredOn: '2026-11-01',
      description: 'Limpieza',
      technician: null,
      cost: null,
      resultingStatus: null,
      fromLocationId: null,
      toLocationId: null,
      replacementEquipmentId: null,
      createdAt: '2026-11-01T15:00:00.000Z',
      ...overrides,
    },
    equipment: item,
  };
}

type Handler = Parameters<typeof stubApi>[0][string];

function renderForm({
  item = ITEM,
  state,
  record = (): Response => jsonResponse(recordedEvent(item), { status: 201 }),
  locations = (): Response | Promise<Response> => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
  events = (): Response => jsonResponse([]),
}: {
  item?: EquipmentResponse;
  state?: unknown;
  record?: Handler;
  locations?: Handler;
  events?: Handler;
} = {}) {
  const fetchMock = stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/locations': locations,
    '/api/equipment': () => jsonResponse([item, OTHER]),
    [`/api/equipment/${item.id}`]: () => jsonResponse(item),
    [`/api/equipment/${item.id}/events`]: (init) =>
      init?.method === 'POST' ? record(init) : events(init),
  });
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: `/equipos/${item.id}/eventos/nuevo`, state }],
  });
  render(<RouterProvider router={router} />);
  return { fetchMock, router };
}

const SUBMIT = { name: 'Registrar evento' };

async function chooseType(label: string) {
  await userEvent.selectOptions(
    await screen.findByRole('combobox', { name: 'Tipo de evento' }),
    label,
  );
}

describe('EquipmentEventFormPage', () => {
  it('shows the item it registers the event for, with today as the date', async () => {
    renderForm();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Registrar evento' }),
    ).toBeInTheDocument();
    expect(screen.getByText('EQ-0001')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha')).toHaveValue(todayIsoDate(new Date()));
  });

  it('registers a maintenance and returns to the detail, keeping the list filters', async () => {
    const today = todayIsoDate(new Date());
    let eventGets = 0;
    const { fetchMock, router } = renderForm({
      state: { listSearch: 'status=IN_REPAIR' },
      events: () => {
        eventGets += 1;
        return jsonResponse([recordedEvent(ITEM, { occurredOn: today }).event]);
      },
    });

    await chooseType('Mantenimiento');
    await userEvent.type(screen.getByRole('textbox', { name: 'Técnico (opcional)' }), 'Juan');
    await userEvent.type(screen.getByRole('textbox', { name: 'Costo (opcional)' }), '1500,50');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Limpieza');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}`));
    expect(router.state.location.state).toEqual({ listSearch: 'status=IN_REPAIR' });
    expect(sentBodies(fetchMock, 'POST')).toEqual([
      {
        type: 'MAINTENANCE',
        occurredOn: today,
        description: 'Limpieza',
        technician: 'Juan',
        cost: 1500.5,
      },
    ]);
    expect(await screen.findByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos?status=IN_REPAIR',
    );
    expect(await screen.findByText('Limpieza')).toBeInTheDocument();
    expect(eventGets).toBe(1);
  });

  it('registers a transfer to another location', async () => {
    const { fetchMock, router } = renderForm();

    await chooseType('Traslado');
    const destination = screen.getByRole('combobox', { name: 'Ubicación de destino' });
    await waitFor(() => expect(destination).toBeEnabled());
    await userEvent.selectOptions(destination, 'Kiosco Plaza');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Mudanza');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}`));
    expect(sentBodies(fetchMock, 'POST')).toEqual([
      expect.objectContaining({ type: 'TRANSFER', toLocationId: LOCATION_KIOSCO.id }),
    ]);
  });

  it('registers a replacement with the chosen replacement equipment', async () => {
    const { fetchMock, router } = renderForm();

    await chooseType('Cambio');
    const replacement = screen.getByRole('combobox', { name: 'Equipo de reemplazo (opcional)' });
    await waitFor(() => expect(replacement).toBeEnabled());
    await userEvent.selectOptions(replacement, 'EQ-0002 · Vitrina nueva');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Cambio');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}`));
    expect(sentBodies(fetchMock, 'POST')).toEqual([
      expect.objectContaining({ type: 'REPLACEMENT', replacementEquipmentId: OTHER.id }),
    ]);
  });

  it('validates on the client, in Spanish, and focuses the first invalid field', async () => {
    const { fetchMock } = renderForm();
    await screen.findByRole('heading', { level: 2, name: 'Registrar evento' });

    await userEvent.click(screen.getByRole('button', SUBMIT));

    const type = screen.getByRole('combobox', { name: 'Tipo de evento' });
    expect(type).toHaveAccessibleDescription('Seleccione un tipo de evento.');
    expect(type).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toHaveAccessibleDescription(
      'Ingrese una descripción.',
    );
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);
  });

  it('rejects a future date before sending', async () => {
    const { fetchMock } = renderForm();

    await chooseType('Baja');
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2999-01-01' } });
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Sin arreglo');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    const date = screen.getByLabelText('Fecha');
    expect(date).toHaveAccessibleDescription('La fecha no puede ser posterior a hoy.');
    expect(date).toHaveFocus();
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);
  });

  it('maps a 400 issue from the API to its field and focuses it', async () => {
    renderForm({
      record: () =>
        jsonResponse(
          {
            error: {
              message: 'Equipment is already at this location',
              issues: [{ path: 'toLocationId', message: 'Equipment is already at this location' }],
            },
          },
          { status: 400 },
        ),
    });

    await chooseType('Traslado');
    const destination = screen.getByRole('combobox', { name: 'Ubicación de destino' });
    await waitFor(() => expect(destination).toBeEnabled());
    await userEvent.selectOptions(destination, 'Kiosco Plaza');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Mudanza');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    await waitFor(() =>
      expect(destination).toHaveAccessibleDescription('El equipo ya está en esa ubicación.'),
    );
    expect(destination).toHaveFocus();
    expect(screen.getByRole('button', SUBMIT)).toBeEnabled();
  });

  it('maps a rule rejected by the API on the type', async () => {
    renderForm({
      record: () =>
        jsonResponse(
          {
            error: {
              message: 'Only equipment in repair or out of service can be repaired',
              issues: [
                {
                  path: 'type',
                  message: 'Only equipment in repair or out of service can be repaired',
                },
              ],
            },
          },
          { status: 400 },
        ),
    });

    await chooseType('Reparación');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Arreglo');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    const type = screen.getByRole('combobox', { name: 'Tipo de evento' });
    await waitFor(() =>
      expect(type).toHaveAccessibleDescription(
        'Solo se puede reparar un equipo en reparación o fuera de servicio.',
      ),
    );
    expect(type).toHaveFocus();
  });

  it('shows a form error with the API detail when no issue names a shown field', async () => {
    renderForm({
      record: () =>
        jsonResponse(
          { error: { message: 'Invalid request body', issues: [{ path: '', message: 'Bad' }] } },
          { status: 400 },
        ),
    });

    await chooseType('Baja');
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Sin arreglo');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    const alert = await screen.findByText('Los datos no son válidos. Revise el formulario.');
    const box = alert.closest('[role="alert"]');
    expect(box).toHaveTextContent('Detalle: Invalid request body');
    expect(box).toHaveFocus();
  });

  it('focuses the retry button when the destination is invalid and the locations failed', async () => {
    renderForm({
      locations: () => jsonResponse({ error: { message: 'Boom' } }, { status: 500 }),
    });

    await chooseType('Traslado');
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Mudanza');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    expect(screen.getByRole('combobox', { name: 'Ubicación de destino' })).toBeDisabled();
    expect(retry).toHaveFocus();
  });

  it('focuses a form alert when the destination is invalid while the locations load', async () => {
    renderForm({ locations: () => new Promise<Response>(() => {}) });

    await chooseType('Traslado');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Mudanza');
    await userEvent.click(screen.getByRole('button', SUBMIT));

    const alert = await screen.findByText(
      'Las opciones todavía se están cargando. Espere un momento e intente de nuevo.',
    );
    expect(alert.closest('[role="alert"]')).toHaveFocus();
  });

  it('cancels back to the detail, keeping the list filters', async () => {
    renderForm({ state: { listSearch: 'type=FREEZER' } });

    const cancel = await screen.findByRole('link', { name: 'Cancelar' });
    expect(cancel).toHaveAttribute('href', `/equipos/${ITEM.id}`);
    await userEvent.click(cancel);
    expect(await screen.findByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos?type=FREEZER',
    );
  });

  it('has no form for retired equipment', async () => {
    renderForm({ item: makeEquipment({ status: 'RETIRED' }) });

    expect(
      await screen.findByText('Este equipo está dado de baja y no admite eventos.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al equipo' })).toHaveAttribute(
      'href',
      `/equipos/${makeEquipment().id}`,
    );
  });

  it('shows "Equipo no encontrado" for a missing id', async () => {
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/locations': () => jsonResponse([]),
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/equipos/44444444-4444-4444-8444-444444444444/eventos/nuevo'],
    });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Equipo no encontrado' }),
    ).toBeInTheDocument();
  });

  it('does not request anything for a malformed id', async () => {
    const fetchMock = stubApi({ '/api/health': () => jsonResponse({ status: 'ok' }) });
    const router = createMemoryRouter(routes, { initialEntries: ['/equipos/abc/eventos/nuevo'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Equipo no encontrado' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/equipment'))).toBe(
      false,
    );
  });
});
