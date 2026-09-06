import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import { SUBJECTS, getUserResponse, type MessageBus } from '@pos/contracts';
import { z } from 'zod';

const RPC_TIMEOUT_MS = 3000;

export type GetUserResult = z.infer<typeof getUserResponse>;

/** Thin client for `pos.rpc.identity.getUser`. A transport failure becomes a
 * `503 upstream_unavailable`; a valid `{ found: false }` is returned as-is. */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);

  constructor(@Inject(MESSAGE_BUS) private readonly bus: MessageBus) {}

  async getUser(input: {
    user_id?: string;
    email?: string;
    phone?: string;
    create?: boolean;
  }): Promise<GetUserResult> {
    try {
      const raw = await this.bus.request(
        SUBJECTS.identity.getUser,
        input,
        RPC_TIMEOUT_MS,
      );
      return getUserResponse.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RPC identity.getUser failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'upstream_unavailable',
        message: 'Identity service is unavailable. Try again shortly.',
        devMessage: `identity.getUser: ${message}`,
      });
    }
  }
}
