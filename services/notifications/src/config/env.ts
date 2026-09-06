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
});

export type Env = z.infer<typeof envSchema>;
