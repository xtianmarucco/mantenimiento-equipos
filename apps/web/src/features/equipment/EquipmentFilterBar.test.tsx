import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LOCATION_CENTRO, LOCATION_KIOSCO } from '../../test/fixtures';
import { EquipmentFilterBar } from './EquipmentFilterBar';

const LOCATIONS = [LOCATION_CENTRO, LOCATION_KIOSCO].map(({ id, name }) => ({ id, name }));

describe('EquipmentFilterBar', () => {
  it('offers labelled status, location and type filters', () => {
    render(
      <EquipmentFilterBar
        filters={{}}
        locations={{ status: 'success', data: LOCATIONS }}
        onChange={vi.fn()}
      />,
    );

    const status = screen.getByRole('combobox', { name: 'Estado' });
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Todos los activos',
      'Operativo',
      'En reparación',
      'Fuera de servicio',
      'Dados de baja',
    ]);
    expect(status).toHaveValue('');

    const location = screen.getByRole('combobox', { name: 'Ubicación' });
    expect(
      within(location)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todas las ubicaciones', 'Heladería Centro', 'Kiosco Plaza']);

    const type = screen.getByRole('combobox', { name: 'Tipo' });
    expect(
      within(type)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todos los tipos', 'Freezer', 'Heladera', 'Vitrina', 'Máquina de helado', 'Otro']);
  });

  it('reflects the current filters', () => {
    render(
      <EquipmentFilterBar
        filters={{ status: 'RETIRED', locationId: LOCATION_KIOSCO.id, type: 'OTHER' }}
        locations={{ status: 'success', data: LOCATIONS }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('RETIRED');
    expect(screen.getByRole('combobox', { name: 'Ubicación' })).toHaveValue(LOCATION_KIOSCO.id);
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('OTHER');
  });

  it('reports the next filters, clearing a filter set back to its "all" option', async () => {
    const onChange = vi.fn();
    render(
      <EquipmentFilterBar
        filters={{ status: 'RETIRED', type: 'FREEZER' }}
        locations={{ status: 'success', data: LOCATIONS }}
        onChange={onChange}
      />,
    );

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Ubicación' }),
      'Kiosco Plaza',
    );
    expect(onChange).toHaveBeenLastCalledWith({
      status: 'RETIRED',
      type: 'FREEZER',
      locationId: LOCATION_KIOSCO.id,
    });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'Todos los activos',
    );
    expect(onChange).toHaveBeenLastCalledWith({ status: undefined, type: 'FREEZER' });
  });

  it('keeps an unknown location filter visible and clearable', async () => {
    const unknownId = '99999999-9999-4999-8999-999999999999';
    const onChange = vi.fn();
    render(
      <EquipmentFilterBar
        filters={{ locationId: unknownId }}
        locations={{ status: 'success', data: LOCATIONS }}
        onChange={onChange}
      />,
    );

    const location = screen.getByRole('combobox', { name: 'Ubicación' });
    expect(location).toHaveValue(unknownId);
    expect(within(location).getByRole('option', { selected: true })).toHaveTextContent(
      'Ubicación desconocida',
    );

    await userEvent.selectOptions(location, 'Todas las ubicaciones');
    expect(onChange).toHaveBeenLastCalledWith({ locationId: undefined });
  });

  it('keeps a location filter clearable when locations cannot be loaded', async () => {
    const onChange = vi.fn();
    render(
      <EquipmentFilterBar
        filters={{ locationId: LOCATION_KIOSCO.id }}
        locations={{ status: 'error' }}
        onChange={onChange}
      />,
    );

    const location = screen.getByRole('combobox', { name: 'Ubicación' });
    expect(location).toBeEnabled();
    expect(location).toHaveValue(LOCATION_KIOSCO.id);
    expect(within(location).getByRole('option', { selected: true })).toHaveTextContent(
      'Ubicación seleccionada',
    );

    await userEvent.selectOptions(location, 'Todas las ubicaciones');
    expect(onChange).toHaveBeenLastCalledWith({ locationId: undefined });
  });

  it('disables the location filter while locations load', () => {
    render(
      <EquipmentFilterBar filters={{}} locations={{ status: 'loading' }} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('combobox', { name: 'Ubicación' })).toBeDisabled();
  });

  it('explains when locations cannot be loaded', () => {
    render(<EquipmentFilterBar filters={{}} locations={{ status: 'error' }} onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Ubicación' })).toBeDisabled();
    expect(screen.getByText('No se pudieron cargar las ubicaciones.')).toBeInTheDocument();
  });
});
