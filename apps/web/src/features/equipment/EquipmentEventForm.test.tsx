import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { LOCATION_CENTRO, LOCATION_KIOSCO, makeEquipment } from '../../test/fixtures';
import { EquipmentEventForm, type EquipmentEventFormProps } from './EquipmentEventForm';
import { initialEventFormValues, type EventFormValues } from './equipmentEventFormModel';

const TODAY = '2026-11-11';
const ITEM = makeEquipment({ locationId: LOCATION_CENTRO.id });
const OTHER = makeEquipment({
  id: '55555555-5555-4555-8555-555555555555',
  code: 'EQ-0002',
  name: 'Vitrina nueva',
});
const RETIRED_OTHER = makeEquipment({
  id: '66666666-6666-4666-8666-666666666666',
  code: 'EQ-0003',
  name: 'Heladera vieja',
  status: 'RETIRED',
});

function renderForm(
  overrides: Partial<EquipmentEventFormProps> = {},
  valueOverrides: Partial<EventFormValues> = {},
) {
  const props: EquipmentEventFormProps = {
    equipment: ITEM,
    values: { ...initialEventFormValues(TODAY), ...valueOverrides },
    errors: {},
    formError: undefined,
    locations: { status: 'success', data: [LOCATION_CENTRO, LOCATION_KIOSCO] },
    replacements: { status: 'success', data: [ITEM, OTHER, RETIRED_OTHER] },
    today: TODAY,
    saving: false,
    focusRequest: null,
    cancelTo: `/equipos/${ITEM.id}`,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: '*', element: <EquipmentEventForm {...props} /> }]);
  render(<RouterProvider router={router} />);
  return props;
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('EquipmentEventForm', () => {
  it('offers the event types valid for an operational item, in Spanish', () => {
    renderForm();

    expect(optionLabels(screen.getByRole('combobox', { name: 'Tipo de evento' }))).toEqual([
      'Seleccione un tipo',
      'Mantenimiento',
      'Rotura',
      'Traslado',
      'Cambio',
      'Baja',
    ]);
  });

  it('offers a repair to an item in repair', () => {
    renderForm({ equipment: makeEquipment({ status: 'IN_REPAIR' }) });

    expect(optionLabels(screen.getByRole('combobox', { name: 'Tipo de evento' }))).toContain(
      'Reparación',
    );
  });

  it('defaults the date to today and does not accept a later one', () => {
    renderForm();

    const date = screen.getByLabelText('Fecha');
    expect(date).toHaveValue(TODAY);
    expect(date).toHaveAttribute('max', TODAY);
  });

  it('shows only the common fields until a type is chosen', () => {
    renderForm();

    expect(screen.getByRole('textbox', { name: 'Descripción' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Técnico (opcional)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Estado resultante' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Ubicación de destino' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Equipo de reemplazo (opcional)' }),
    ).not.toBeInTheDocument();
  });

  it.each(['MAINTENANCE', 'REPAIR'])('asks for the technician and the cost of %s', (type) => {
    renderForm({ equipment: makeEquipment({ status: 'IN_REPAIR' }) }, { type });

    expect(screen.getByRole('textbox', { name: 'Técnico (opcional)' })).toBeInTheDocument();
    const cost = screen.getByRole('textbox', { name: 'Costo (opcional)' });
    expect(cost).toHaveAttribute('inputmode', 'decimal');
    expect(screen.queryByRole('combobox', { name: 'Estado resultante' })).not.toBeInTheDocument();
  });

  it('asks for the resulting status of a breakdown', () => {
    renderForm({}, { type: 'BREAKDOWN' });

    expect(optionLabels(screen.getByRole('combobox', { name: 'Estado resultante' }))).toEqual([
      'Seleccione un estado',
      'En reparación',
      'Fuera de servicio',
    ]);
    expect(screen.queryByRole('textbox', { name: 'Técnico (opcional)' })).not.toBeInTheDocument();
  });

  it('offers every location but the current one as the transfer destination', () => {
    renderForm({}, { type: 'TRANSFER' });

    const select = screen.getByRole('combobox', { name: 'Ubicación de destino' });
    expect(optionLabels(select)).toEqual(['Seleccione una ubicación', 'Kiosco Plaza']);
  });

  it('offers active equipment other than this one as the replacement, or none', () => {
    renderForm({}, { type: 'REPLACEMENT' });

    const select = screen.getByRole('combobox', { name: 'Equipo de reemplazo (opcional)' });
    expect(optionLabels(select)).toEqual(['Sin reemplazo', 'EQ-0002 · Vitrina nueva']);
  });

  it('labels the description "Motivo" for a retirement', () => {
    renderForm({}, { type: 'RETIREMENT' });

    expect(screen.getByRole('textbox', { name: 'Motivo' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Descripción' })).not.toBeInTheDocument();
  });

  it('reports edits per field', async () => {
    const props = renderForm();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de evento' }), 'Baja');
    expect(props.onChange).toHaveBeenLastCalledWith('type', 'RETIREMENT');
    await userEvent.type(screen.getByRole('textbox', { name: 'Descripción' }), 'A');
    expect(props.onChange).toHaveBeenLastCalledWith('description', 'A');
  });

  it('offers a retry when the locations fail to load', async () => {
    const onRetryLocations = vi.fn();
    renderForm({ locations: { status: 'error' }, onRetryLocations }, { type: 'TRANSFER' });

    const select = screen.getByRole('combobox', { name: 'Ubicación de destino' });
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription('No se pudieron cargar las ubicaciones.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetryLocations).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the replacement candidates fail to load', async () => {
    const onRetryReplacements = vi.fn();
    renderForm({ replacements: { status: 'error' }, onRetryReplacements }, { type: 'REPLACEMENT' });

    const select = screen.getByRole('combobox', { name: 'Equipo de reemplazo (opcional)' });
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription('No se pudieron cargar los equipos.');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetryReplacements).toHaveBeenCalledTimes(1);
  });

  it('shows field errors linked to their controls and focuses the requested field', () => {
    renderForm({
      errors: { description: 'Ingrese una descripción.' },
      focusRequest: { target: 'description', seq: 1 },
    });

    const description = screen.getByRole('textbox', { name: 'Descripción' });
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveAccessibleDescription('Ingrese una descripción.');
    expect(description).toHaveFocus();
  });

  it('focuses the retry button when the invalid field is disabled because its options failed', () => {
    renderForm(
      {
        locations: { status: 'error' },
        onRetryLocations: vi.fn(),
        errors: { toLocationId: 'Seleccione la ubicación de destino.' },
        focusRequest: { target: 'toLocationId', seq: 1 },
      },
      { type: 'TRANSFER' },
    );

    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  });

  it('focuses the form error when the invalid field is disabled while its options load', () => {
    renderForm(
      {
        locations: { status: 'loading' },
        errors: { toLocationId: 'Seleccione la ubicación de destino.' },
        formError: { message: 'Las opciones todavía se están cargando.' },
        focusRequest: { target: 'toLocationId', seq: 1 },
      },
      { type: 'TRANSFER' },
    );

    expect(screen.getByRole('combobox', { name: 'Ubicación de destino' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('shows a form error with its detail', () => {
    renderForm({
      formError: { message: 'No se pudo registrar el evento.', detail: 'Internal server error' },
      focusRequest: { target: 'form', seq: 1 },
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudo registrar el evento.');
    expect(alert).toHaveTextContent('Detalle: Internal server error');
    expect(alert).toHaveFocus();
  });

  it('submits through onSubmit', async () => {
    const props = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables submit while saving', () => {
    renderForm({ saving: true });

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
  });
});
