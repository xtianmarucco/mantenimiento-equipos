import express, { type Express } from 'express';

import { GetHealth } from './modules/health/application/get-health.js';
import { createHealthRouter } from './modules/health/infrastructure/health-router.js';
import { errorHandler, notFoundHandler } from './shared/infrastructure/http-errors.js';

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api/health', createHealthRouter(new GetHealth()));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
