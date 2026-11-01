/** UI state of the API health check, rendered by `HealthStatusCard`. */
export type HealthState = { status: 'loading' } | { status: 'ok' } | { status: 'error' };
