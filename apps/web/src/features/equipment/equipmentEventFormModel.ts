import {
  createEquipmentEventSchema,
  type CreateEquipmentEventInput,
  type EquipmentEventType,
  type EquipmentStatus,
  type ErrorIssue,
} from '@mantenimiento/shared';
import type { z } from 'zod';

import { ApiError } from '../../shared/api/client';
import type { FormError } from './equipmentFormModel';

/** Event form fields, in the order they appear (the first invalid one gets focus). */
export const EVENT_FORM_FIELDS = [
  'type',
  'occurredOn',
  'resultingStatus',
  'toLocationId',
  'replacementEquipmentId',
  'technician',
  'cost',
  'description',
] as const;

export type EventFormField = (typeof EVENT_FORM_FIELDS)[number];

/** Raw control values: every field is a string, `''` meaning "empty". */
export type EventFormValues = Record<EventFormField, string>;

/** Spanish error message per field. */
export type EventFieldErrors = Partial<Record<EventFormField, string>>;

/** The fields with a select whose options come from the API (they are disabled until loaded). */
export type OptionsField = Extract<EventFormField, 'toLocationId' | 'replacementEquipmentId'>;

const OPTIONAL_FIELDS: ReadonlySet<EventFormField> = new Set([
  'technician',
  'cost',
  'replacementEquipmentId',
]);

/** Type-specific fields of each event type, in form order. */
const TYPE_FIELDS: Record<EquipmentEventType, readonly EventFormField[]> = {
  MAINTENANCE: ['technician', 'cost'],
  REPAIR: ['technician', 'cost'],
  BREAKDOWN: ['resultingStatus'],
  TRANSFER: ['toLocationId'],
  REPLACEMENT: ['replacementEquipmentId'],
  RETIREMENT: [],
};

/** Every type in the order the form offers them. */
const EVENT_TYPES: readonly EquipmentEventType[] = [
  'MAINTENANCE',
  'BREAKDOWN',
  'REPAIR',
  'TRANSFER',
  'REPLACEMENT',
  'RETIREMENT',
];

export function initialEventFormValues(today: string): EventFormValues {
  return {
    type: '',
    occurredOn: today,
    resultingStatus: '',
    toLocationId: '',
    replacementEquipmentId: '',
    technician: '',
    cost: '',
    description: '',
  };
}

/**
 * The event types that may be recorded for an item in `status` (same rules as the API): a repair
 * only from `IN_REPAIR` or `OUT_OF_SERVICE`, and nothing once it is `RETIRED`.
 */
export function eventTypesForStatus(status: EquipmentStatus): EquipmentEventType[] {
  if (status === 'RETIRED') {
    return [];
  }
  const repairable = status === 'IN_REPAIR' || status === 'OUT_OF_SERVICE';
  return EVENT_TYPES.filter((type) => type !== 'REPAIR' || repairable);
}

function isEventType(value: string): value is EquipmentEventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

/** The fields shown for `type` (`''`: none chosen yet), in form order. */
export function fieldsForEventType(type: string): EventFormField[] {
  const specific = isEventType(type) ? TYPE_FIELDS[type] : [];
  return EVENT_FORM_FIELDS.filter(
    (field) =>
      field === 'type' ||
      field === 'occurredOn' ||
      field === 'description' ||
      specific.includes(field),
  );
}

// Spanish messages. The shared schemas carry English messages for the API; the web maps them by
// field and issue code instead of showing them.
const REQUIRED = 'Este campo es obligatorio.';
const REQUIRED_MESSAGES: EventFieldErrors = {
  type: 'Seleccione un tipo de evento.',
  occurredOn: 'Ingrese la fecha.',
  resultingStatus: 'Seleccione el estado resultante.',
  toLocationId: 'Seleccione la ubicación de destino.',
  description: 'Ingrese una descripción.',
};
const REQUIRED_REASON = 'Ingrese el motivo.';
const INVALID_DATE = 'Ingrese una fecha válida.';
const INVALID_OPTION = 'Seleccione una opción de la lista.';
const INVALID_VALUE = 'El valor no es válido.';
const FUTURE_DATE = 'La fecha no puede ser posterior a hoy.';
const BEFORE_PURCHASE = 'La fecha no puede ser anterior a la fecha de compra.';
const COST_MESSAGES = {
  invalid: 'Ingrese un importe válido, por ejemplo 15000,50.',
  negative: 'El costo no puede ser negativo.',
  decimals: 'Use como máximo dos decimales.',
  tooBig: 'El costo no puede superar 99.999.999,99.',
};

/** Known API issue messages (English, from `packages/shared` and the API domain errors). */
const API_ISSUE_MESSAGES: Record<string, string> = {
  'Retired equipment accepts no events': 'El equipo está dado de baja y no admite eventos.',
  'Only equipment in repair or out of service can be repaired':
    'Solo se puede reparar un equipo en reparación o fuera de servicio.',
  'Date cannot be in the future': FUTURE_DATE,
  'Date cannot be before the purchase date': BEFORE_PURCHASE,
  'Equipment is already at this location': 'El equipo ya está en esa ubicación.',
  'Location does not exist': 'La ubicación seleccionada no existe. Elija otra.',
  'Equipment cannot replace itself': 'El equipo no puede reemplazarse a sí mismo.',
  'Equipment does not exist': 'El equipo de reemplazo no existe. Elija otro.',
  'Replacement equipment is retired': 'El equipo de reemplazo está dado de baja. Elija otro.',
};

function isEventFormField(value: string): value is EventFormField {
  return (EVENT_FORM_FIELDS as readonly string[]).includes(value);
}

function requiredMessage(field: EventFormField, values: EventFormValues): string {
  if (field === 'description' && values.type === 'RETIREMENT') {
    return REQUIRED_REASON;
  }
  return REQUIRED_MESSAGES[field] ?? REQUIRED;
}

function costMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'too_small':
      return COST_MESSAGES.negative;
    case 'too_big':
      return COST_MESSAGES.tooBig;
    case 'not_multiple_of':
      return COST_MESSAGES.decimals;
    default:
      return COST_MESSAGES.invalid;
  }
}

/** Spanish message for a client-side zod issue on `field`. */
function issueMessage(field: EventFormField, issue: z.core.$ZodIssue, values: EventFormValues) {
  if (!OPTIONAL_FIELDS.has(field) && values[field].trim() === '') {
    return requiredMessage(field, values);
  }
  if (field === 'cost') {
    return costMessage(issue);
  }
  switch (issue.code) {
    case 'too_big':
      return `Debe tener como máximo ${String(issue.maximum)} caracteres.`;
    case 'invalid_format':
      return issue.format === 'date' ? INVALID_DATE : INVALID_OPTION;
    case 'invalid_value':
    case 'invalid_union':
      return INVALID_OPTION;
    default:
      // Generic zod message, already Spanish through `configureZodLocale`.
      return issue.message;
  }
}

/** A cost typed with a decimal comma or point, as a number (`NaN` when it is not one). */
function parseCost(raw: string): number {
  return Number(raw.trim().replace(',', '.'));
}

/** The request body for the shown fields; blank optional fields are left out. */
function toPayload(values: EventFormValues): Record<string, unknown> {
  // With no type chosen, validate the common fields as a retirement (it has no other fields), so
  // every missing field is reported at once; the type error is added by `validateEvent`.
  const payload: Record<string, unknown> = { type: values.type || 'RETIREMENT' };
  for (const field of fieldsForEventType(values.type)) {
    if (field === 'type') continue;
    const value = values[field];
    if (OPTIONAL_FIELDS.has(field) && value.trim() === '') continue;
    payload[field] = field === 'cost' ? parseCost(value) : value;
  }
  return payload;
}

export type EventValidationResult =
  { ok: true; data: CreateEquipmentEventInput } | { ok: false; errors: EventFieldErrors };

interface EventContext {
  /** Today as `YYYY-MM-DD`: the latest date accepted. */
  today: string;
  /** The equipment's purchase date: the earliest date accepted. */
  purchaseDate: string;
}

/**
 * Validates the form with the shared create-event schema, sending only the fields of the chosen
 * type, plus the date range the API checks (not after today, not before the purchase date).
 */
export function validateEvent(
  values: EventFormValues,
  { today, purchaseDate }: EventContext,
): EventValidationResult {
  const errors: EventFieldErrors = {};
  if (values.type === '') {
    errors.type = requiredMessage('type', values);
  }
  const parsed = createEquipmentEventSchema.safeParse(toPayload(values));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      // The first issue of a field wins, matching the order zod checks it.
      if (isEventFormField(field) && errors[field] === undefined) {
        errors[field] = issueMessage(field, issue, values);
      }
    }
  }
  if (errors.occurredOn === undefined) {
    // `YYYY-MM-DD` strings compare in date order.
    if (values.occurredOn > today) {
      errors.occurredOn = FUTURE_DATE;
    } else if (values.occurredOn < purchaseDate) {
      errors.occurredOn = BEFORE_PURCHASE;
    }
  }
  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { ok: false, errors };
  }
  return { ok: true, data: parsed.data };
}

export interface EventSubmitError {
  fieldErrors: EventFieldErrors;
  formError?: FormError;
}

function withDetail(message: string, detail: string | undefined): FormError {
  return detail ? { message, detail } : { message };
}

function fieldErrorsFromApiIssues(
  issues: readonly ErrorIssue[],
  shown: readonly EventFormField[],
): EventFieldErrors {
  const errors: EventFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.split('.')[0] ?? '';
    if (isEventFormField(field) && shown.includes(field) && errors[field] === undefined) {
      errors[field] = API_ISSUE_MESSAGES[issue.message] ?? INVALID_VALUE;
    }
  }
  return errors;
}

/**
 * Maps a failed save of an event of `type` to Spanish errors: 400 issues to the fields shown for
 * it, anything else to a form error. The API message is kept only as a detail of a form error.
 */
export function eventSubmitErrorFromApi(error: unknown, type: string): EventSubmitError {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, formError: { message: 'Ocurrió un error inesperado.' } };
  }
  if (error.status === undefined) {
    return {
      fieldErrors: {},
      formError: {
        message: 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.',
      },
    };
  }
  if (error.status === 400) {
    const fieldErrors = fieldErrorsFromApiIssues(error.issues ?? [], fieldsForEventType(type));
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }
    return {
      fieldErrors: {},
      formError: withDetail('Los datos no son válidos. Revise el formulario.', error.apiMessage),
    };
  }
  if (error.status === 404) {
    return {
      fieldErrors: {},
      formError: { message: 'No se encontró el equipo. Vuelva a la lista e intente de nuevo.' },
    };
  }
  return {
    fieldErrors: {},
    formError: withDetail(
      'No se pudo registrar el evento. Intente de nuevo más tarde.',
      error.apiMessage,
    ),
  };
}

/** The first field with an error, in form order. */
export function firstInvalidEventField(errors: EventFieldErrors): EventFormField | undefined {
  return EVENT_FORM_FIELDS.find((field) => errors[field] !== undefined);
}
