import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MESSAGE_BUS } from '@pos/nest-common';
import {
  SUBJECTS,
  resolveMembershipRequest,
  getUserResponse,
  type MessageBus,
} from '@pos/contracts';
import { z } from 'zod';
import { BusinessesService } from '../businesses/businesses.service.js';

/** Thin client for `pos.rpc.identity.getUser` (used when linking a user by email/phone). */
@Injectable()
export class IdentityClient {
  constructor(@Inject(MESSAGE_BUS) private readonly bus: MessageBus) {}

  async getUser(query: {
    user_id?: string;
    email?: string;
    phone?: string;
    create?: boolean;
  }): Promise<z.infer<typeof getUserResponse>> {
    const raw = await this.bus.request(SUBJECTS.identity.getUser, query, 2000);
    return getUserResponse.parse(raw);
  }
}

/** Registers tenancy's NATS request/reply handlers. */
@Injectable()
export class TenancyRpc implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenancyRpc.name);

  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly businesses: BusinessesService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.reply(SUBJECTS.tenancy.resolveMembership, async (raw) => {
      const { business_id, user_id } = resolveMembershipRequest.parse(raw);
      const membership = await this.businesses.findMembership(
        business_id,
        user_id,
      );
      return membership
        ? { found: true, role: membership.role, status: membership.status }
        : { found: false, role: null, status: null };
    });
    this.logger.log('RPC handlers registered (resolveMembership)');
  }
}
