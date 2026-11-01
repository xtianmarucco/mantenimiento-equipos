import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LOCATION_CENTRO, makeEquipment } from '../../test/fixtures';
import { EquipmentList } from './EquipmentList';

const LOCATION_NAMES = new Map([[LOCATION_CENTRO.id, LOCATION_CENTRO.name]]);

function renderList(props: Parameters<typeof EquipmentList>[0]) {
  return render(
    <MemoryRouter>
      <EquipmentList {...props} />
    </MemoryRouter>,
  );
}

describe('EquipmentList', () => {
  it('announces loading', () => {
    renderList({ state: { status: 'loading' }, locationNames: LOCATION_NAMES });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando equipos');
  });

  it('shows an empty message when there are no items', () => {
    renderList({ state: { status: 'success', data: [] }, locationNames: LOCATION_NAMES });

    expect(screen.getByText('No hay equipos para estos filtros')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error alert with the API message when present', () => {
    renderList({
      state: { status: 'error', message: 'Database unavailable' },
      locationNames: LOCATION_NAMES,
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los equipos.');
    expect(alert).toHaveTextContent('Database unavailable');
  });

  it('shows a generic error alert without an API message', () => {
    renderList({ state: { status: 'error' }, locationNames: LOCATION_NAMES });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los equipos. Intente de nuevo más tarde.',
    );
  });

  it('renders each item with name, code, status, type and location, linking to its detail', () => {
    const freezer = makeEquipment();
    const vitrina = makeEquipment({
      id: '44444444-4444-4444-8444-444444444444',
      code: 'EQ-0002',
      name: 'Vitrina de tortas',
      type: 'DISPLAY_CASE',
      status: 'IN_REPAIR',
      locationId: '99999999-9999-4999-8999-999999999999',
    });

    renderList({
      state: { status: 'success', data: [freezer, vitrina] },
      locationNames: LOCATION_NAMES,
    });

    const items = within(screen.getByRole('list', { name: 'Equipos' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const [first, second] = items as [HTMLElement, HTMLElement];
    const firstLink = within(first).getByRole('link');
    expect(firstLink).toHaveAttribute('href', `/equipos/${freezer.id}`);
    expect(firstLink).toHaveAccessibleName(/Freezer horizontal/);
    expect(first).toHaveTextContent('EQ-0001');
    expect(first).toHaveTextContent('Estado: Operativo');
    expect(first).toHaveTextContent('Freezer');
    expect(first).toHaveTextContent('Heladería Centro');

    expect(second).toHaveTextContent('Estado: En reparación');
    expect(second).toHaveTextContent('Vitrina');
    expect(second).toHaveTextContent('Ubicación desconocida');
  });
});
