import { z } from "zod";

export const bootstrapStatusSchema = z.object({
  appName: z.string(),
  packageCount: z.number().int().nonnegative()
});

export type BootstrapStatus = z.infer<typeof bootstrapStatusSchema>;

export const persistenceWarningSchema = z.object({
  message: z.string().min(1),
  runId: z.string().min(1).nullable()
});

export type PersistenceWarning = z.infer<typeof persistenceWarningSchema>;
