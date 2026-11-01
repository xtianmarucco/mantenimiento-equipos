/** Overall state of the service as seen by the health check. */
export type HealthState = 'ok';

/** Result of checking whether the service is able to serve requests. */
export interface HealthReport {
  readonly status: HealthState;
}
