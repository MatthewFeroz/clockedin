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
  reason: z.string().optional(),
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
  durationSeconds: z.number().int().positive(),
  startedAt: z.string(),
  endsAt: z.string(),
  attemptId: z.string(),
  message: z.object({
    primary: z.string(),
    secondary: z.string()
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

export const weeklyDailyInsightSchema = z.object({
  date: z.string(),
  label: z.string(),
  attempts: z.number().int().nonnegative(),
  sessionsStarted: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  focusSeconds: z.number().int().nonnegative(),
  resetSeconds: z.number().int().nonnegative(),
  focusScore: z.number().min(0).max(100).nullable()
});

export type WeeklyDailyInsight = z.infer<typeof weeklyDailyInsightSchema>;

export const sessionRoundupSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  endsAt: z.string(),
  status: focusSessionSchema.shape.status,
  durationSeconds: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  resetSeconds: z.number().int().nonnegative(),
  focusScore: z.number().min(0).max(100)
});

export type SessionRoundup = z.infer<typeof sessionRoundupSchema>;

export const distractionTrendSchema = z.object({
  targetId: z.string(),
  targetLabel: z.string(),
  attempts: z.number().int().nonnegative(),
  lastDetectedAt: z.string()
});

export type DistractionTrend = z.infer<typeof distractionTrendSchema>;

export const weeklyInsightsSchema = z.object({
  rangeStart: z.string(),
  rangeEnd: z.string(),
  totalAttempts: z.number().int().nonnegative(),
  totalSessions: z.number().int().nonnegative(),
  completedSessions: z.number().int().nonnegative(),
  totalFocusSeconds: z.number().int().nonnegative(),
  totalResetSeconds: z.number().int().nonnegative(),
  averageFocusScore: z.number().min(0).max(100).nullable(),
  streakDays: z.number().int().nonnegative(),
  daily: z.array(weeklyDailyInsightSchema),
  sessions: z.array(sessionRoundupSchema),
  topDistractions: z.array(distractionTrendSchema)
});

export type WeeklyInsights = z.infer<typeof weeklyInsightsSchema>;

export const desktopSnapshotSchema = z.object({
  blockedTargets: z.array(blockedTargetSchema),
  activeSession: focusSessionSchema.nullable(),
  punishment: punishmentStateSchema.nullable(),
  attempts: z.array(attemptEventSchema),
  recentSessions: z.array(focusSessionSchema),
  metrics: metricsSummarySchema,
  weeklyInsights: weeklyInsightsSchema,
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
