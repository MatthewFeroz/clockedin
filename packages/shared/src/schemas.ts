import { z } from "zod";

export const blockedTargetSchema = z.object({
  id: z.string(),
  kind: z.enum(["website", "app"]),
  label: z.string(),
  enabled: z.boolean(),
  match: z.object({
    domains: z.array(z.string()).optional(),
    bundleIds: z.array(z.string()).optional(),
    processNames: z.array(z.string()).optional()
  })
});

export type BlockedTarget = z.infer<typeof blockedTargetSchema>;

export const focusSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endsAt: z.string(),
  status: z.enum(["active", "completed", "cancelled"]),
  durationSeconds: z.number().int().nonnegative(),
  guidedResetSecondsAccumulated: z.number().int().nonnegative()
});

export type FocusSession = z.infer<typeof focusSessionSchema>;

export const attemptEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  source: z.enum(["extension", "native-helper"]),
  targetId: z.string(),
  targetLabel: z.string(),
  detectedAt: z.string(),
  platform: z.enum(["macos", "windows"]),
  context: z.object({
    url: z.string().optional(),
    appName: z.string().optional(),
    processName: z.string().optional(),
    bundleId: z.string().optional(),
    windowTitle: z.string().optional()
  })
});

export type AttemptEvent = z.infer<typeof attemptEventSchema>;

export const punishmentStateSchema = z.object({
  active: z.boolean(),
  mode: z.literal("guided_refocus"),
  durationSeconds: z.literal(15),
  startedAt: z.string(),
  endsAt: z.string(),
  attemptId: z.string(),
  message: z.object({
    primary: z.literal("Take a deep breath."),
    secondary: z.literal("Refocus on what you intended to do.")
  })
});

export type PunishmentState = z.infer<typeof punishmentStateSchema>;

export const appSettingsSchema = z.object({
  defaultSessionDurationMinutes: z.number().int().positive()
});

export type AppSettingMap = z.infer<typeof appSettingsSchema>;

export const metricsSummarySchema = z.object({
  attemptsBlocked: z.number().int().nonnegative(),
  totalResetSeconds: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  averageAttemptsPerSession: z.number().nonnegative(),
  todayAttempts: z.number().int().nonnegative(),
  weekAttempts: z.number().int().nonnegative()
});

export type MetricsSummary = z.infer<typeof metricsSummarySchema>;

export const desktopSnapshotSchema = z.object({
  blockedTargets: z.array(blockedTargetSchema),
  activeSession: focusSessionSchema.nullable(),
  punishment: punishmentStateSchema.nullable(),
  attempts: z.array(attemptEventSchema),
  recentSessions: z.array(focusSessionSchema),
  metrics: metricsSummarySchema,
  settings: appSettingsSchema,
  latestAttempt: attemptEventSchema.nullable()
});

export type DesktopSnapshot = z.infer<typeof desktopSnapshotSchema>;

export const startSessionInputSchema = z.object({
  durationMinutes: z.number().int().min(5).max(480)
});

export type StartSessionInput = z.infer<typeof startSessionInputSchema>;

export const updateSettingInputSchema = z.union([
  z.object({
    key: z.literal("defaultSessionDurationMinutes"),
    value: z.number().int().positive()
  })
]);

export type UpdateSettingInput = z.infer<typeof updateSettingInputSchema>;
