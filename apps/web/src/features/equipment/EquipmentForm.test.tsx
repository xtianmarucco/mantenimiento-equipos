import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { LOCATION_CENTRO, LOCATION_KIOSCO, makeEquipment } from '../../test/fixtures';
import { EquipmentForm, type EquipmentFormProps } from './EquipmentForm';
import { EMPTY_FORM_VALUES, formValuesFromEquipment } from './equipmentFormModel';

function renderForm(overrides: Partial<EquipmentFormProps> = {}) {
  const props: EquipmentFormProps = {
    mode: 'create',
    values: EMPTY_FORM_VALUES,
    errors: {},
    formError: undefined,
    locations: { status: 'success', data: [LOCATION_CENTRO, LOCATION_KIOSCO] },
    saving: false,
    focusRequest: null,
    cancelTo: '/equipos',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  // Links need a router; the form itself does not navigate.
  const router = createMemoryRouter([{ path: '*', element: <EquipmentForm {...props} /> }]);
  render(<RouterProvider router={router} />);
  return props;
}

describe('EquipmentForm', () => {
  it('renders the values of an item with labelled controls', () => {
    const item = makeEquipment({
      serialNumber: 'SN-9',
      warrantyUntil: '2027-01-15',
      notes: 'Hola',
    });
    renderForm({ mode: 'edit', values: formValuesFromEquipment(item) });

    expect(screen.getByRole('textbox', { name: 'Código' })).toHaveValue('EQ-0001');
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Freezer horizontal');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('FREEZER');
    expect(screen.getByRole('textbox', { name: 'Marca' })).toHaveValue('Inelro');
    expect(screen.getByRole('textbox', { name: 'Modelo' })).toHaveValue('FIH-350');
    expect(screen.getByRole('textbox', { name: 'Número de serie (opcional)' })).toHaveValue('SN-9');
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('2025-01-15');
    expect(screen.getByLabelText('Garantía hasta (opcional)')).toHaveValue('2027-01-15');
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('OPERATIONAL');
    expect(screen.getByRole('combobox', { name: 'Ubicación' })).toHaveValue(LOCATION_CENTRO.id);
    expect(screen.getByRole('textbox', { name: 'Notas (opcional)' })).toHaveValue('Hola');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('has no status field when creating', () => {
    renderForm();

    expect(screen.queryByRole('combobox', { name: 'Estado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear equipo' })).toBeInTheDocument();
  });

  it('groups the locations by kind', () => {
    renderForm();

    const select = screen.getByRole('combobox', { name: 'Ubicación' });
    const groups = within(select).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('label'))).toEqual([
      'Locales propios',
      'Kioscos',
    ]);
    expect(within(groups[1]!).getByRole('option')).toHaveTextContent('Kiosco Plaza');
  });

  it('offers a retry when the locations fail to load', async () => {
    const onRetryLocations = vi.fn();
    renderForm({
      locations: { status: 'error', message: 'Boom', httpStatus: 500 },
      onRetryLocations,
    });

    const select = screen.getByRole('combobox', { name: 'Ubicación' });
    expect(select).toBeDisabled();
    expect(
      within(select).getByRole('option', { name: 'No se pudieron cargar las ubicaciones.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetryLocations).toHaveBeenCalledTimes(1);
  });

  it('reports edits per field', async () => {
    const props = renderForm();

    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'A');
    expect(props.onChange).toHaveBeenLastCalledWith('name', 'A');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Vitrina');
    expect(props.onChange).toHaveBeenLastCalledWith('type', 'DISPLAY_CASE');
  });

  it('shows field errors linked to their controls', () => {
    renderForm({
      errors: {
        code: 'Ya existe un equipo con ese código.',
        warrantyUntil: 'La garantía no puede terminar antes de la fecha de compra.',
      },
    });

    const code = screen.getByRole('textbox', { name: 'Código' });
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription(/Ya existe un equipo con ese código\./);
    const warranty = screen.getByLabelText('Garantía hasta (opcional)');
    expect(warranty).toHaveAttribute('aria-invalid', 'true');
    expect(warranty).toHaveAccessibleDescription(
      'La garantía no puede terminar antes de la fecha de compra.',
    );
    expect(screen.getByRole('textbox', { name: 'Nombre' })).not.toHaveAttribute('aria-invalid');
  });

  it('focuses the requested field', () => {
    renderForm({
      errors: { brand: 'Este campo es obligatorio.' },
      focusRequest: { target: 'brand', seq: 1 },
    });

    expect(screen.getByRole('textbox', { name: 'Marca' })).toHaveFocus();
  });

  it('shows and focuses a form error', () => {
    renderForm({
      formError: { message: 'No se pudo guardar el equipo.', detail: 'Internal server error' },
      focusRequest: { target: 'form', seq: 1 },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar el equipo.');
    expect(alert).toHaveTextContent('Detalle: Internal server error');
    expect(alert).toHaveFocus();
  });

  it('submits through onSubmit', async () => {
    const props = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables submit while saving', () => {
    renderForm({ saving: true });

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
