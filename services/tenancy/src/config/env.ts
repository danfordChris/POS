import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  TENANCY_PORT: z.coerce.number().int().positive().default(3002),
  TENANCY_DATABASE_URL: z.string().min(1, 'TENANCY_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),
  // Shared secret Kong presents on the internal membership endpoint.
  INTERNAL_API_KEY: z.string().min(8).default('dev-internal-api-key'),
});

export type Env = z.infer<typeof envSchema>;
