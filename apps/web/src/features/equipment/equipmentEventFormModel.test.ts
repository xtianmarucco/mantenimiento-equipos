import { describe, expect, it } from 'vitest';

import { ApiError } from '../../shared/api/client';
import { LOCATION_KIOSCO } from '../../test/fixtures';
import {
  eventSubmitErrorFromApi,
  eventTypesForStatus,
  fieldsForEventType,
  firstInvalidEventField,
  initialEventFormValues,
  validateEvent,
  type EventFormValues,
} from './equipmentEventFormModel';

const TODAY = '2026-11-11';
const CONTEXT = { today: TODAY, purchaseDate: '2025-01-15' };
const REPLACEMENT_ID = '55555555-5555-4555-8555-555555555555';

function values(overrides: Partial<EventFormValues>): EventFormValues {
  return { ...initialEventFormValues(TODAY), description: 'Algo pasó', ...overrides };
}

describe('initialEventFormValues', () => {
  it('starts with no type, today as the date and every other field empty', () => {
    expect(initialEventFormValues(TODAY)).toEqual({
      type: '',
      occurredOn: TODAY,
      resultingStatus: '',
      toLocationId: '',
      replacementEquipmentId: '',
      technician: '',
      cost: '',
      description: '',
    });
  });
});

describe('eventTypesForStatus', () => {
  it('offers no repair to operational equipment', () => {
    expect(eventTypesForStatus('OPERATIONAL')).toEqual([
      'MAINTENANCE',
      'BREAKDOWN',
      'TRANSFER',
      'REPLACEMENT',
      'RETIREMENT',
    ]);
  });

  it.each(['IN_REPAIR', 'OUT_OF_SERVICE'] as const)('offers every type when %s', (status) => {
    expect(eventTypesForStatus(status)).toEqual([
      'MAINTENANCE',
      'BREAKDOWN',
      'REPAIR',
      'TRANSFER',
      'REPLACEMENT',
      'RETIREMENT',
    ]);
  });

  it('offers nothing to retired equipment', () => {
    expect(eventTypesForStatus('RETIRED')).toEqual([]);
  });
});

describe('fieldsForEventType', () => {
  it.each([
    ['', ['type', 'occurredOn', 'description']],
    ['MAINTENANCE', ['type', 'occurredOn', 'technician', 'cost', 'description']],
    ['REPAIR', ['type', 'occurredOn', 'technician', 'cost', 'description']],
    ['BREAKDOWN', ['type', 'occurredOn', 'resultingStatus', 'description']],
    ['TRANSFER', ['type', 'occurredOn', 'toLocationId', 'description']],
    ['REPLACEMENT', ['type', 'occurredOn', 'replacementEquipmentId', 'description']],
    ['RETIREMENT', ['type', 'occurredOn', 'description']],
  ] as const)('shows the fields of %s, in form order', (type, fields) => {
    expect(fieldsForEventType(type)).toEqual(fields);
  });
});

describe('validateEvent', () => {
  it('sends only the fields of the chosen type, trimmed, with the cost as a number', () => {
    const result = validateEvent(
      values({
        type: 'MAINTENANCE',
        technician: ' Juan Pérez ',
        cost: '1500,50',
        description: ' Limpieza ',
        toLocationId: LOCATION_KIOSCO.id,
        resultingStatus: 'IN_REPAIR',
      }),
      CONTEXT,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        type: 'MAINTENANCE',
        occurredOn: TODAY,
        description: 'Limpieza',
        technician: 'Juan Pérez',
        cost: 1500.5,
      },
    });
  });

  it('leaves out blank optional fields', () => {
    expect(validateEvent(values({ type: 'REPAIR', technician: '  ', cost: '' }), CONTEXT)).toEqual({
      ok: true,
      data: { type: 'REPAIR', occurredOn: TODAY, description: 'Algo pasó' },
    });
    expect(validateEvent(values({ type: 'REPLACEMENT' }), CONTEXT)).toEqual({
      ok: true,
      data: { type: 'REPLACEMENT', occurredOn: TODAY, description: 'Algo pasó' },
    });
  });

  it('sends the type-specific references', () => {
    expect(
      validateEvent(values({ type: 'TRANSFER', toLocationId: LOCATION_KIOSCO.id }), CONTEXT),
    ).toEqual({
      ok: true,
      data: {
        type: 'TRANSFER',
        occurredOn: TODAY,
        description: 'Algo pasó',
        toLocationId: LOCATION_KIOSCO.id,
      },
    });
    expect(
      validateEvent(
        values({ type: 'REPLACEMENT', replacementEquipmentId: REPLACEMENT_ID }),
        CONTEXT,
      ),
    ).toEqual({
      ok: true,
      data: {
        type: 'REPLACEMENT',
        occurredOn: TODAY,
        description: 'Algo pasó',
        replacementEquipmentId: REPLACEMENT_ID,
      },
    });
    expect(
      validateEvent(values({ type: 'BREAKDOWN', resultingStatus: 'OUT_OF_SERVICE' }), CONTEXT),
    ).toEqual({
      ok: true,
      data: {
        type: 'BREAKDOWN',
        occurredOn: TODAY,
        description: 'Algo pasó',
        resultingStatus: 'OUT_OF_SERVICE',
      },
    });
  });

  it('reports the missing type together with the common fields', () => {
    expect(validateEvent(values({ type: '', occurredOn: '', description: ' ' }), CONTEXT)).toEqual({
      ok: false,
      errors: {
        type: 'Seleccione un tipo de evento.',
        occurredOn: 'Ingrese la fecha.',
        description: 'Ingrese una descripción.',
      },
    });
  });

  it('asks for the reason of a retirement', () => {
    expect(validateEvent(values({ type: 'RETIREMENT', description: '' }), CONTEXT)).toEqual({
      ok: false,
      errors: { description: 'Ingrese el motivo.' },
    });
  });

  it('asks for the required type-specific fields', () => {
    expect(validateEvent(values({ type: 'BREAKDOWN' }), CONTEXT)).toEqual({
      ok: false,
      errors: { resultingStatus: 'Seleccione el estado resultante.' },
    });
    expect(validateEvent(values({ type: 'TRANSFER' }), CONTEXT)).toEqual({
      ok: false,
      errors: { toLocationId: 'Seleccione la ubicación de destino.' },
    });
  });

  it.each([
    ['abc', 'Ingrese un importe válido, por ejemplo 15000,50.'],
    ['-1', 'El costo no puede ser negativo.'],
    ['10,123', 'Use como máximo dos decimales.'],
    ['100000000', 'El costo no puede superar 99.999.999,99.'],
  ])('explains an invalid cost %s in Spanish', (cost, message) => {
    expect(validateEvent(values({ type: 'MAINTENANCE', cost }), CONTEXT)).toEqual({
      ok: false,
      errors: { cost: message },
    });
  });

  it('reports the maximum length of the texts in Spanish', () => {
    expect(
      validateEvent(
        values({ type: 'MAINTENANCE', technician: 'x'.repeat(121), description: 'y'.repeat(1001) }),
        CONTEXT,
      ),
    ).toEqual({
      ok: false,
      errors: {
        technician: 'Debe tener como máximo 120 caracteres.',
        description: 'Debe tener como máximo 1000 caracteres.',
      },
    });
  });

  it('rejects a future date and a date before the purchase', () => {
    expect(
      validateEvent(values({ type: 'RETIREMENT', occurredOn: '2026-11-12' }), CONTEXT),
    ).toEqual({ ok: false, errors: { occurredOn: 'La fecha no puede ser posterior a hoy.' } });
    expect(
      validateEvent(values({ type: 'RETIREMENT', occurredOn: '2025-01-14' }), CONTEXT),
    ).toEqual({
      ok: false,
      errors: { occurredOn: 'La fecha no puede ser anterior a la fecha de compra.' },
    });
    expect(
      validateEvent(values({ type: 'RETIREMENT', occurredOn: '2025-01-15' }), CONTEXT).ok,
    ).toBe(true);
  });
});

describe('eventSubmitErrorFromApi', () => {
  function badRequest(issues: { path: string; message: string }[]) {
    return new ApiError('failed', { status: 400, apiMessage: 'Invalid', issues });
  }

  it.each([
    [
      'type',
      'Retired equipment accepts no events',
      'El equipo está dado de baja y no admite eventos.',
    ],
    [
      'type',
      'Only equipment in repair or out of service can be repaired',
      'Solo se puede reparar un equipo en reparación o fuera de servicio.',
    ],
    ['occurredOn', 'Date cannot be in the future', 'La fecha no puede ser posterior a hoy.'],
    [
      'occurredOn',
      'Date cannot be before the purchase date',
      'La fecha no puede ser anterior a la fecha de compra.',
    ],
    [
      'toLocationId',
      'Equipment is already at this location',
      'El equipo ya está en esa ubicación.',
    ],
    ['toLocationId', 'Location does not exist', 'La ubicación seleccionada no existe. Elija otra.'],
    [
      'replacementEquipmentId',
      'Equipment cannot replace itself',
      'El equipo no puede reemplazarse a sí mismo.',
    ],
    [
      'replacementEquipmentId',
      'Equipment does not exist',
      'El equipo de reemplazo no existe. Elija otro.',
    ],
    [
      'replacementEquipmentId',
      'Replacement equipment is retired',
      'El equipo de reemplazo está dado de baja. Elija otro.',
    ],
    ['cost', 'Too small: expected number to be >=0', 'El valor no es válido.'],
  ])('maps a 400 issue at %s ("%s") to its field', (path, message, expected) => {
    const type = path === 'toLocationId' ? 'TRANSFER' : path === 'cost' ? 'REPAIR' : 'REPLACEMENT';

    expect(eventSubmitErrorFromApi(badRequest([{ path, message }]), type)).toEqual({
      fieldErrors: { [path]: expected },
    });
  });

  it('maps a resulting status issue of a breakdown', () => {
    expect(
      eventSubmitErrorFromApi(
        badRequest([{ path: 'resultingStatus', message: 'Invalid option' }]),
        'BREAKDOWN',
      ),
    ).toEqual({ fieldErrors: { resultingStatus: 'El valor no es válido.' } });
  });

  it('falls back to a form error with the detail for an issue on a field not shown', () => {
    expect(
      eventSubmitErrorFromApi(
        badRequest([{ path: 'toLocationId', message: 'Location does not exist' }]),
        'MAINTENANCE',
      ),
    ).toEqual({
      fieldErrors: {},
      formError: { message: 'Los datos no son válidos. Revise el formulario.', detail: 'Invalid' },
    });
  });

  it('explains a network failure, a missing equipment and other failures', () => {
    expect(eventSubmitErrorFromApi(new ApiError('network'), 'RETIREMENT')).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
      },
    });
    expect(eventSubmitErrorFromApi(new ApiError('failed', { status: 404 }), 'RETIREMENT')).toEqual({
      fieldErrors: {},
      formError: { message: 'No se encontró el equipo. Vuelva a la lista e intente de nuevo.' },
    });
    expect(
      eventSubmitErrorFromApi(
        new ApiError('failed', { status: 500, apiMessage: 'Internal server error' }),
        'RETIREMENT',
      ),
    ).toEqual({
      fieldErrors: {},
      formError: {
        message: 'No se pudo registrar el evento. Intente de nuevo más tarde.',
        detail: 'Internal server error',
      },
    });
  });
});

describe('firstInvalidEventField', () => {
  it('follows the form order', () => {
    expect(firstInvalidEventField({ description: 'x', toLocationId: 'y', occurredOn: 'z' })).toBe(
      'occurredOn',
    );
    expect(firstInvalidEventField({})).toBeUndefined();
  });
});
