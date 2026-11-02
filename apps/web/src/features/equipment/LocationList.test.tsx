import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { type LocationResponse } from '@mantenimiento/shared';

import { type ResourceState } from '../../shared/hooks/useResource';
import { LocationList } from './LocationList';

const LOCATION: LocationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. Siempre Viva 742',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

function renderList(props: { state: ResourceState<LocationResponse[]> }) {
  return render(
    <MemoryRouter>
      <LocationList {...props} />
    </MemoryRouter>,
  );
}

describe('LocationList', () => {
  it('announces loading', () => {
    renderList({ state: { status: 'loading' } });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando ubicaciones');
  });

  it('shows an empty message when there are no locations', () => {
    renderList({ state: { status: 'success', data: [] } });

    expect(screen.getByText('No hay ubicaciones registradas.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error alert with the API message when present', () => {
    renderList({
      state: { status: 'error', message: 'Database unavailable' },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar las ubicaciones.');
    expect(alert).toHaveTextContent('Database unavailable');
  });

  it('shows a generic error alert without an API message', () => {
    renderList({ state: { status: 'error' } });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las ubicaciones. Intente de nuevo más tarde.',
    );
  });

  it('renders each location with name, kind, address, contact and phone, linking to the edit page', () => {
    renderList({ state: { status: 'success', data: [LOCATION] } });

    const items = within(screen.getByRole('list', { name: 'Ubicaciones' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(1);

    const item = items[0]!;
    expect(within(item).getByRole('link')).toHaveAttribute(
      'href',
      `/ubicaciones/${LOCATION.id}/editar`,
    );
    expect(within(item).getByText('Heladería Centro')).toBeInTheDocument();
    expect(within(item).getByText('Local propio')).toBeInTheDocument();
    expect(within(item).getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(within(item).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(item).getByText('+54 11 5555-0101')).toBeInTheDocument();
  });
});
