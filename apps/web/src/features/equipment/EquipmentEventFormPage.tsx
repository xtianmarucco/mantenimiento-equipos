import { idSchema, type EquipmentResponse, type LocationResponse } from '@mantenimiento/shared';
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { getEquipment, listEquipment, recordEquipmentEvent } from '../../shared/api/equipment';
import { listLocations } from '../../shared/api/locations';
import { isNotFound, useResource, type ResourceState } from '../../shared/hooks/useResource';
import { textLink } from '../../shared/ui/styles';
import { todayIsoDate } from './dates';
import { EquipmentEventForm, type EventFocusRequest } from './EquipmentEventForm';
import {
  eventSubmitErrorFromApi,
  firstInvalidEventField,
  initialEventFormValues,
  validateEvent,
  type EventFieldErrors,
  type EventFormField,
  type EventFormValues,
  type OptionsField,
} from './equipmentEventFormModel';
import type { FormError } from './equipmentFormModel';
import { EquipmentLoadStatus } from './EquipmentLoadStatus';
import { listPath, readNavigationState } from './navigation';

const OPTIONS_LOADING: FormError = {
  message: 'Las opciones todavía se están cargando. Espere un momento e intente de nuevo.',
};

/** Route `/equipos/:id/eventos/nuevo`: loads the item, then shows the event form for it. */
export function EquipmentEventFormPage() {
  const { id = '' } = useParams();
  const backTo = listPath(readNavigationState(useLocation().state));

  if (!idSchema.safeParse(id).success) {
    return <EquipmentLoadStatus state={{ status: 'not-found' }} backTo={backTo} />;
  }
  return <EquipmentEventLoader key={id} id={id} backTo={backTo} />;
}

function EquipmentEventLoader({ id, backTo }: { id: string; backTo: string }) {
  const navigationState = readNavigationState(useLocation().state);
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
  if (loaded.data.status === 'RETIRED') {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Registrar evento</h2>
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
          Este equipo está dado de baja y no admite eventos.
        </p>
        <Link to={`/equipos/${id}`} state={navigationState} className={textLink}>
          Volver al equipo
        </Link>
      </section>
    );
  }
  return <EquipmentEventController equipment={loaded.data} />;
}

/** A load function that changes identity on every call, so `useResource` refetches. */
function useReloadable<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [current, setCurrent] = useState(() => (signal: AbortSignal) => load(signal));
  const reload = useCallback(() => setCurrent(() => (signal: AbortSignal) => load(signal)), [load]);
  return [useResource(current), reload] as const;
}

const loadLocations = (signal: AbortSignal): Promise<LocationResponse[]> =>
  listLocations({ signal });
// Without a status filter the API lists only active equipment.
const loadActiveEquipment = (signal: AbortSignal): Promise<EquipmentResponse[]> =>
  listEquipment({}, { signal });

/**
 * Container: holds the form state, validates with the shared schema, records the event through
 * the API and maps server errors; on success it returns to the detail, which reloads the item and
 * its history.
 */
function EquipmentEventController({ equipment }: { equipment: EquipmentResponse }) {
  const navigate = useNavigate();
  const navigationState = readNavigationState(useLocation().state);
  const [locations, retryLocations] = useReloadable(loadLocations);
  const [replacements, retryReplacements] = useReloadable(loadActiveEquipment);
  const [today] = useState(() => todayIsoDate(new Date()));

  const [values, setValues] = useState<EventFormValues>(() => initialEventFormValues(today));
  const [errors, setErrors] = useState<EventFieldErrors>({});
  const [formError, setFormError] = useState<FormError | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<EventFocusRequest | null>(null);

  const detailPath = `/equipos/${equipment.id}`;
  const options: Record<OptionsField, ResourceState<unknown>> = {
    toLocationId: locations,
    replacementEquipmentId: replacements,
  };

  function showErrors(fieldErrors: EventFieldErrors, nextFormError?: FormError) {
    const first = firstInvalidEventField(fieldErrors);
    // An invalid field whose options are still loading is disabled: explain the wait in a form
    // error, which the form focuses instead of the control.
    const waiting =
      (first === 'toLocationId' || first === 'replacementEquipmentId') &&
      options[first].status === 'loading';
    const shownFormError = nextFormError ?? (waiting ? OPTIONS_LOADING : undefined);
    setErrors(fieldErrors);
    setFormError(shownFormError);
    const target = first ?? (shownFormError ? 'form' : undefined);
    if (target) {
      setFocusRequest((previous) => ({ target, seq: (previous?.seq ?? 0) + 1 }));
    }
  }

  function onChange(field: EventFormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    // The message described the old value; drop it until the next submit.
    setErrors((previous) => {
      if (previous[field] === undefined) return previous;
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  }

  async function onSubmit() {
    const result = validateEvent(values, { today, purchaseDate: equipment.purchaseDate });
    if (!result.ok) {
      showErrors(result.errors);
      return;
    }

    setSaving(true);
    setFormError(undefined);
    try {
      await recordEquipmentEvent(equipment.id, result.data);
      // Replace the form entry: "back" from the detail should not reopen a submitted form.
      void navigate(detailPath, { replace: true, state: navigationState });
    } catch (error) {
      const { fieldErrors, formError: nextFormError } = eventSubmitErrorFromApi(error, values.type);
      showErrors(fieldErrors, nextFormError);
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Registrar evento</h2>
        <p className="text-sm text-slate-600">
          <span className="font-mono">{equipment.code}</span> · {equipment.name}
        </p>
      </div>
      <EquipmentEventForm
        equipment={equipment}
        values={values}
        errors={errors}
        formError={formError}
        locations={locations}
        replacements={replacements}
        today={today}
        saving={saving}
        focusRequest={focusRequest}
        cancelTo={detailPath}
        cancelState={navigationState}
        onChange={onChange}
        onSubmit={() => void onSubmit()}
        onRetryLocations={locations.status === 'error' ? retryLocations : undefined}
        onRetryReplacements={replacements.status === 'error' ? retryReplacements : undefined}
      />
    </section>
  );
}
