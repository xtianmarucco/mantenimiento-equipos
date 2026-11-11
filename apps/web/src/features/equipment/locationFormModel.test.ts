import { describe, expect, it } from 'vitest';

import { type LocationResponse } from '@mantenimiento/shared';

import { ApiError } from '../../shared/api/client';
import {
  EMPTY_LOCATION_FORM_VALUES,
  formValuesFromLocation,
  submitErrorFromApi,
  validateCreate,
  validateUpdate,
  type LocationFormValues,
} from './locationFormModel';

const ITEM: LocationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. Siempre Viva 742',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

const VALID_VALUES: LocationFormValues = {
  name: 'Heladería Centro',
  kind: 'OWN_STORE',
  address: 'Av. Siempre Viva 742',
  contactName: 'Ana Pérez',
  phone: '+54 11 5555-0101',
};

describe('validateCreate', () => {
  it('returns the normalized input, leaving out blank optional fields', () => {
    const result = validateCreate({ ...VALID_VALUES, address: '   ', contactName: '', phone: '' });

    expect(result).toEqual({
      ok: true,
      data: { name: 'Heladería Centro', kind: 'OWN_STORE' },
    });
  });

  it('reports Spanish messages for missing required fields', () => {
    expect(validateCreate(EMPTY_LOCATION_FORM_VALUES)).toEqual({
      ok: false,
      errors: { name: 'Este campo es obligatorio.', kind: 'Seleccione un tipo.' },
    });
  });

  it('explains the name length and the phone in Spanish', () => {
    expect(validateCreate({ ...VALID_VALUES, name: 'x'.repeat(121) })).toEqual({
      ok: false,
      errors: { name: 'Debe tener como máximo 120 caracteres.' },
    });
    expect(validateCreate({ ...VALID_VALUES, phone: 'abc' })).toEqual({
      ok: false,
      errors: { phone: 'El número de teléfono no es válido.' },
    });
  });
});

describe('validateUpdate', () => {
  it('round-trips a location into form values', () => {
    expect(formValuesFromLocation(ITEM)).toEqual({
      name: 'Heladería Centro',
      kind: 'OWN_STORE',
      address: 'Av. Siempre Viva 742',
      contactName: 'Ana Pérez',
      phone: '+54 11 5555-0101',
    });
  });

  it('has no changes when nothing was edited', () => {
    expect(validateUpdate(ITEM, formValuesFromLocation(ITEM))).toEqual({ ok: true, data: null });
  });

  it('sends only the changed fields', () => {
    const values = { ...formValuesFromLocation(ITEM), name: 'Heladería Norte' };

    expect(validateUpdate(ITEM, values)).toEqual({
      ok: true,
      data: { name: 'Heladería Norte' },
    });
  });

  it('clears emptied optional fields with null', () => {
    const values = { ...formValuesFromLocation(ITEM), address: '', contactName: '', phone: '' };

    expect(validateUpdate(ITEM, values)).toEqual({
      ok: true,
      data: { address: null, contactName: null, phone: null },
    });
  });

  it('reports the required message for a blank name on update', () => {
    const values = { ...formValuesFromLocation(ITEM), name: '   ' };

    expect(validateUpdate(ITEM, values)).toEqual({
      ok: false,
      errors: { name: 'Este campo es obligatorio.' },
    });
  });
});

describe('submitErrorFromApi', () => {
  it('maps API issues to Spanish field errors', () => {
    const error = new ApiError('failed', {
      status: 400,
      apiMessage: 'Invalid request body',
      issues: [{ path: 'kind', message: 'Invalid enum value' }],
    });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: { kind: 'El valor no es válido.' },
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

  it('explains a network failure', () => {
    expect(submitErrorFromApi(new ApiError('network'))).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
      },
    });
  });

  it('reports a missing location (404) as a form error without the API message', () => {
    const error = new ApiError('failed', { status: 404, apiMessage: 'Location not found' });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: {},
      formError: { message: 'No se encontró la ubicación. Vuelva a la lista e intente de nuevo.' },
    });
  });

  it('reports an unexpected non-API error as a generic form error', () => {
    expect(submitErrorFromApi(new Error('boom'))).toEqual({
      fieldErrors: {},
      formError: { message: 'Ocurrió un error inesperado.' },
    });
  });

  it('reports other failures with the API message as detail', () => {
    const error = new ApiError('failed', { status: 500, apiMessage: 'Internal server error' });

    expect(submitErrorFromApi(error)).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo guardar la ubicación. Intente de nuevo más tarde.',
        detail: 'Internal server error',
      },
    });
  });
});
