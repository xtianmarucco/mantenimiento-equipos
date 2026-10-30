import { healthResponseSchema, type HealthResponse } from '@mantenimiento/shared';
import { Router } from 'express';

import type { GetHealth } from '../application/get-health.js';

/** HTTP adapter for the health module, mounted under `/api/health`. */
export function createHealthRouter(getHealth: GetHealth): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    // Validate against the shared contract so the API cannot drift from what the web app expects.
    const body: HealthResponse = healthResponseSchema.parse(getHealth.execute());
    res.status(200).json(body);
  });

  return router;
}
