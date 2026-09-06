import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  WINGER_PORT: z.coerce.number().int().positive().default(3006),
  WINGER_DATABASE_URL: z.string().min(1, 'WINGER_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),
  // Base URL the winger portal link (WingerAuthorized.portal_url) points at.
  WEB_BASE_URL: z.string().min(1).default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;
