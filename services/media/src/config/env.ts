import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MEDIA_PORT: z.coerce.number().int().positive().default(3008),
  MEDIA_DATABASE_URL: z.string().min(1, 'MEDIA_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),
  // Object storage for rendered invoice PDFs (S3-compatible; MinIO in local dev).
  S3_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1).default('pos-local'),
  S3_SECRET_KEY: z.string().min(1).default('pos-local-secret'),
  S3_BUCKET: z.string().min(1).default('pos-media'),
  S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  S3_PUBLIC_URL: z.string().min(1).default('http://localhost:9000/pos-media'),
});

export type Env = z.infer<typeof envSchema>;
