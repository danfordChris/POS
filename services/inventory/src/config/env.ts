import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  INVENTORY_PORT: z.coerce.number().int().positive().default(3004),
  INVENTORY_DATABASE_URL: z
    .string()
    .min(1, 'INVENTORY_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),
});

export type Env = z.infer<typeof envSchema>;
