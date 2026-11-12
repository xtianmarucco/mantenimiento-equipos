import type { EquipmentEventResponse, LocationResponse } from '@mantenimiento/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { ResourceState } from '../../shared/hooks/useResource';
import { LOCATION_CENTRO, LOCATION_KIOSCO, makeEquipment } from '../../test/fixtures';
import { EquipmentEventHistory } from './EquipmentEventHistory';

const EQUIPMENT_ID = makeEquipment().id;
const REPLACEMENT_ID = '55555555-5555-4555-8555-555555555555';

function makeEvent(overrides: Partial<EquipmentEventResponse> = {}): EquipmentEventResponse {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    equipmentId: EQUIPMENT_ID,
    type: 'MAINTENANCE',
    occurredOn: '2026-10-20',
    description: 'Limpieza de condensador',
    technician: null,
    cost: null,
    resultingStatus: null,
    fromLocationId: null,
    toLocationId: null,
    replacementEquipmentId: null,
    createdAt: '2026-10-20T15:00:00.000Z',
    ...overrides,
  };
}

const LOCATIONS: ResourceState<LocationResponse[]> = {
  status: 'success',
  data: [LOCATION_CENTRO, LOCATION_KIOSCO],
};

function renderHistory(
  events: ResourceState<EquipmentEventResponse[]>,
  { locations = LOCATIONS, onRetry = vi.fn() } = {},
) {
  render(
    <MemoryRouter>
      <EquipmentEventHistory events={events} locations={locations} onRetry={onRetry} />
    </MemoryRouter>,
  );
  return { onRetry };
}

function renderEvent(event: EquipmentEventResponse, options?: Parameters<typeof renderHistory>[1]) {
  renderHistory({ status: 'success', data: [event] }, options);
  return screen.getByRole('listitem');
}

/** The `<dd>` next to the `<dt>` with `label`, inside `scope`. */
function detail(scope: HTMLElement, label: string): HTMLElement {
  const term = within(scope).getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`No value for ${label}`);
  }
  return value;
}

describe('EquipmentEventHistory', () => {
  it('has a "Historial" heading', () => {
    renderHistory({ status: 'success', data: [] });

    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument();
  });

  it('shows a loading status', () => {
    renderHistory({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando historial…');
  });

  it('shows an empty state when there are no events', () => {
    renderHistory({ status: 'success', data: [] });

    expect(screen.getByText('Todavía no hay eventos registrados.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error with a retry button', async () => {
    const { onRetry } = renderHistory({ status: 'error', httpStatus: 500 });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar el historial.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists the events in the order given, with type, date and description', () => {
    renderHistory({
      status: 'success',
      data: [
        makeEvent({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
          type: 'RETIREMENT',
          occurredOn: '2026-11-05',
          description: 'Sin arreglo posible',
        }),
        makeEvent(),
      ],
    });

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Baja');
    expect(items[0]).toHaveTextContent('05/11/2026');
    expect(items[0]).toHaveTextContent('Sin arreglo posible');
    expect(items[0]?.querySelector('time')).toHaveAttribute('datetime', '2026-11-05');
    expect(items[1]).toHaveTextContent('Mantenimiento');
    expect(items[1]).toHaveTextContent('20/10/2026');
    expect(items[1]).toHaveTextContent('Limpieza de condensador');
  });

  it.each([
    ['MAINTENANCE', 'Mantenimiento'],
    ['BREAKDOWN', 'Rotura'],
    ['REPAIR', 'Reparación'],
    ['TRANSFER', 'Traslado'],
    ['REPLACEMENT', 'Cambio'],
    ['RETIREMENT', 'Baja'],
  ] as const)('labels %s as "%s"', (type, label) => {
    const item = renderEvent(makeEvent({ type }));

    expect(item).toHaveTextContent(label);
  });

  it('shows the technician and the cost in ARS for maintenance', () => {
    const item = renderEvent(makeEvent({ technician: 'Juan Pérez', cost: 1234.5 }));

    expect(detail(item, 'Técnico')).toHaveTextContent('Juan Pérez');
    expect(detail(item, 'Costo')).toHaveTextContent('$ 1.234,50');
  });

  it('shows a zero cost for a repair', () => {
    const item = renderEvent(makeEvent({ type: 'REPAIR', cost: 0 }));

    expect(detail(item, 'Costo')).toHaveTextContent('$ 0,00');
    expect(within(item).queryByText('Técnico')).not.toBeInTheDocument();
  });

  it('shows no details when the event has none', () => {
    const item = renderEvent(makeEvent());

    expect(within(item).queryByRole('term')).not.toBeInTheDocument();
  });

  it('shows the resulting status of a breakdown', () => {
    const item = renderEvent(makeEvent({ type: 'BREAKDOWN', resultingStatus: 'OUT_OF_SERVICE' }));

    expect(detail(item, 'Estado resultante')).toHaveTextContent('Fuera de servicio');
  });

  it('shows the location names of a transfer', () => {
    const item = renderEvent(
      makeEvent({
        type: 'TRANSFER',
        fromLocationId: LOCATION_CENTRO.id,
        toLocationId: LOCATION_KIOSCO.id,
      }),
    );

    expect(detail(item, 'Desde')).toHaveTextContent('Heladería Centro');
    expect(detail(item, 'Hacia')).toHaveTextContent('Kiosco Plaza');
  });

  it('falls back to "Ubicación desconocida" for a location that is not in the list', () => {
    const item = renderEvent(
      makeEvent({
        type: 'TRANSFER',
        fromLocationId: '66666666-6666-4666-8666-666666666666',
        toLocationId: LOCATION_KIOSCO.id,
      }),
    );

    expect(detail(item, 'Desde')).toHaveTextContent('Ubicación desconocida');
    expect(detail(item, 'Hacia')).toHaveTextContent('Kiosco Plaza');
  });

  it('says the transfer locations could not be loaded when the locations failed', () => {
    const item = renderEvent(
      makeEvent({
        type: 'TRANSFER',
        fromLocationId: LOCATION_CENTRO.id,
        toLocationId: LOCATION_KIOSCO.id,
      }),
      { locations: { status: 'error' } },
    );

    expect(detail(item, 'Desde')).toHaveTextContent('No se pudo cargar la ubicación.');
    expect(within(item).queryByText('Ubicación desconocida')).not.toBeInTheDocument();
  });

  it('links to the replacement equipment', () => {
    const item = renderEvent(
      makeEvent({ type: 'REPLACEMENT', replacementEquipmentId: REPLACEMENT_ID }),
    );

    expect(within(item).getByRole('link', { name: 'Ver equipo de reemplazo' })).toHaveAttribute(
      'href',
      `/equipos/${REPLACEMENT_ID}`,
    );
  });

  it('has no replacement link when the replacement is not recorded', () => {
    const item = renderEvent(makeEvent({ type: 'REPLACEMENT' }));

    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
  });
});
