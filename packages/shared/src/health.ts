import { z } from 'zod';

/** Payload returned by the API health endpoint (`GET /api/health`). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
