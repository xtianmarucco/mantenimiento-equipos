import {
  createEquipmentSchema,
  updateEquipmentSchema,
  type CreateEquipmentInput,
  type EquipmentResponse,
  type ErrorIssue,
  type UpdateEquipmentInput,
} from '@mantenimiento/shared';
import type { z } from 'zod';

import { ApiError } from '../../shared/api/client';

/** Form fields, in the order they appear (the first invalid one gets focus). */
export const FORM_FIELDS = [
  'code',
  'name',
  'type',
  'brand',
  'model',
  'serialNumber',
  'purchaseDate',
  'warrantyUntil',
  'locationId',
  'notes',
] as const;

export type FormField = (typeof FORM_FIELDS)[number];

/** Raw control values: every field is a string, `''` meaning "empty". */
export type EquipmentFormValues = Record<FormField, string>;

/** Spanish error message per field. */
export type FieldErrors = Partial<Record<FormField, string>>;

/** Error that belongs to the form as a whole; `detail` is the API message, when there is one. */
export interface FormError {
  message: string;
  detail?: string;
}

const OPTIONAL_FIELDS: ReadonlySet<FormField> = new Set(['serialNumber', 'warrantyUntil', 'notes']);

export const EMPTY_FORM_VALUES: EquipmentFormValues = {
  code: '',
  name: '',
  type: '',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  warrantyUntil: '',
  locationId: '',
  notes: '',
};

export function formValuesFromEquipment(item: EquipmentResponse): EquipmentFormValues {
  return {
    code: item.code,
    name: item.name,
    type: item.type,
    brand: item.brand,
    model: item.model,
    serialNumber: item.serialNumber ?? '',
    purchaseDate: item.purchaseDate,
    warrantyUntil: item.warrantyUntil ?? '',
    locationId: item.locationId,
    notes: item.notes ?? '',
  };
}

// Spanish messages. The shared schemas carry English messages for the API; the web maps them
// by field and issue code instead of showing them.
const REQUIRED = 'Este campo es obligatorio.';
const REQUIRED_MESSAGES: FieldErrors = {
  type: 'Seleccione un tipo.',
  purchaseDate: 'Ingrese la fecha de compra.',
  locationId: 'Seleccione una ubicación.',
};
const CODE_FORMAT = 'El código debe tener 2 a 4 letras, un guion y 4 dígitos, por ejemplo EQ-0042.';
const WARRANTY_BEFORE_PURCHASE = 'La garantía no puede terminar antes de la fecha de compra.';
const INVALID_DATE = 'Ingrese una fecha válida.';
const INVALID_OPTION = 'Seleccione una opción de la lista.';
const INVALID_VALUE = 'El valor no es válido.';
const DUPLICATE_CODE = 'Ya existe un equipo con ese código.';

/** Known API issue messages (English, from `packages/shared` and the API domain errors). */
const API_ISSUE_MESSAGES: Record<string, string> = {
  'Warranty cannot end before the purchase date': WARRANTY_BEFORE_PURCHASE,
  'Location does not exist': 'La ubicación seleccionada no existe. Elija otra.',
  'Code must look like EQ-0042': CODE_FORMAT,
};

function isFormField(value: string): value is FormField {
  return (FORM_FIELDS as readonly string[]).includes(value);
}

/** Spanish message for a client-side zod issue on `field`. */
function issueMessage(field: FormField, issue: z.core.$ZodIssue, values: EquipmentFormValues) {
  if (!OPTIONAL_FIELDS.has(field) && values[field].trim() === '') {
    return REQUIRED_MESSAGES[field] ?? REQUIRED;
  }
  switch (issue.code) {
    case 'too_big':
      return `Debe tener como máximo ${String(issue.maximum)} caracteres.`;
    case 'invalid_format':
      if (field === 'code') return CODE_FORMAT;
      if (issue.format === 'date') return INVALID_DATE;
      return INVALID_VALUE;
    case 'invalid_value':
      return INVALID_OPTION;
    case 'custom':
      return field === 'warrantyUntil' ? WARRANTY_BEFORE_PURCHASE : INVALID_VALUE;
    default:
      // Generic zod message, already Spanish through `configureZodLocale`.
      return issue.message;
  }
}

function fieldErrorsFromIssues(
  issues: readonly z.core.$ZodIssue[],
  values: EquipmentFormValues,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    // The first issue of a field wins, matching the order zod checks it.
    if (isFormField(field) && errors[field] === undefined) {
      errors[field] = issueMessage(field, issue, values);
    }
  }
  return errors;
}

/** Trimmed blank optional fields become `null` ("no value"). */
function toPayload(values: EquipmentFormValues): Record<FormField, string | null> {
  const payload = { ...values } as Record<FormField, string | null>;
  for (const field of OPTIONAL_FIELDS) {
    if (values[field].trim() === '') {
      payload[field] = null;
    }
  }
  return payload;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/**
 * Validates a new item with the shared create schema. Blank optional fields are left out and
 * `status` is not sent: the API defaults it to `OPERATIONAL`.
 */
export function validateCreate(
  values: EquipmentFormValues,
): ValidationResult<CreateEquipmentInput> {
  const payload = Object.fromEntries(
    Object.entries(toPayload(values)).filter(([, value]) => value !== null),
  );
  const parsed = createEquipmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromIssues(parsed.error.issues, values) };
  }
  const { status: _defaultStatus, ...data } = parsed.data;
  return { ok: true, data };
}

/**
 * Validates the whole form with the shared update schema (so the warranty rule sees both dates),
 * then keeps only the fields whose normalized value differs from `initial`. Cleared optional
 * fields are sent as `null`. The location is never sent: after creation it changes only through
 * events (the API rejects it). `data` is `null` when nothing changed.
 */
export function validateUpdate(
  initial: EquipmentResponse,
  values: EquipmentFormValues,
): ValidationResult<UpdateEquipmentInput | null> {
  const { locationId: _locationId, ...details } = toPayload(values);
  const parsed = updateEquipmentSchema.safeParse(details);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromIssues(parsed.error.issues, values) };
  }
  const changes = Object.fromEntries(
    Object.entries(parsed.data).filter(
      ([field, value]) => value !== initial[field as keyof EquipmentResponse],
    ),
  ) as UpdateEquipmentInput;
  return { ok: true, data: Object.keys(changes).length > 0 ? changes : null };
}

export interface SubmitError {
  fieldErrors: FieldErrors;
  formError?: FormError;
}

function withDetail(message: string, detail: string | undefined): FormError {
  return detail ? { message, detail } : { message };
}

function fieldErrorsFromApiIssues(issues: readonly ErrorIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.split('.')[0] ?? '';
    if (isFormField(field) && errors[field] === undefined) {
      errors[field] = API_ISSUE_MESSAGES[issue.message] ?? INVALID_VALUE;
    }
  }
  return errors;
}

/**
 * Maps a failed save to Spanish errors: 400 issues to their fields, 409 to the code, anything
 * else to a form error. The API message is kept only as a detail of a form error.
 */
export function submitErrorFromApi(error: unknown): SubmitError {
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
  if (error.status === 409) {
    return { fieldErrors: { code: DUPLICATE_CODE } };
  }
  if (error.status === 400) {
    const fieldErrors = fieldErrorsFromApiIssues(error.issues ?? []);
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
      'No se pudo guardar el equipo. Intente de nuevo más tarde.',
      error.apiMessage,
    ),
  };
}

/** The first field with an error, in form order. */
export function firstInvalidField(errors: FieldErrors): FormField | undefined {
  return FORM_FIELDS.find((field) => errors[field] !== undefined);
}
