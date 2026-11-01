import { idSchema, type EquipmentResponse } from '@mantenimiento/shared';
import { useCallback, useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { getEquipment, retireEquipment } from '../../shared/api/equipment';
import { listLocations } from '../../shared/api/locations';
import { isNotFound, useResource } from '../../shared/hooks/useResource';
import { todayIsoDate } from './dates';
import { EquipmentDetailView, type RetireState } from './EquipmentDetailView';
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

/** Container: loads the item and the locations, and runs the retire action. */
function EquipmentDetail({ id }: { id: string }) {
  const navigationState = readNavigationState(useLocation().state);
  const backTo = listPath(navigationState);

  const loaded = useResource(
    useCallback((signal: AbortSignal) => getEquipment(id, { signal }), [id]),
  );
  const locations = useResource(
    useCallback((signal: AbortSignal) => listLocations({ signal }), []),
  );
  const [retire, setRetire] = useState<RetireState>({ step: 'idle' });
  // The item as returned by the retire action; it supersedes the loaded one.
  const [retired, setRetired] = useState<EquipmentResponse | null>(null);

  const onRetireConfirm = useCallback(() => {
    setRetire({ step: 'retiring' });
    retireEquipment(id).then(
      (item) => {
        setRetired(item);
        setRetire({ step: 'done' });
      },
      () => setRetire({ step: 'failed' }),
    );
  }, [id]);

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
      today={todayIsoDate(new Date())}
      backTo={backTo}
      navigationState={navigationState}
      retire={retire}
      onRetireRequest={() => setRetire({ step: 'confirming' })}
      onRetireCancel={() => setRetire({ step: 'idle' })}
      onRetireConfirm={onRetireConfirm}
    />
  );
}
