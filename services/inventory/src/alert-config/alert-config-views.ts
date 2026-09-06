import type { AlertConfig } from '#prisma';

export interface AlertConfigView {
  recipients: string[];
  min_interval_hours: number;
  updated_at: string;
}

export function toAlertConfigView(c: AlertConfig): AlertConfigView {
  return {
    recipients: Array.isArray(c.recipients) ? (c.recipients as string[]) : [],
    min_interval_hours: c.minIntervalHours,
    updated_at: c.updatedAt.toISOString(),
  };
}
