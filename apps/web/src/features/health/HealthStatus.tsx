import { HealthStatusCard } from './HealthStatusCard';
import { useHealthStatus } from './useHealthStatus';

/** Container: fetches the API health and hands the state to the presentational card. */
export function HealthStatus() {
  const state = useHealthStatus();
  return <HealthStatusCard state={state} />;
}
