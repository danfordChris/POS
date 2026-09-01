import { ConfigModule } from '@nestjs/config';
import type { ZodType } from 'zod';

export { ConfigModule as NestConfigModule };

/**
 * Builds a `@nestjs/config` `validate` function from a zod schema. A misconfigured
 * environment fails fast at boot with a readable summary instead of surfacing as a
 * runtime error later.
 */
export function makeEnvValidator<T>(schema: ZodType<T>): (raw: Record<string, unknown>) => T {
  return (raw: Record<string, unknown>): T => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const summary = parsed.error.issues
        .map((issue) => ` - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${summary}`);
    }
    return parsed.data;
  };
}
