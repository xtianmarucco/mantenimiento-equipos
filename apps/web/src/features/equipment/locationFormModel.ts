import {
  createLocationSchema,
  type CreateLocationInput,
  type ErrorIssue,
  type LocationResponse,
  type UpdateLocationInput,
} from '@mantenimiento/shared';
import type { z } from 'zod';

import { ApiError } from '../../shared/api/client';

/** Form fields, in the order they appear (the first invalid one gets focus). */
export const LOCATION_FORM_FIELDS = ['name', 'kind', 'address', 'contactName', 'phone'] as const;

export type LocationFormField = (typeof LOCATION_FORM_FIELDS)[number];

/** Raw control values: every field is a string, `''` meaning "empty". */
export type LocationFormValues = Record<LocationFormField, string>;

/** Spanish error message per field. */
export type LocationFieldErrors = Partial<Record<LocationFormField, string>>;

/** Error that belongs to the form as a whole; `detail` is the API message, when there is one. */
export interface LocationFormError {
  message: string;
  detail?: string;
}

const OPTIONAL_FIELDS = ['address', 'contactName', 'phone'] as const;

export const EMPTY_LOCATION_FORM_VALUES: LocationFormValues = {
  name: '',
  kind: '',
  address: '',
  contactName: '',
  phone: '',
};

export function formValuesFromLocation(location: LocationResponse): LocationFormValues {
  return {
    name: location.name,
    kind: location.kind,
    address: location.address ?? '',
    contactName: location.contactName ?? '',
    phone: location.phone ?? '',
  };
}

const REQUIRED = 'Este campo es obligatorio.';
const KIND_REQUIRED = 'Seleccione un tipo.';
const PHONE_INVALID = 'El número de teléfono no es válido.';
const INVALID_VALUE = 'El valor no es válido.';

/** Known API issue messages (English, from `packages/shared` and the API domain errors). */
const API_ISSUE_MESSAGES: Record<string, string> = {
  'Invalid phone number': PHONE_INVALID,
};

function isLocationFormField(value: string): value is LocationFormField {
  return (LOCATION_FORM_FIELDS as readonly string[]).includes(value);
}

/** Spanish message for a client-side zod issue on `field`. */
function issueMessage(field: LocationFormField, issue: z.core.$ZodIssue): string {
  if (field === 'phone') {
    return PHONE_INVALID;
  }
  switch (issue.code) {
    case 'too_small':
      return REQUIRED;
    case 'too_big':
      return `Debe tener como máximo ${String(issue.maximum)} caracteres.`;
    case 'invalid_value':
      return field === 'kind' ? KIND_REQUIRED : INVALID_VALUE;
    case 'invalid_format':
      return INVALID_VALUE;
    default:
      // Generic zod message, already Spanish through `configureZodLocale`.
      return issue.message;
  }
}

function fieldErrorsFromIssues(issues: readonly z.core.$ZodIssue[]): LocationFieldErrors {
  const errors: LocationFieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    // The first issue of a field wins, matching the order zod checks it.
    if (isLocationFormField(field) && errors[field] === undefined) {
      errors[field] = issueMessage(field, issue);
    }
  }
  return errors;
}

/** Trimmed values; a blank optional field becomes `null` ("no value"). */
function toPayload(values: LocationFormValues): Record<LocationFormField, string | null> {
  const payload: Record<LocationFormField, string | null> = {
    name: values.name.trim(),
    kind: values.kind.trim(),
    address: values.address.trim(),
    contactName: values.contactName.trim(),
    phone: values.phone.trim(),
  };
  for (const field of OPTIONAL_FIELDS) {
    if (payload[field] === '') {
      payload[field] = null;
    }
  }
  return payload;
}

/** Drops the optional fields that have no value, as `POST /api/locations` expects. */
function withoutEmptyOptionalFields(
  payload: Record<LocationFormField, string | null>,
): CreateLocationInput {
  const input: Record<string, string> = {};
  for (const field of LOCATION_FORM_FIELDS) {
    const value = payload[field];
    if (value !== null) {
      input[field] = value;
    }
  }
  return input as CreateLocationInput;
}

export type LocationValidationResult<T> =
  { ok: true; data: T } | { ok: false; errors: LocationFieldErrors };

/** Validates a new location with the shared create schema. */
export function validateCreate(
  values: LocationFormValues,
): LocationValidationResult<CreateLocationInput> {
  const payload = toPayload(values);
  const parsed = createLocationSchema.safeParse(withoutEmptyOptionalFields(payload));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromIssues(parsed.error.issues) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Validates the whole form with the shared schemas, then keeps only the fields whose normalized
 * value differs from `initial`. Cleared optional fields are sent as `null`.
 * `data` is `null` when nothing changed.
 */
export function validateUpdate(
  initial: LocationResponse,
  values: LocationFormValues,
): LocationValidationResult<UpdateLocationInput | null> {
  const payload = toPayload(values);
  const parsed = createLocationSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromIssues(parsed.error.issues) };
  }

  const changes: Record<string, string | null> = {};
  for (const field of LOCATION_FORM_FIELDS) {
    const next = parsed.data[field] ?? null;
    const previous = initial[field] ?? null;
    if (next !== previous) {
      changes[field] = next;
    }
  }
  if (Object.keys(changes).length === 0) {
    return { ok: true, data: null };
  }
  return { ok: true, data: changes as UpdateLocationInput };
}

export interface LocationSubmitError {
  fieldErrors: LocationFieldErrors;
  formError?: LocationFormError;
}

function withDetail(message: string, detail: string | undefined): LocationFormError {
  return detail ? { message, detail } : { message };
}

function fieldErrorsFromApiIssues(issues: readonly ErrorIssue[]): LocationFieldErrors {
  const errors: LocationFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.split('.')[0] ?? '';
    if (isLocationFormField(field) && errors[field] === undefined) {
      errors[field] = API_ISSUE_MESSAGES[issue.message] ?? INVALID_VALUE;
    }
  }
  return errors;
}

/**
 * Maps a failed save to Spanish errors: 400 issues to their fields, 404 to the form, anything
 * else to a form error. The API message is kept only as a detail of a form error.
 */
export function submitErrorFromApi(error: unknown): LocationSubmitError {
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
      formError: { message: 'No se encontró la ubicación. Vuelva a la lista e intente de nuevo.' },
    };
  }
  return {
    fieldErrors: {},
    formError: withDetail(
      'No se pudo guardar la ubicación. Intente de nuevo más tarde.',
      error.apiMessage,
    ),
  };
}

/** The first field with an error, in form order. */
export function firstInvalidField(errors: LocationFieldErrors): LocationFormField | undefined {
  return LOCATION_FORM_FIELDS.find((field) => errors[field] !== undefined);
}
