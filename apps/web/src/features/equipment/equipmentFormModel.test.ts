import { describe, expect, it } from 'vitest';

import { LOCATION_CENTRO, LOCATION_KIOSCO, makeEquipment } from '../../test/fixtures';
import { ApiError } from '../../shared/api/client';
import {
  EMPTY_FORM_VALUES,
  formValuesFromEquipment,
  submitErrorFromApi,
  validateCreate,
  validateUpdate,
  type EquipmentFormValues,
} from './equipmentFormModel';

const VALID_VALUES: EquipmentFormValues = {
  ...EMPTY_FORM_VALUES,
  code: ' eq-0100 ',
  name: 'Vitrina nueva',
  type: 'DISPLAY_CASE',
  brand: 'Gafa',
  model: 'V-200',
  purchaseDate: '2026-10-01',
  locationId: LOCATION_CENTRO.id,
};

describe('validateCreate', () => {
  it('returns the normalized input, leaving out blank optional fields and the status', () => {
    const result = validateCreate({ ...VALID_VALUES, serialNumber: '   ', notes: '' });

    expect(result).toEqual({
      ok: true,
      data: {
        code: 'EQ-0100',
        name: 'Vitrina nueva',
        type: 'DISPLAY_CASE',
        brand: 'Gafa',
        model: 'V-200',
        purchaseDate: '2026-10-01',
        locationId: LOCATION_CENTRO.id,
      },
    });
  });

  it('reports Spanish messages for missing required fields', () => {
    const result = validateCreate(EMPTY_FORM_VALUES);

    expect(result).toEqual({
      ok: false,
      errors: {
        code: 'Este campo es obligatorio.',
        name: 'Este campo es obligatorio.',
        type: 'Seleccione un tipo.',
        brand: 'Este campo es obligatorio.',
        model: 'Este campo es obligatorio.',
        purchaseDate: 'Ingrese la fecha de compra.',
        locationId: 'Seleccione una ubicación.',
      },
    });
  });

  it('explains the code format and the warranty rule in Spanish', () => {
    const result = validateCreate({
      ...VALID_VALUES,
      code: 'EQ-42',
      warrantyUntil: '2026-09-30',
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        code: 'El código debe tener 2 a 4 letras, un guion y 4 dígitos, por ejemplo EQ-0042.',
        warrantyUntil: 'La garantía no puede terminar antes de la fecha de compra.',
      },
    });
  });

  it('reports the maximum length in Spanish', () => {
    const result = validateCreate({ ...VALID_VALUES, name: 'x'.repeat(121) });

    expect(result).toEqual({
      ok: false,
      errors: { name: 'Debe tener como máximo 120 caracteres.' },
    });
  });
});

describe('validateUpdate', () => {
  const initial = makeEquipment({
    serialNumber: 'SN-1',
    warrantyUntil: '2027-01-15',
    notes: 'Nota',
  });

  it('round-trips an item into form values', () => {
    expect(formValuesFromEquipment(initial)).toEqual({
      code: 'EQ-0001',
      name: 'Freezer horizontal',
      type: 'FREEZER',
      brand: 'Inelro',
      model: 'FIH-350',
      serialNumber: 'SN-1',
      purchaseDate: '2025-01-15',
      warrantyUntil: '2027-01-15',
      locationId: LOCATION_CENTRO.id,
      notes: 'Nota',
    });
  });

  it('has no changes when nothing was edited (normalization included)', () => {
    const values = {
      ...formValuesFromEquipment(initial),
      code: 'eq-0001 ',
      name: ' Freezer horizontal',
    };

    expect(validateUpdate(initial, values)).toEqual({ ok: true, data: null });
  });

  it('sends only the changed fields', () => {
    const values = { ...formValuesFromEquipment(initial), name: 'Freezer vertical' };

    expect(validateUpdate(initial, values)).toEqual({
      ok: true,
      data: { name: 'Freezer vertical' },
    });
  });

  it('never sends the location: it changes only through events', () => {
    const values = { ...formValuesFromEquipment(initial), locationId: LOCATION_KIOSCO.id };

    expect(validateUpdate(initial, values)).toEqual({ ok: true, data: null });
  });

  it('clears emptied optional fields with null', () => {
    const values = {
      ...formValuesFromEquipment(initial),
      serialNumber: '',
      warrantyUntil: '',
      notes: '  ',
    };

    expect(validateUpdate(initial, values)).toEqual({
      ok: true,
      data: { serialNumber: null, warrantyUntil: null, notes: null },
    });
  });

  it('validates the whole form, the warranty rule included', () => {
    const values = { ...formValuesFromEquipment(initial), purchaseDate: '2028-01-01' };

    expect(validateUpdate(initial, values)).toEqual({
      ok: false,
      errors: { warrantyUntil: 'La garantía no puede terminar antes de la fecha de compra.' },
    });
  });
});

describe('submitErrorFromApi', () => {
  it('maps 400 issues to Spanish field errors', () => {
    const error = new ApiError('failed', {
      status: 400,
      apiMessage: 'Warranty cannot end before the purchase date',
      issues: [
        { path: 'warrantyUntil', message: 'Warranty cannot end before the purchase date' },
        { path: 'locationId', message: 'Location does not exist' },
        { path: 'brand', message: 'Too big: expected string to have <=80 characters' },
      ],
    });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: {
        warrantyUntil: 'La garantía no puede terminar antes de la fecha de compra.',
        locationId: 'La ubicación seleccionada no existe. Elija otra.',
        brand: 'El valor no es válido.',
      },
    });
  });

  it('falls back to a form error with the API message when no issue names a field', () => {
    const error = new ApiError('failed', {
      status: 400,
      apiMessage: 'Provide at least one field to update',
      issues: [{ path: '', message: 'Provide at least one field to update' }],
    });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: {},
      formError: {
        message: 'Los datos no son válidos. Revise el formulario.',
        detail: 'Provide at least one field to update',
      },
    });
  });

  it('puts a 409 conflict on the code', () => {
    const error = new ApiError('failed', { status: 409, apiMessage: 'Code in use' });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: { code: 'Ya existe un equipo con ese código.' },
    });
  });

  it('explains a network failure', () => {
    expect(submitErrorFromApi(new ApiError('network'))).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
      },
    });
  });

  it('reports other failures with the API message as detail', () => {
    const error = new ApiError('failed', { status: 500, apiMessage: 'Internal server error' });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo guardar el equipo. Intente de nuevo más tarde.',
        detail: 'Internal server error',
      },
    });
  });
});
