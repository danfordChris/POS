import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  IDENTITY_PORT: z.coerce.number().int().positive().default(3001),
  IDENTITY_DATABASE_URL: z.string().min(1, 'IDENTITY_DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
});

export type Env = z.infer<typeof envSchema>;
