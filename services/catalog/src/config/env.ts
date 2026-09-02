import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  CATALOG_PORT: z.coerce.number().int().positive().default(3003),
  CATALOG_DATABASE_URL: z.string().min(1, 'CATALOG_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z
    .string()
    .min(16, 'INTERNAL_CONTEXT_SECRET must be at least 16 characters'),

  // Object storage for product images (S3-compatible; MinIO in local dev).
  S3_ENDPOINT: z.string().min(1).default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1).default('pos-local'),
  S3_SECRET_KEY: z.string().min(1).default('pos-local-secret'),
  S3_BUCKET: z.string().min(1).default('pos-media'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Base URL a stored object is publicly served from (bucket is download-anon in dev).
  S3_PUBLIC_URL: z.string().min(1).default('http://localhost:9000/pos-media'),
  // Max product image size accepted by the upload endpoint.
  IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(5_000_000),
});

export type Env = z.infer<typeof envSchema>;
