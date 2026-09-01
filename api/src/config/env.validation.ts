import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SHADOW_DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * `@nestjs/config` validate hook. Throws with a readable summary so a misconfigured
 * environment fails fast at boot instead of surfacing as a runtime error later.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map(
        (issue) => ` - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${summary}`);
  }
  return parsed.data;
}
