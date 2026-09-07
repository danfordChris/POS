import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NOTIFICATIONS_PORT: z.coerce.number().int().positive().default(3007),
  NOTIFICATIONS_DATABASE_URL: z
    .string()
    .min(1, 'NOTIFICATIONS_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),

  // Outbound email. `capture` keeps sends in memory (tests / offline dev).
  EMAIL_PROVIDER: z.enum(['smtp', 'capture']).default('smtp'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('POS Platform <no-reply@pos.local>'),

  // Base URL for the catalog deep link in alert emails.
  WEB_BASE_URL: z.string().min(1).default('http://localhost:3000'),

  // Digest flush poll interval (ms); also the retry backoff floor.
  DIGEST_POLL_MS: z.coerce.number().int().positive().default(60000),
  // Fallback window length when a business has no `digest_config` row yet.
  DIGEST_DEFAULT_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  // Overdue-invoice sweep poll interval (ms) and its default cadence (hours),
  // used when a business has no `digest_config` row.
  OVERDUE_POLL_MS: z.coerce.number().int().positive().default(3_600_000),
  OVERDUE_DEFAULT_INTERVAL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24),
});

export type Env = z.infer<typeof envSchema>;
