import { z } from 'zod';

/** One validation problem: the dotted path of the offending field (`''` for the whole value). */
export const errorIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ErrorIssue = z.infer<typeof errorIssueSchema>;

/** JSON body of every API error response. `issues` is present on validation errors (400). */
export const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    issues: z.array(errorIssueSchema).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
