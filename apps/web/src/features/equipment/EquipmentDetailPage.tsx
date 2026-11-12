import {
  idSchema,
  type EquipmentEventResponse,
  type EquipmentResponse,
} from '@mantenimiento/shared';
import { useCallback, useState } from 'react';
import { useLocation, useParams } from 'react-router';

import {
  getEquipment,
  listEquipmentEvents,
  recordEquipmentEvent,
} from '../../shared/api/equipment';
import { listLocations } from '../../shared/api/locations';
import { isNotFound, useResource } from '../../shared/hooks/useResource';
import { todayIsoDate } from './dates';
import { EquipmentDetailView, type RetireState } from './EquipmentDetailView';
import { initialEventFormValues, validateEvent } from './equipmentEventFormModel';
import { EquipmentLoadStatus } from './EquipmentLoadStatus';
import { listPath, readNavigationState } from './navigation';

/** Route `/equipos/:id`: validates the id before loading, so a malformed one is "not found". */
export function EquipmentDetailPage() {
  const { id = '' } = useParams();
  const navigationState = readNavigationState(useLocation().state);
  const backTo = listPath(navigationState);

  if (!idSchema.safeParse(id).success) {
    return <EquipmentLoadStatus state={{ status: 'not-found' }} backTo={backTo} />;
  }
  // Keyed by id so the retire state never carries over to another item.
  return <EquipmentDetail key={id} id={id} />;
}

/**
 * Container: loads the item, the locations and the event history, and runs the retire action (a
 * `RETIREMENT` event dated today, with the reason as its description).
 */
function EquipmentDetail({ id }: { id: string }) {
  const navigationState = readNavigationState(useLocation().state);
  const backTo = listPath(navigationState);

  const loaded = useResource(
    useCallback((signal: AbortSignal) => getEquipment(id, { signal }), [id]),
  );
  const locations = useResource(
    useCallback((signal: AbortSignal) => listLocations({ signal }), []),
  );
  // A fresh load function refetches the history (retry, or after an action that may add events).
  const [eventsLoad, setEventsLoad] = useState<
    (signal: AbortSignal) => Promise<EquipmentEventResponse[]>
  >(() => (signal: AbortSignal) => listEquipmentEvents(id, { signal }));
  const events = useResource(eventsLoad);
  const reloadEvents = useCallback(
    () => setEventsLoad(() => (signal: AbortSignal) => listEquipmentEvents(id, { signal })),
    [id],
  );
  const [retire, setRetire] = useState<RetireState>({ step: 'idle' });
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  // A new value asks the confirmation to focus the reason field.
  const [reasonFocus, setReasonFocus] = useState(0);
  // The item as returned by the retire action; it supersedes the loaded one.
  const [retired, setRetired] = useState<EquipmentResponse | null>(null);
  const [today] = useState(() => todayIsoDate(new Date()));
  const purchaseDate = loaded.status === 'success' ? loaded.data.purchaseDate : undefined;

  const onRetireConfirm = useCallback(() => {
    if (purchaseDate === undefined) return;
    const result = validateEvent(
      { ...initialEventFormValues(today), type: 'RETIREMENT', description: reason },
      { today, purchaseDate },
    );
    if (!result.ok) {
      if (result.errors.description !== undefined) {
        setReasonError(result.errors.description);
        setReasonFocus((previous) => previous + 1);
      } else {
        setRetire({ step: 'failed' });
      }
      return;
    }
    setRetire({ step: 'retiring' });
    recordEquipmentEvent(id, result.data).then(
      ({ equipment }) => {
        setRetired(equipment);
        setRetire({ step: 'done' });
        reloadEvents();
      },
      () => setRetire({ step: 'failed' }),
    );
  }, [id, purchaseDate, reason, reloadEvents, today]);

  function onReasonChange(value: string) {
    setReason(value);
    // The message described the old value; drop it until the next confirmation.
    setReasonError(undefined);
  }

  function onRetireCancel() {
    setRetire({ step: 'idle' });
    setReason('');
    setReasonError(undefined);
  }

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

  return (
    <EquipmentDetailView
      equipment={retired ?? loaded.data}
      locations={locations}
      events={events}
      onEventsRetry={reloadEvents}
      today={today}
      backTo={backTo}
      navigationState={navigationState}
      retire={retire}
      retireReason={reason}
      retireReasonError={reasonError}
      retireReasonFocus={reasonFocus}
      onRetireReasonChange={onReasonChange}
      onRetireRequest={() => setRetire({ step: 'confirming' })}
      onRetireCancel={onRetireCancel}
      onRetireConfirm={onRetireConfirm}
    />
  );
}
