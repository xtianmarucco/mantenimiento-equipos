import { idSchema, type LocationResponse } from '@mantenimiento/shared';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { createLocation, getLocation, updateLocation } from '../../shared/api/locations';
import { isNotFound, useResource } from '../../shared/hooks/useResource';
import { LocationForm, type LocationFocusRequest } from './LocationForm';
import {
  EMPTY_LOCATION_FORM_VALUES,
  firstInvalidField,
  formValuesFromLocation,
  submitErrorFromApi,
  validateCreate,
  validateUpdate,
  type LocationFieldErrors,
  type LocationFormError,
  type LocationFormField,
  type LocationFormValues,
} from './locationFormModel';
import { LocationLoadStatus } from './LocationLoadStatus';

const LIST_PATH = '/ubicaciones';

/** Route `/ubicaciones/nuevo`. */
export function LocationCreatePage() {
  return <LocationFormController initial={undefined} />;
}

/** Route `/ubicaciones/:id/editar`: loads the location, then shows the form with its values. */
export function LocationEditPage() {
  const { id = '' } = useParams();

  if (!idSchema.safeParse(id).success) {
    return <LocationLoadStatus state={{ status: 'not-found' }} backTo={LIST_PATH} />;
  }
  return <LocationEditLoader key={id} id={id} />;
}

function LocationEditLoader({ id }: { id: string }) {
  const loaded = useResource(
    useCallback((signal: AbortSignal) => getLocation(id, { signal }), [id]),
  );

  if (loaded.status === 'loading') {
    return <LocationLoadStatus state={{ status: 'loading' }} backTo={LIST_PATH} />;
  }
  if (loaded.status === 'error') {
    return (
      <LocationLoadStatus
        state={{ status: isNotFound(loaded) ? 'not-found' : 'error' }}
        backTo={LIST_PATH}
      />
    );
  }
  return <LocationFormController initial={loaded.data} />;
}

/**
 * Container shared by create and edit: holds the form state, validates with the shared schemas,
 * saves through the API (PATCH with only the changed fields on edit) and maps server errors.
 */
function LocationFormController({ initial }: { initial: LocationResponse | undefined }) {
  const navigate = useNavigate();
  const [values, setValues] = useState<LocationFormValues>(() =>
    initial ? formValuesFromLocation(initial) : EMPTY_LOCATION_FORM_VALUES,
  );
  const [errors, setErrors] = useState<LocationFieldErrors>({});
  const [formError, setFormError] = useState<LocationFormError | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<LocationFocusRequest | null>(null);

  function showErrors(fieldErrors: LocationFieldErrors, nextFormError?: LocationFormError) {
    setErrors(fieldErrors);
    setFormError(nextFormError);
    const target = firstInvalidField(fieldErrors) ?? (nextFormError ? 'form' : undefined);
    if (target) {
      setFocusRequest((previous) => ({ target, seq: (previous?.seq ?? 0) + 1 }));
    }
  }

  function onChange(field: LocationFormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    // The message described the old value; drop it until the next submit.
    setErrors((previous) => {
      if (previous[field] === undefined) return previous;
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  }

  function goToList() {
    // Replace the form entry: "back" from the list should not reopen a submitted form.
    void navigate(LIST_PATH, { replace: true });
  }

  async function onSubmit() {
    let save: () => Promise<LocationResponse>;
    if (initial) {
      const result = validateUpdate(initial, values);
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      if (result.data === null) {
        goToList();
        return;
      }
      const changes = result.data;
      save = () => updateLocation(initial.id, changes);
    } else {
      const result = validateCreate(values);
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      const input = result.data;
      save = () => createLocation(input);
    }

    setSaving(true);
    setFormError(undefined);
    try {
      await save();
      goToList();
    } catch (error) {
      const { fieldErrors, formError: nextFormError } = submitErrorFromApi(error);
      showErrors(fieldErrors, nextFormError);
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{initial ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
      <LocationForm
        mode={initial ? 'edit' : 'create'}
        values={values}
        errors={errors}
        formError={formError}
        saving={saving}
        focusRequest={focusRequest}
        cancelTo={LIST_PATH}
        onChange={onChange}
        onSubmit={() => void onSubmit()}
      />
    </section>
  );
}
