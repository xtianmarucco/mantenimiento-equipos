import type { HealthReport } from '../domain/health-report.js';

/**
 * Use case: report the service health.
 *
 * The process answering is the only dependency for now; checks for downstream services
 * (for example the database) belong here once they exist.
 */
export class GetHealth {
  execute(): HealthReport {
    return { status: 'ok' };
  }
}
