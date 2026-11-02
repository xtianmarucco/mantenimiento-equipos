import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { type LocationResponse } from '@mantenimiento/shared';

import { EMPTY_LOCATION_FORM_VALUES, formValuesFromLocation } from './locationFormModel';
import { LocationForm, type LocationFormProps } from './LocationForm';

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

function renderForm(overrides: Partial<LocationFormProps> = {}) {
  const props: LocationFormProps = {
    mode: 'create',
    values: EMPTY_LOCATION_FORM_VALUES,
    errors: {},
    formError: undefined,
    saving: false,
    focusRequest: null,
    cancelTo: '/ubicaciones',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: '*', element: <LocationForm {...props} /> }]);
  render(<RouterProvider router={router} />);
  return props;
}

describe('LocationForm', () => {
  it('renders the values of a location with labelled controls', () => {
    renderForm({ mode: 'edit', values: formValuesFromLocation(LOCATION) });

    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Heladería Centro');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('OWN_STORE');
    expect(screen.getByRole('textbox', { name: 'Dirección (opcional)' })).toHaveValue(
      'Av. Siempre Viva 742',
    );
    expect(screen.getByRole('textbox', { name: 'Contacto (opcional)' })).toHaveValue('Ana Pérez');
    expect(screen.getByRole('textbox', { name: 'Teléfono (opcional)' })).toHaveValue(
      '+54 11 5555-0101',
    );
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('has no kind selected when creating and offers to create the location', () => {
    renderForm();

    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Crear ubicación' })).toBeInTheDocument();
  });

  it('reports edits per field', async () => {
    const props = renderForm();

    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre' }), 'X');
    expect(props.onChange).toHaveBeenLastCalledWith('name', 'X');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Kiosco');
    expect(props.onChange).toHaveBeenLastCalledWith('kind', 'THIRD_PARTY');
  });

  it('shows field errors linked to their controls', () => {
    renderForm({ errors: { name: 'Este campo es obligatorio.' } });

    const name = screen.getByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(/Este campo es obligatorio\./);
    expect(screen.getByRole('combobox', { name: 'Tipo' })).not.toHaveAttribute('aria-invalid');
  });

  it('focuses the requested field', () => {
    renderForm({
      errors: { phone: 'El número de teléfono no es válido.' },
      focusRequest: { target: 'phone', seq: 1 },
    });

    expect(screen.getByRole('textbox', { name: 'Teléfono (opcional)' })).toHaveFocus();
  });

  it('shows and focuses a form error', () => {
    renderForm({
      formError: { message: 'No se pudo guardar la ubicación.', detail: 'Internal server error' },
      focusRequest: { target: 'form', seq: 1 },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar la ubicación.');
    expect(alert).toHaveTextContent('Detalle: Internal server error');
    expect(alert).toHaveFocus();
  });

  it('submits through onSubmit', async () => {
    const props = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear ubicación' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables submit while saving', () => {
    renderForm({ saving: true });

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
