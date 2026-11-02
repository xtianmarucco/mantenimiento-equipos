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
  stubApi,
} from '../../test/fixtures';

const ITEM = makeEquipment({
  serialNumber: 'SN-123',
  warrantyUntil: '2099-12-31',
  locationId: LOCATION_KIOSCO.id,
  notes: 'Compresor revisado',
});
const DETAIL_PATH = `/api/equipment/${ITEM.id}`;

function renderDetail(
  item = ITEM,
  {
    initialEntry = { pathname: `/equipos/${item.id}` } as { pathname: string; state?: unknown },
    retire = () => jsonResponse({ ...item, status: 'RETIRED' }),
  } = {},
) {
  const fetchMock = stubApi({
    '/api/health': () => jsonResponse({ status: 'ok' }),
    '/api/locations': () => jsonResponse([LOCATION_CENTRO, LOCATION_KIOSCO]),
    [`/api/equipment/${item.id}`]: () => jsonResponse(item),
    [`/api/equipment/${item.id}/retire`]: retire,
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  render(<RouterProvider router={router} />);
  return { fetchMock, router };
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

  it('retires the equipment only after confirmation', async () => {
    const { fetchMock } = renderDetail();
    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Dar de baja este equipo?' });
    expect(requestedPaths(fetchMock)).not.toContain(`${DETAIL_PATH}/retire`);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(requestedPaths(fetchMock)).not.toContain(`${DETAIL_PATH}/retire`);

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    await waitFor(() => expect(fieldValue('Estado')).toHaveTextContent('Dado de baja'));
    expect(requestedPaths(fetchMock).filter((path) => path.endsWith('/retire'))).toEqual([
      `${DETAIL_PATH}/retire`,
    ]);
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
    expect(screen.getByText('El equipo fue dado de baja.')).toHaveAttribute('role', 'status');
  });

  it('keeps the confirmation open with an error when retiring fails', async () => {
    renderDetail(ITEM, {
      retire: () => jsonResponse({ error: { message: 'Internal server error' } }, { status: 500 }),
    });
    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo dar de baja el equipo. Intente de nuevo.',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(fieldValue('Estado')).toHaveTextContent('Operativo');
  });

  it('offers no retire action for retired equipment', async () => {
    renderDetail(makeEquipment({ status: 'RETIRED' }));

    await screen.findByRole('heading', { level: 2, name: 'Freezer horizontal' });
    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
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
