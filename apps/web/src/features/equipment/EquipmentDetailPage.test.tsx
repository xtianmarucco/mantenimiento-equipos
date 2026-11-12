import type { EquipmentEventResponse } from '@mantenimiento/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '../../app/routes';
import {
  jsonResponse,
  LOCATION_CENTRO,
  LOCATION_KIOSCO,
  makeEquipment,
  requestedPaths,
  sentBodies,
  stubApi,
} from '../../test/fixtures';
import { todayIsoDate } from './dates';

const ITEM = makeEquipment({
  serialNumber: 'SN-123',
  warrantyUntil: '2099-12-31',
  locationId: LOCATION_KIOSCO.id,
  notes: 'Compresor revisado',
});
const DETAIL_PATH = `/api/equipment/${ITEM.id}`;
const EVENTS_PATH = `${DETAIL_PATH}/events`;

const TRANSFER: EquipmentEventResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  equipmentId: ITEM.id,
  type: 'TRANSFER',
  occurredOn: '2026-10-20',
  description: 'Mudanza al kiosco',
  technician: null,
  cost: null,
  resultingStatus: null,
  fromLocationId: LOCATION_CENTRO.id,
  toLocationId: LOCATION_KIOSCO.id,
  replacementEquipmentId: null,
  createdAt: '2026-10-20T15:00:00.000Z',
};

function retirementOf(item: typeof ITEM, description: string) {
  return {
    event: {
      ...TRANSFER,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      type: 'RETIREMENT',
      occurredOn: todayIsoDate(new Date()),
      description,
      fromLocationId: null,
      toLocationId: null,
    },
    equipment: { ...item, status: 'RETIRED' },
  };
}

function renderDetail(
  item = ITEM,
  {
    initialEntry = { pathname: `/equipos/${item.id}` } as { pathname: string; state?: unknown },
    record = (init: RequestInit | undefined): Response => {
      const body = JSON.parse(String(init?.body)) as { description: string };
      return jsonResponse(retirementOf(item, body.description), { status: 201 });
    },
    events = (): Response => jsonResponse([]),
    detail = (): Response => jsonResponse(item),
  } = {},
) {
  const fetchMock = stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/locations': () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
    [`/api/equipment/${item.id}`]: detail,
    [`/api/equipment/${item.id}/events`]: (init) =>
      init?.method === 'POST' ? record(init) : events(),
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  render(<RouterProvider router={router} />);
  return { fetchMock, router };
}

/** Answers the item on the first load and `afterRetire` on every later one. */
function detailThen(afterRetire: () => Response): () => Response {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? jsonResponse(ITEM) : afterRetire();
  };
}

async function confirmRetirement(reasonText = 'Sin arreglo') {
  await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });
  await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), reasonText);
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
}

function fieldValue(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`No value for ${label}`);
  }
  return value;
}

describe('EquipmentDetailPage', () => {
  it('shows every field with Spanish labels', async () => {
    renderDetail();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' }),
    ).toBeInTheDocument();
    expect(fieldValue('Código')).toHaveTextContent('EQ-0001');
    expect(fieldValue('Estado')).toHaveTextContent('Operativo');
    expect(fieldValue('Tipo')).toHaveTextContent('Freezer');
    expect(fieldValue('Marca')).toHaveTextContent('Inelro');
    expect(fieldValue('Modelo')).toHaveTextContent('FIH-350');
    expect(fieldValue('Número de serie')).toHaveTextContent('SN-123');
    expect(fieldValue('Fecha de compra')).toHaveTextContent('15/01/2025');
    expect(fieldValue('Garantía hasta')).toHaveTextContent('31/12/2099');
    expect(fieldValue('Garantía hasta')).toHaveTextContent('En garantía');
    await waitFor(() => expect(fieldValue('Ubicación')).toHaveTextContent('Kiosco Plaza (Kiosco)'));
    expect(fieldValue('Notas')).toHaveTextContent('Compresor revisado');
    expect(fieldValue('Creado').querySelector('time')).toHaveAttribute('datetime', ITEM.createdAt);
    expect(fieldValue('Actualizado').querySelector('time')).toHaveAttribute(
      'datetime',
      ITEM.updatedAt,
    );
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `/equipos/${ITEM.id}/editar`,
    );
  });

  it('marks an expired warranty and shows placeholders for empty optional fields', async () => {
    renderDetail(
      makeEquipment({ warrantyUntil: '2020-01-31', purchaseDate: '2019-01-31', notes: null }),
    );

    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });
    expect(fieldValue('Garantía hasta')).toHaveTextContent('Garantía vencida');
    expect(fieldValue('Número de serie')).toHaveTextContent('No informado');
    expect(fieldValue('Notas')).toHaveTextContent('Sin notas');
    await waitFor(() =>
      expect(fieldValue('Ubicación')).toHaveTextContent('Heladería Centro (Local propio)'),
    );
  });

  it('shows when no warranty is recorded', async () => {
    renderDetail(makeEquipment());

    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });
    expect(fieldValue('Garantía hasta')).toHaveTextContent('Sin garantía registrada');
  });

  it('links back to the list with the filters it came from', async () => {
    renderDetail(ITEM, {
      initialEntry: { pathname: `/equipos/${ITEM.id}`, state: { listSearch: 'status=IN_REPAIR' } },
    });

    expect(await screen.findByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos?status=IN_REPAIR',
    );
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `/equipos/${ITEM.id}/editar`,
    );
  });

  it('links to the event form, keeping the list filters', async () => {
    const { router } = renderDetail(ITEM, {
      initialEntry: { pathname: `/equipos/${ITEM.id}`, state: { listSearch: 'type=FREEZER' } },
    });

    const link = await screen.findByRole('link', { name: 'Registrar evento' });
    expect(link).toHaveAttribute('href', `/equipos/${ITEM.id}/eventos/nuevo`);
    await userEvent.click(link);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${ITEM.id}/eventos/nuevo`),
    );
    expect(router.state.location.state).toEqual({ listSearch: 'type=FREEZER' });
  });

  it('retires the equipment with a reason, only after confirmation', async () => {
    const { fetchMock } = renderDetail();
    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Dar de baja este equipo?' });
    expect(dialog).toHaveTextContent('La baja es definitiva');
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), ' Sin arreglo posible ');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    await waitFor(() => expect(fieldValue('Estado')).toHaveTextContent('Dado de baja'));
    expect(sentBodies(fetchMock, 'POST')).toEqual([
      {
        type: 'RETIREMENT',
        occurredOn: todayIsoDate(new Date()),
        description: 'Sin arreglo posible',
      },
    ]);
    expect(requestedPaths(fetchMock)).not.toContain(`${DETAIL_PATH}/retire`);
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar evento' })).not.toBeInTheDocument();
    expect(screen.getByText('El equipo fue dado de baja.')).toHaveAttribute('role', 'status');
  });

  it('asks for the reason before retiring', async () => {
    const { fetchMock } = renderDetail();
    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    const reason = screen.getByRole('textbox', { name: 'Motivo' });
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAccessibleDescription('Ingrese el motivo.');
    expect(reason).toHaveFocus();
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);

    await userEvent.type(reason, 'x');
    expect(reason).not.toHaveAttribute('aria-invalid');
  });

  it('keeps the confirmation open with an error when retiring fails', async () => {
    const { fetchMock } = renderDetail(ITEM, {
      record: () => jsonResponse({ error: { message: 'Internal server error' } }, { status: 500 }),
    });
    await confirmRetirement();

    const dialog = screen.getByRole('alertdialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No se pudo dar de baja el equipo. Intente de nuevo.',
    );
    expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveValue('Sin arreglo');
    expect(fieldValue('Estado')).toHaveTextContent('Operativo');
    // The failure was confirmed by reloading the item, which is still not retired.
    expect(requestedPaths(fetchMock).filter((path) => path === DETAIL_PATH)).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: 'Confirmar baja' })).toBeEnabled();
  });

  it('shows the failure when the reload after a failed retirement also fails', async () => {
    renderDetail(ITEM, {
      record: () => jsonResponse({ error: { message: 'Internal server error' } }, { status: 500 }),
      detail: detailThen(() => jsonResponse({ error: { message: 'Boom' } }, { status: 500 })),
    });
    await confirmRetirement();

    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent(
      'No se pudo dar de baja el equipo. Intente de nuevo.',
    );
    expect(fieldValue('Estado')).toHaveTextContent('Operativo');
  });

  it('treats a failed retirement as done when the reloaded equipment is retired', async () => {
    const { fetchMock } = renderDetail(ITEM, {
      // The retirement was stored but its response was lost.
      record: () => jsonResponse({ error: { message: 'Bad gateway' } }, { status: 502 }),
      detail: detailThen(() => jsonResponse({ ...ITEM, status: 'RETIRED' })),
    });
    await confirmRetirement();

    expect(await screen.findByText('El equipo fue dado de baja.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(fieldValue('Estado')).toHaveTextContent('Dado de baja');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) => String(input) === EVENTS_PATH && init?.method === undefined,
        ),
      ).toHaveLength(2),
    );
  });

  it('treats the "already retired" rejection of a repeated retirement as done', async () => {
    const { fetchMock } = renderDetail(ITEM, {
      record: () =>
        jsonResponse(
          {
            error: {
              message: 'Validation failed',
              issues: [{ path: 'type', message: 'Retired equipment accepts no events' }],
            },
          },
          { status: 400 },
        ),
      detail: detailThen(() => jsonResponse({ ...ITEM, status: 'RETIRED' })),
    });
    await confirmRetirement();

    expect(await screen.findByText('El equipo fue dado de baja.')).toBeInTheDocument();
    expect(fieldValue('Estado')).toHaveTextContent('Dado de baja');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(sentBodies(fetchMock, 'POST')).toHaveLength(1);
  });

  it('shows the date validation message instead of a retry when today is before the purchase date', async () => {
    const future = makeEquipment({ purchaseDate: '2099-01-01' });
    const { fetchMock } = renderDetail(future);
    await confirmRetirement();

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'La fecha no puede ser anterior a la fecha de compra.',
    );
    expect(dialog).not.toHaveTextContent('Intente de nuevo');
    expect(
      within(dialog).queryByRole('button', { name: 'Confirmar baja' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(sentBodies(fetchMock, 'POST')).toEqual([]);
  });

  it('focuses the confirmation, not the reason, when it reopens after a reason error', async () => {
    renderDetail();
    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));

    expect(screen.getByRole('alertdialog')).toHaveFocus();
  });

  it('shows the event history with the transfer location names', async () => {
    renderDetail(ITEM, { events: () => jsonResponse([TRANSFER]) });

    const history = await screen.findByRole('region', { name: 'Historial' });
    const item = await within(history).findByRole('listitem');
    expect(item).toHaveTextContent('Traslado');
    expect(item).toHaveTextContent('Mudanza al kiosco');
    await waitFor(() => expect(item).toHaveTextContent('Heladería Centro'));
    expect(item).toHaveTextContent('Kiosco Plaza');
  });

  it('keeps the detail when the history fails, and retries it', async () => {
    let calls = 0;
    const { fetchMock } = renderDetail(ITEM, {
      events: () => {
        calls += 1;
        return calls === 1
          ? jsonResponse({ error: { message: 'Boom' } }, { status: 500 })
          : jsonResponse([TRANSFER]);
      },
    });

    const alert = await screen.findByText('No se pudo cargar el historial.');
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(fieldValue('Código')).toHaveTextContent('EQ-0001');
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Mudanza al kiosco')).toBeInTheDocument();
    expect(screen.queryByText('No se pudo cargar el historial.')).not.toBeInTheDocument();
    expect(requestedPaths(fetchMock).filter((path) => path === EVENTS_PATH)).toHaveLength(2);
  });

  it('reloads the history after retiring', async () => {
    const { fetchMock } = renderDetail();
    expect(await screen.findByText('Todavía no hay eventos registrados.')).toBeInTheDocument();
    expect(requestedPaths(fetchMock).filter((path) => path === EVENTS_PATH)).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Sin arreglo');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) => String(input) === EVENTS_PATH && init?.method === undefined,
        ),
      ).toHaveLength(2),
    );
  });

  it('offers no retire action for retired equipment', async () => {
    renderDetail(makeEquipment({ status: 'RETIRED' }));

    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar evento' })).not.toBeInTheDocument();
    expect(screen.getByText('Este equipo está dado de baja.')).toBeInTheDocument();
  });

  it('shows "Equipo no encontrado" for a missing id', async () => {
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/locations': () => jsonResponse([]),
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/equipos/44444444-4444-4444-8444-444444444444'],
    });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Equipo no encontrado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a equipos' })).toHaveAttribute(
      'href',
      '/equipos',
    );
  });

  it('shows "Equipo no encontrado" for an id that is not a uuid, without requesting it', async () => {
    const fetchMock = stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/locations': () => jsonResponse([]),
    });
    const router = createMemoryRouter(routes, { initialEntries: ['/equipos/abc'] });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Equipo no encontrado' }),
    ).toBeInTheDocument();
    expect(requestedPaths(fetchMock).some((path) => path.startsWith('/api/equipment'))).toBe(false);
  });

  it('shows a load error for other failures', async () => {
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/locations': () => jsonResponse([]),
      [DETAIL_PATH]: () => jsonResponse({ error: { message: 'Boom' } }, { status: 500 }),
    });
    const router = createMemoryRouter(routes, { initialEntries: [`/equipos/${ITEM.id}`] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el equipo. Intente de nuevo más tarde.',
    );
  });

  it('shows a load error for the location instead of an unknown location', async () => {
    stubApi({
      '/api/health': () => jsonResponse({ status: 'ok' }),
      '/api/locations': () => jsonResponse({ error: { message: 'Boom' } }, { status: 500 }),
      [DETAIL_PATH]: () => jsonResponse(ITEM),
    });
    const router = createMemoryRouter(routes, { initialEntries: [`/equipos/${ITEM.id}`] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('No se pudo cargar la ubicación.')).toBeInTheDocument();
    expect(screen.queryByText('Ubicación desconocida')).not.toBeInTheDocument();
  });
});
