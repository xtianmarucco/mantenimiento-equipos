import { idSchema, type EquipmentResponse, type LocationResponse } from '@mantenimiento/shared';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { createEquipment, getEquipment, updateEquipment } from '../../shared/api/equipment';
import { listLocations } from '../../shared/api/locations';
import { isNotFound, useResource } from '../../shared/hooks/useResource';
import { EquipmentForm, type FocusRequest } from './EquipmentForm';
import {
  EMPTY_FORM_VALUES,
  firstInvalidField,
  formValuesFromEquipment,
  submitErrorFromApi,
  validateCreate,
  validateUpdate,
  type EquipmentFormValues,
  type FieldErrors,
  type FormError,
  type FormField,
} from './equipmentFormModel';
import { EquipmentLoadStatus } from './EquipmentLoadStatus';
import { listPath, readNavigationState } from './navigation';

/** Route `/equipos/nuevo`. */
export function EquipmentCreatePage() {
  return <EquipmentFormController initial={undefined} />;
}

/** Route `/equipos/:id/editar`: loads the item, then shows the form with its values. */
export function EquipmentEditPage() {
  const { id = '' } = useParams();
  const backTo = listPath(readNavigationState(useLocation().state));

  if (!idSchema.safeParse(id).success) {
    return <EquipmentLoadStatus state={{ status: 'not-found' }} backTo={backTo} />;
  }
  return <EquipmentEditLoader key={id} id={id} backTo={backTo} />;
}

function EquipmentEditLoader({ id, backTo }: { id: string; backTo: string }) {
  const loaded = useResource(
    useCallback((signal: AbortSignal) => getEquipment(id, { signal }), [id]),
  );

  if (loaded.status === 'loading') {
    return <EquipmentLoadStatus state={{ status: 'loading' }} backTo={backTo} />;
  }
  if (loaded.status === 'error') {
    return (
      <EquipmentLoadStatus
        state={{ status: isNotFound(loaded) ? 'not-found' : 'error' }}
        backTo={backTo}
      />
    );
  }
  return <EquipmentFormController initial={loaded.data} />;
}

/**
 * Container shared by create and edit: holds the form state, validates with the shared schemas,
 * saves through the API (PATCH with only the changed fields on edit) and maps server errors.
 */
function EquipmentFormController({ initial }: { initial: EquipmentResponse | undefined }) {
  const navigate = useNavigate();
  const navigationState = readNavigationState(useLocation().state);
  const [locationsLoad, setLocationsLoad] = useState<
    (signal: AbortSignal) => Promise<LocationResponse[]>
  >(() => (signal: AbortSignal) => listLocations({ signal }));
  const locations = useResource(locationsLoad);
  const retryLocations = useCallback(
    () => setLocationsLoad(() => (signal: AbortSignal) => listLocations({ signal })),
    [],
  );

  const [values, setValues] = useState<EquipmentFormValues>(() =>
    initial ? formValuesFromEquipment(initial) : EMPTY_FORM_VALUES,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const detailPath = (id: string) => `/equipos/${id}`;

  function showErrors(fieldErrors: FieldErrors, nextFormError?: FormError) {
    setErrors(fieldErrors);
    setFormError(nextFormError);
    const target = firstInvalidField(fieldErrors) ?? (nextFormError ? 'form' : undefined);
    if (target) {
      setFocusRequest((previous) => ({ target, seq: (previous?.seq ?? 0) + 1 }));
    }
  }

  function onChange(field: FormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    // The message described the old value; drop it until the next submit.
    setErrors((previous) => {
      if (previous[field] === undefined) return previous;
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  }

  function goToDetail(id: string) {
    // Replace the form entry: "back" from the detail should not reopen a submitted form.
    void navigate(detailPath(id), { replace: true, state: navigationState });
  }

  async function onSubmit() {
    let save: () => Promise<EquipmentResponse>;
    if (initial) {
      const result = validateUpdate(initial, values);
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      if (result.data === null) {
        goToDetail(initial.id);
        return;
      }
      const changes = result.data;
      save = () => updateEquipment(initial.id, changes);
    } else {
      const result = validateCreate(values);
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      const input = result.data;
      save = () => createEquipment(input);
    }

    setSaving(true);
    setFormError(undefined);
    try {
      const saved = await save();
      goToDetail(saved.id);
    } catch (error) {
      const { fieldErrors, formError: nextFormError } = submitErrorFromApi(error);
      showErrors(fieldErrors, nextFormError);
      setSaving(false);
    }
  }

  const cancelTo = initial ? detailPath(initial.id) : listPath(navigationState);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{initial ? 'Editar equipo' : 'Nuevo equipo'}</h2>
        {initial && (
          <p className="text-sm text-slate-600">
            <span className="font-mono">{initial.code}</span> · {initial.name}
          </p>
        )}
      </div>
      <EquipmentForm
        mode={initial ? 'edit' : 'create'}
        values={values}
        errors={errors}
        formError={formError}
        locations={locations}
        saving={saving}
        focusRequest={focusRequest}
        cancelTo={cancelTo}
        cancelState={navigationState}
        onChange={onChange}
        onSubmit={() => void onSubmit()}
        onRetryLocations={locations.status === 'error' ? retryLocations : undefined}
      />
    </section>
  );
}
