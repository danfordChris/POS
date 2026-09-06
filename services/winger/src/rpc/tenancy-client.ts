import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import {
  SUBJECTS,
  resolveMembershipResponse,
  type MessageBus,
} from '@pos/contracts';
import { z } from 'zod';

const RPC_TIMEOUT_MS = 3000;

export type ResolveMembershipResult = z.infer<typeof resolveMembershipResponse>;

/** Thin client for `pos.rpc.tenancy.resolveMembership`. Used to enforce the
 * member/winger mutual-exclusion rule at authorize time. */
@Injectable()
export class TenancyClient {
  private readonly logger = new Logger(TenancyClient.name);

  constructor(@Inject(MESSAGE_BUS) private readonly bus: MessageBus) {}

  async resolveMembership(input: {
    business_id: string;
    user_id: string;
  }): Promise<ResolveMembershipResult> {
    try {
      const raw = await this.bus.request(
        SUBJECTS.tenancy.resolveMembership,
        input,
        RPC_TIMEOUT_MS,
      );
      return resolveMembershipResponse.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RPC tenancy.resolveMembership failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Tenancy service is unavailable. Try again shortly.',
        devMessage: `tenancy.resolveMembership: ${message}`,
      });
    }
  }
}
