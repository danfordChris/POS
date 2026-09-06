import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SALES_PORT: z.coerce.number().int().positive().default(3005),
  SALES_DATABASE_URL: z.string().min(1, 'SALES_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),
  // Base URL the public receipt link points at.
  WEB_BASE_URL: z.string().min(1).default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;
