import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits credential submission. Keyed on the submitted identifier
 * (email/phone) so one caller cannot brute-force an account by rotating IPs,
 * falling back to IP when no identifier is present.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = (req.body ?? {}) as { email?: string; phone?: string };
    const identifier =
      body.email || body.phone || (req.ip as string) || 'unknown';
    return `login:${identifier}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Too many attempts. Try again shortly.');
  }
}
